const mongoose = require('mongoose');
const { LEAVE_CODES } = require('../config/constants');
const { periodField, teamField } = require('./shared');

// Each leave code is a number of days (for example VL: 10)
const leaves = {};
Object.keys(LEAVE_CODES).forEach(code => { leaves[code] = { type: Number, min: 0, default: 0 }; });

// One row = one team member for one month: attendance codes and overtime hours
const schema = new mongoose.Schema({
	teamKey: teamField,
	period: periodField,
	name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 60 },
	leaves: { type: new mongoose.Schema(leaves, { _id: false }), default: () => ({}) },
	otFirstHalf: { type: Number, min: 0, default: 0 },
	otSecondHalf: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

schema.index({ teamKey: 1, period: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('PersonnelRecord', schema);
