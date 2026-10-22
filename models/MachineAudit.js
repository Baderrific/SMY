const mongoose = require('mongoose');
const { ALL_LINES, AUDIT_CONDITIONS } = require('../config/constants');
const { periodField, teamField } = require('./shared');

const itemSchema = new mongoose.Schema({
	section: { type: String, required: true },
	group: { type: String, default: '' },
	name: { type: String, required: true },
	condition: { type: String, enum: AUDIT_CONDITIONS, default: '' },
	remarks: { type: String, trim: true, default: '', maxlength: 300 }
}, { _id: false });

// One checklist per line per month
const schema = new mongoose.Schema({
	teamKey: teamField,
	period: periodField,
	line: { type: String, enum: ALL_LINES, required: true },
	doneBy: { type: String, trim: true, default: '' },
	checkedBy: { type: String, trim: true, default: '' },
	items: { type: [itemSchema], default: [] }
}, { timestamps: true });

schema.index({ teamKey: 1, period: 1, line: 1 }, { unique: true });

module.exports = mongoose.model('MachineAudit', schema);
