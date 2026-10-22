const mongoose = require('mongoose');
const { ALL_LINES } = require('../config/constants');
const { dateField, periodField, periodOf, normalizeMold, teamField } = require('./shared');

// One row = the efficiency of one line on one day
const schema = new mongoose.Schema({
	teamKey: teamField,
	period: periodField,
	date: dateField,
	line: { type: String, enum: ALL_LINES, required: true },
	efficiency: { type: Number, required: [true, 'Efficiency is required'], min: [0, 'Efficiency cannot be below 0'], max: [120, 'Efficiency cannot be above 120'] },
	moldNo: { type: String, default: '' },
	remarks: { type: String, trim: true, default: '', maxlength: 300 },
	// Job-change days are not counted in the average (same as the Efficiency sheet)
	excludeFromAverage: { type: Boolean, default: false }
}, { timestamps: true });

schema.index({ teamKey: 1, date: 1, line: 1 }, { unique: true });

schema.pre('validate', function (next) {
	if (this.date) this.period = periodOf(this.date);
	this.moldNo = normalizeMold(this.moldNo);
	next();
});

module.exports = mongoose.model('EfficiencyEntry', schema);
