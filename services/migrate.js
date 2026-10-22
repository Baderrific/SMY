// Runs every time the server starts and is safe to run again.
// Before teams existed, all data and accounts belonged to one team: YC Team D. This gives that old data and the
// old Assistant Team Leader / Manager accounts their team, and updates the database indexes to the per-team ones.
const User = require('../models/User');
const MonthlyReport = require('../models/MonthlyReport');
const EfficiencyEntry = require('../models/EfficiencyEntry');
const StrippingEntry = require('../models/StrippingEntry');
const DowntimeEntry = require('../models/DowntimeEntry');
const PersonnelRecord = require('../models/PersonnelRecord');
const SwabstickRecord = require('../models/SwabstickRecord');
const MachineAudit = require('../models/MachineAudit');
const Withdrawal = require('../models/Withdrawal');

const DATA = [MonthlyReport, EfficiencyEntry, StrippingEntry, DowntimeEntry, PersonnelRecord, SwabstickRecord, MachineAudit, Withdrawal];

module.exports.migrate = async () => {
	let moved = 0;
	for (const Model of DATA) {
		const res = await Model.updateMany({ teamKey: { $exists: false } }, { $set: { teamKey: 'YC-D' } });
		moved += res.modifiedCount || 0;
	}
	const users = await User.updateMany({ role: { $in: ['atl', 'manager'] }, area: { $exists: false } }, { $set: { area: 'YC', team: 'D' } });
	if (moved || users.modifiedCount) console.log(`Moved ${moved} old records and ${users.modifiedCount || 0} old accounts to YC Team D.`);

	// Replaces the old indexes (one team) with the new ones (per team)
	for (const Model of DATA) {
		try { await Model.syncIndexes(); }
		catch (e) { console.warn(`Could not update indexes of ${Model.modelName}: ${e.message}`); }
	}
};
