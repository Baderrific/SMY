const mongoose = require('mongoose');
const { SWAB_ITEMS } = require('../config/constants');
const { periodField, teamField } = require('./shared');

// Swabstick (by size) and TC100 hot-end coating: what came in, what is left, and what was used in the month
const schema = new mongoose.Schema({
	teamKey: teamField,
	period: periodField,
	item: { type: String, enum: SWAB_ITEMS, required: true },
	received: { type: Number, min: 0, default: 0 },
	available: { type: Number, min: 0, default: 0 },
	consumed: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

schema.index({ teamKey: 1, period: 1, item: 1 }, { unique: true });

module.exports = mongoose.model('SwabstickRecord', schema);
