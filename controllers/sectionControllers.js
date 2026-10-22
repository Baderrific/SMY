const crud = require('./crud');
const { periodFilter, checkLine } = crud;
const metrics = require('../services/metrics');
const { PERIOD_RE, isRealDate } = require('../models/shared');
const { linesFor, SWAB_ITEMS, AUDIT_TEMPLATE, AUDIT_CONDITIONS, reportDefaults } = require('../config/constants');

const MonthlyReport = require('../models/MonthlyReport');
const EfficiencyEntry = require('../models/EfficiencyEntry');
const StrippingEntry = require('../models/StrippingEntry');
const DowntimeEntry = require('../models/DowntimeEntry');
const PersonnelRecord = require('../models/PersonnelRecord');
const SwabstickRecord = require('../models/SwabstickRecord');
const MachineAudit = require('../models/MachineAudit');
const Withdrawal = require('../models/Withdrawal');

// Every query below includes the logged-in user's teamKey (for example "YC-D"), so a team only ever sees its own data.
const fail = (status, message) => { const e = new Error(message); e.status = status; return e; };
const requirePeriod = (value) => { if (!PERIOD_RE.test(value || '')) throw fail(400, 'Invalid period.'); return value; };
const mine = (req) => ({ teamKey: req.user.teamKey });

// ---------- Month settings + written part of the report ----------

async function loadMeta(req, period) {
	const saved = await MonthlyReport.findOne({ ...mine(req), period }).lean();
	return { ...reportDefaults(req.user.teamKey), accomplishments: [], cutoffStart: '', cutoffEnd: '', daysOverride: {}, ...(saved || {}), period };
}

const getMeta = async (req, res) => res.status(200).send({ meta: await loadMeta(req, requirePeriod(req.params.period)) });

const saveMeta = async (req, res) => {
	const period = requirePeriod(req.params.period);
	const b = req.body || {};
	for (const key of ['cutoffStart', 'cutoffEnd']) {
		if (b[key] && !isRealDate(b[key])) throw fail(400, 'Cut-off dates must be real dates.');
	}
	const doc = await MonthlyReport.findOne({ ...mine(req), period }) || new MonthlyReport({ ...mine(req), period, ...reportDefaults(req.user.teamKey) });
	['effTarget', 'to', 'from', 'cutoffStart', 'cutoffEnd', 'preparedBy', 'checkedBy'].forEach(k => { if (b[k] !== undefined) doc.set(k, b[k]); });
	if (b.daysOverride) linesFor(req.user.area).forEach(l => doc.set(`daysOverride.${l}`, b.daysOverride[l] === '' ? null : b.daysOverride[l]));
	if (Array.isArray(b.accomplishments)) doc.set('accomplishments', b.accomplishments.map(s => String(s).trim()).filter(Boolean).slice(0, 40));
	await doc.save();
	res.status(200).send({ message: 'Saved.', meta: await loadMeta(req, period) });
};

// ---------- Efficiency (saved one day at a time: up to 4 lines) ----------

const efficiencyList = async (req, res) => {
	const period = requirePeriod(req.query.period);
	const [entries, meta] = await Promise.all([EfficiencyEntry.find({ ...mine(req), period }).sort({ date: 1, line: 1 }).lean(), loadMeta(req, period)]);
	res.status(200).send({ entries, meta, metrics: metrics.efficiency(entries, meta, linesFor(req.user.area)) });
};

const efficiencySaveDay = async (req, res) => {
	const { date, lines } = req.body || {};
	if (!isRealDate(date)) throw fail(400, 'Choose a real date.');
	if (!Array.isArray(lines)) throw fail(400, 'Send the lines for this day.');

	const docs = [];
	for (const row of lines) {
		checkLine({ line: row.line }, req);
		if (row.efficiency === '' || row.efficiency === null || row.efficiency === undefined) continue; // line did not run
		let doc = await EfficiencyEntry.findOne({ ...mine(req), date, line: row.line });
		if (!doc) doc = new EfficiencyEntry({ ...mine(req), date, line: row.line });
		['efficiency', 'moldNo', 'remarks', 'excludeFromAverage'].forEach(k => { if (row[k] !== undefined) doc.set(k, row[k]); });
		await doc.validate();
		docs.push(doc);
	}
	if (!docs.length) throw fail(400, 'Enter the efficiency of at least one line.');
	for (const d of docs) await d.save();
	res.status(200).send({ message: 'Saved.' });
};

const efficiencyRemove = async (req, res) => {
	const entry = await EfficiencyEntry.findById(req.params.id);
	if (!entry || entry.teamKey !== req.user.teamKey) throw fail(404, 'Record not found.');
	await EfficiencyEntry.findByIdAndDelete(entry._id);
	res.status(200).send({ message: 'Deleted.' });
};

// ---------- Rows-per-record sections ----------

const stripping = crud({
	Model: StrippingEntry, fields: ['date', 'line', 'moldNo', 'defect', 'percent'], sort: { date: 1, line: 1 },
	metrics: (entries, req) => ({ metrics: metrics.stripping(entries, linesFor(req.user.area)) })
});

const downtime = crud({
	Model: DowntimeEntry, fields: ['group', 'item', 'line', 'minutes', 'remarks'], sort: { group: 1, line: 1 },
	metrics: (entries, req) => ({ metrics: metrics.downtime(entries, linesFor(req.user.area)) }),
	onCreate: (data, req) => ({ ...data, period: requirePeriod(req.body.period) })
});

const personnel = crud({
	Model: PersonnelRecord, fields: ['name', 'leaves', 'otFirstHalf', 'otSecondHalf'], sort: { name: 1 },
	metrics: async (entries, req) => ({ metrics: metrics.personnel(entries), meta: req.query.period ? await loadMeta(req, req.query.period) : null }),
	onCreate: (data, req) => ({ ...data, period: requirePeriod(req.body.period) })
});

// Copies the member names of an earlier month into a new month (all numbers start at 0)
const personnelCopy = async (req, res) => {
	const from = requirePeriod(req.body.from), to = requirePeriod(req.body.to);
	if (await PersonnelRecord.countDocuments({ ...mine(req), period: to })) throw fail(409, 'This month already has members.');
	const source = await PersonnelRecord.find({ ...mine(req), period: from }).sort({ name: 1 }).lean();
	if (!source.length) throw fail(404, 'That month has no members to copy.');
	await PersonnelRecord.insertMany(source.map(s => ({ ...mine(req), period: to, name: s.name })));
	res.status(200).send({ message: `Copied ${source.length} members.` });
};

const withdrawals = crud({
	Model: Withdrawal, fields: ['name', 'materialNo', 'pcs', 'date', 'midNo'], sort: { date: -1 },
	metrics: (entries) => ({ metrics: metrics.withdrawals(entries) }),
	onCreate: (data, req) => ({ ...data, createdBy: req.user.id })
});

// ---------- Swabstick ----------

const swabList = async (req, res) => {
	const entries = await SwabstickRecord.find({ ...periodFilter(req), ...mine(req) }).lean();
	res.status(200).send({ entries, metrics: metrics.swabstick(entries) });
};

const swabSave = async (req, res) => {
	const period = requirePeriod(req.body.period);
	if (!Array.isArray(req.body.rows)) throw fail(400, 'Send the rows to save.');
	const docs = [];
	for (const row of req.body.rows) {
		if (!SWAB_ITEMS.includes(row.item)) throw fail(400, 'Unknown item.');
		const doc = await SwabstickRecord.findOne({ ...mine(req), period, item: row.item }) || new SwabstickRecord({ ...mine(req), period, item: row.item });
		['received', 'available', 'consumed'].forEach(k => doc.set(k, row[k] === '' || row[k] == null ? 0 : row[k]));
		await doc.validate();
		docs.push(doc);
	}
	for (const d of docs) await d.save();
	res.status(200).send({ message: 'Saved.' });
};

// ---------- Machine audit ----------

const findAudit = async (req) => {
	const audit = await MachineAudit.findById(req.params.id);
	if (!audit || audit.teamKey !== req.user.teamKey) throw fail(404, 'Audit not found.');
	return audit;
};

const auditList = async (req, res) => {
	const audits = await MachineAudit.find({ ...mine(req), period: requirePeriod(req.query.period) }).sort({ line: 1 }).lean();
	res.status(200).send({ audits, metrics: metrics.audits(audits, linesFor(req.user.area)) });
};

const auditStart = async (req, res) => {
	const period = requirePeriod(req.body.period);
	checkLine({ line: req.body.line }, req);
	if (await MachineAudit.findOne({ ...mine(req), period, line: req.body.line })) throw fail(409, 'This audit already exists.');
	const items = AUDIT_TEMPLATE.flatMap(s => s.items.map(name => ({ section: s.section, group: s.group, name, condition: '', remarks: '' })));
	const audit = await MachineAudit.create({ ...mine(req), period, line: req.body.line, items });
	res.status(201).send({ message: 'Audit started.', audit });
};

const auditSave = async (req, res) => {
	const audit = await findAudit(req);
	const sent = Array.isArray(req.body.items) ? req.body.items : [];
	// Only the condition and the remarks can change. The checklist itself stays as in the form.
	const items = audit.items.map(i => {
		const hit = sent.find(s => s.section === i.section && s.group === i.group && s.name === i.name);
		if (!hit) return i.toObject ? i.toObject() : i;
		if (!AUDIT_CONDITIONS.includes(hit.condition || '')) throw fail(400, 'Condition must be O, X, NC or empty.');
		return { section: i.section, group: i.group, name: i.name, condition: hit.condition || '', remarks: String(hit.remarks || '').slice(0, 300) };
	});
	audit.set('items', items);
	if (req.body.doneBy !== undefined) audit.doneBy = req.body.doneBy;
	if (req.body.checkedBy !== undefined) audit.checkedBy = req.body.checkedBy;
	await audit.save();
	res.status(200).send({ message: 'Saved.', audit });
};

const auditRemove = async (req, res) => {
	const audit = await findAudit(req);
	await MachineAudit.findByIdAndDelete(audit._id);
	res.status(200).send({ message: 'Deleted.' });
};

// ---------- Overview, monthly report, yearly ----------

const periods = async (req, res) => {
	const models = [EfficiencyEntry, StrippingEntry, DowntimeEntry, PersonnelRecord, Withdrawal, MonthlyReport];
	const lists = await Promise.all(models.map(m => m.find(mine(req)).lean().then(rows => rows.map(r => r.period))));
	res.status(200).send({ periods: [...new Set(lists.flat())].sort().reverse() });
};

const summary = async (req, res) => {
	const period = requirePeriod(req.params.period);
	const q = { ...mine(req), period };
	const lines = linesFor(req.user.area);
	const [meta, eff, strip, down, people, swab, audits, wd] = await Promise.all([
		loadMeta(req, period),
		EfficiencyEntry.find(q).lean(), StrippingEntry.find(q).lean(), DowntimeEntry.find(q).lean(),
		PersonnelRecord.find(q).sort({ name: 1 }).lean(), SwabstickRecord.find(q).lean(),
		MachineAudit.find(q).lean(), Withdrawal.find(q).lean()
	]);
	res.status(200).send({
		period, meta, lines,
		efficiency: metrics.efficiency(eff, meta, lines), stripping: metrics.stripping(strip, lines), downtime: metrics.downtime(down, lines),
		personnel: metrics.personnel(people), swabstick: metrics.swabstick(swab), audits: metrics.audits(audits, lines),
		withdrawals: metrics.withdrawals(wd),
		downtimeEntries: down
	});
};

const yearSummary = async (req, res) => {
	const year = String(req.params.year);
	if (!/^\d{4}$/.test(year)) throw fail(400, 'Invalid year.');
	const filter = { ...periodFilter({ query: { year } }), ...mine(req) };
	const lines = linesFor(req.user.area);
	const [eff, strip, down, people, metas] = await Promise.all([
		EfficiencyEntry.find(filter).lean(), StrippingEntry.find(filter).lean(), DowntimeEntry.find(filter).lean(),
		PersonnelRecord.find(filter).lean(), MonthlyReport.find(filter).lean()
	]);
	const perMonth = {};
	const months = [...new Set([...eff, ...strip, ...down, ...people].map(r => r.period))];
	for (const p of months) {
		const meta = metas.find(m => m.period === p) || {};
		const of = list => list.filter(r => r.period === p);
		perMonth[p] = {
			efficiency: of(eff).length ? metrics.efficiency(of(eff), meta, lines).teamAvg : null,
			stripping: of(strip).length ? metrics.stripping(of(strip), lines).teamAvg : null,
			downtime: of(down).length ? metrics.downtime(of(down), lines).total : null,
			avgOT: of(people).length ? metrics.personnel(of(people)).otAvg : null
		};
	}
	res.status(200).send(metrics.yearly(year, perMonth));
};

module.exports = {
	getMeta, saveMeta, periods, summary, yearSummary,
	efficiencyList, efficiencySaveDay, efficiencyRemove,
	stripping, downtime, personnel, personnelCopy, withdrawals,
	swabList, swabSave, auditList, auditStart, auditSave, auditRemove
};
