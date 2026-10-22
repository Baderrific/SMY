const { PERIOD_RE } = require('../models/shared');
const { linesFor } = require('../config/constants');

const fail = (status, message) => { const e = new Error(message); e.status = status; return e; };

// Turns ?period=2026-01 (one month) or ?year=2026 (all 12 months) into a database filter
function periodFilter(req) {
	const { period, year } = req.query;
	if (period !== undefined) {
		if (!PERIOD_RE.test(period)) throw fail(400, 'Invalid period.');
		return { period };
	}
	if (/^\d{4}$/.test(year || '')) {
		return { period: { $in: Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`) } };
	}
	throw fail(400, 'Send ?period=YYYY-MM or ?year=YYYY.');
}

// A team can only use its own lines (YC Team D: YC1-YC4, YA Team B: YA1-YA4 ...)
function checkLine(data, req) {
	if (data.line !== undefined && !linesFor(req.user.area).includes(data.line)) throw fail(400, `Line must be one of ${linesFor(req.user.area).join(', ')}.`);
}

const pick = (body, fields) => fields.reduce((out, f) => (body && body[f] !== undefined ? { ...out, [f]: body[f] } : out), {});

// Builds list / create / update / remove handlers for a model that has one row per record.
// Every query uses the logged-in user's teamKey, so teams never see or change each other's rows.
//  fields:  the only fields a client may set
//  sort:    sort order of the list
//  metrics: optional (entries, req) => extra data sent back with the list (the numbers for the charts)
//  onCreate: optional (data, req) => data (for example to save who created the row)
module.exports = function crud({ Model, fields, sort, metrics, onCreate, filterList }) {
	const findMine = async (req) => {
		const entry = await Model.findById(req.params.id);
		return entry && entry.teamKey === req.user.teamKey ? entry : null;
	};

	return {
		list: async (req, res) => {
			let entries = await Model.find({ ...periodFilter(req), teamKey: req.user.teamKey }).sort(sort).lean();
			if (filterList) entries = filterList(entries, req);
			const extra = metrics ? await metrics(entries, req) : {};
			return res.status(200).send({ entries, ...extra });
		},
		create: async (req, res) => {
			let data = pick(req.body, fields);
			checkLine(data, req);
			if (onCreate) data = onCreate(data, req);
			const entry = await Model.create({ ...data, teamKey: req.user.teamKey });
			return res.status(201).send({ message: 'Saved.', entry });
		},
		update: async (req, res) => {
			const entry = await findMine(req);
			if (!entry) return res.status(404).send({ error: 'Record not found.' });
			const data = pick(req.body, fields);
			checkLine(data, req);
			Object.entries(data).forEach(([k, v]) => entry.set(k, v));
			await entry.save();
			return res.status(200).send({ message: 'Saved.', entry });
		},
		remove: async (req, res) => {
			const entry = await findMine(req);
			if (!entry) return res.status(404).send({ error: 'Record not found.' });
			await Model.findByIdAndDelete(entry._id);
			return res.status(200).send({ message: 'Deleted.' });
		}
	};
};
module.exports.periodFilter = periodFilter;
module.exports.checkLine = checkLine;
