const mongoose = require('mongoose');
const { ALL_LINES, DOWNTIME_GROUPS } = require('../config/constants');
const { periodField, canonicalDowntimeItem, teamField } = require('./shared');

// One row = minutes lost on one line because of one item (a machine part or a cause)
const schema = new mongoose.Schema({
	teamKey: teamField,
	period: periodField,
	group: { type: String, enum: Object.keys(DOWNTIME_GROUPS), required: true },
	item: { type: String, required: [true, 'Item is required'], trim: true, maxlength: 80 },
	line: { type: String, enum: ALL_LINES, required: true },
	minutes: { type: Number, required: [true, 'Minutes is required'], min: [1, 'Minutes must be at least 1'], max: 100000 },
	remarks: { type: String, trim: true, default: '', maxlength: 300 }
}, { timestamps: true });

schema.pre('validate', function (next) {
	this.item = canonicalDowntimeItem(this.group, this.item);
	next();
});

module.exports = mongoose.model('DowntimeEntry', schema);
