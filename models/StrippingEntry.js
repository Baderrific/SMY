const mongoose = require('mongoose');
const { ALL_LINES } = require('../config/constants');
const { dateField, periodField, periodOf, normalizeMold, teamField } = require('./shared');

// One row = one bottle defect that caused stripping on one line
const schema = new mongoose.Schema({
	teamKey: teamField,
	period: periodField,
	date: dateField,
	line: { type: String, enum: ALL_LINES, required: true },
	moldNo: { type: String, default: '' },
	defect: { type: String, required: [true, 'Defect is required'], trim: true, maxlength: 120 },
	percent: { type: Number, required: [true, '% Strip is required'], min: [0, '% Strip cannot be below 0'], max: [100, '% Strip cannot be above 100'] }
}, { timestamps: true });

schema.pre('validate', function (next) {
	if (this.date) this.period = periodOf(this.date);
	this.moldNo = normalizeMold(this.moldNo);
	next();
});

module.exports = mongoose.model('StrippingEntry', schema);
