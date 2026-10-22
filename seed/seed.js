// Loads the January 2026 report of YC Team D (from your Excel/Word files) so the dashboards are not empty.
//   npm run seed            -> creates the admin (if missing) and the January 2026 data (if missing)
//   npm run seed -- --force -> replaces the January 2026 data
// Withdrawals are NOT seeded: the Assistant Team Leader adds those.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const data = require('./january-2026.json');
const { bootstrapAdmin } = require('../controllers/userController');
const { AUDIT_TEMPLATE, reportDefaults } = require('../config/constants');

const TEAM = 'YC-D';   // the January 2026 report belongs to YC Team D

const MonthlyReport = require('../models/MonthlyReport');
const EfficiencyEntry = require('../models/EfficiencyEntry');
const StrippingEntry = require('../models/StrippingEntry');
const DowntimeEntry = require('../models/DowntimeEntry');
const PersonnelRecord = require('../models/PersonnelRecord');
const SwabstickRecord = require('../models/SwabstickRecord');
const MachineAudit = require('../models/MachineAudit');

async function loadJanuary({ force = false } = {}) {
	const period = data.period;
	const exists = await EfficiencyEntry.countDocuments({ teamKey: TEAM, period });

	if (exists && !force) {
		console.log(`${period} already has data. Use "npm run seed -- --force" to replace it.`);
		return false;
	}

	for (const M of [MonthlyReport, EfficiencyEntry, StrippingEntry, DowntimeEntry, PersonnelRecord, SwabstickRecord, MachineAudit]) {
		await M.deleteMany({ teamKey: TEAM, period });
	}

	await MonthlyReport.create({
		teamKey: TEAM, period, ...reportDefaults(TEAM), effTarget: data.effTarget,
		daysOverride: data.daysOverride, accomplishments: data.accomplishments,
		cutoffStart: data.cutoffStart, cutoffEnd: data.cutoffEnd
	});
	await EfficiencyEntry.create(data.efficiency.map(d => ({ ...d, teamKey: TEAM })));
	await StrippingEntry.create(data.stripping.map(d => ({ ...d, teamKey: TEAM })));
	await DowntimeEntry.create(data.downtime.map(d => ({ ...d, teamKey: TEAM, period })));
	await PersonnelRecord.create(data.personnel.map(p => ({ ...p, teamKey: TEAM, period })));
	await SwabstickRecord.create(data.swabstick.map(s => ({ ...s, teamKey: TEAM, period })));
	await MachineAudit.create({
		teamKey: TEAM, period, line: data.audit.line, doneBy: data.audit.doneBy, checkedBy: data.audit.checkedBy,
		items: AUDIT_TEMPLATE.flatMap(s => s.items.map(name => ({ section: s.section, group: s.group, name })))
	});
	console.log(`Loaded ${period} for YC Team D: ${data.efficiency.length} efficiency rows, ${data.stripping.length} stripping rows, ${data.downtime.length} downtime rows, ${data.personnel.length} members.`);
	return true;
}

module.exports = { loadJanuary };

if (require.main === module) {
	mongoose.connect(process.env.MONGODB_STRING)
		.then(async () => {
			await bootstrapAdmin();
			await loadJanuary({ force: process.argv.includes('--force') });
		})
		.catch(err => { console.error(err.message); process.exitCode = 1; })
		.finally(() => mongoose.disconnect());
}
