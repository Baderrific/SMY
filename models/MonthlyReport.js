const mongoose = require('mongoose');
const { PERIOD_RE, teamField } = require('./shared');

const signer = new mongoose.Schema({ name: { type: String, trim: true, default: '' }, title: { type: String, trim: true, default: '' } }, { _id: false });

// One document per month: the settings and the written parts of the monthly report
const monthlyReportSchema = new mongoose.Schema({
	teamKey: teamField,
	period: { type: String, required: true, match: PERIOD_RE },
	effTarget: { type: Number, min: 0, max: 120, default: 94.5 },
	// Efficiency average = sum of counted days / number of counted days.
	// If the team used a different number of days (for example 19.8), type it here per line. Empty = automatic.
	daysOverride: {
		YC1: { type: Number, min: 0.1, default: null },
		YC2: { type: Number, min: 0.1, default: null },
		YC3: { type: Number, min: 0.1, default: null },
		YC4: { type: Number, min: 0.1, default: null }
	},
	// The attendance / overtime cut-off, for example 2025-12-16 to 2026-01-15
	cutoffStart: { type: String, default: '' },
	cutoffEnd: { type: String, default: '' },
	accomplishments: { type: [String], default: [] },
	to: { type: String, trim: true, default: '' },
	from: { type: String, trim: true, default: '' },
	preparedBy: { type: signer, default: () => ({}) },
	checkedBy: { type: signer, default: () => ({}) }
}, { timestamps: true });

monthlyReportSchema.index({ teamKey: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('MonthlyReport', monthlyReportSchema);
