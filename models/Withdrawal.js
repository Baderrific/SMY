const mongoose = require('mongoose');
const { dateField, periodField, periodOf, teamField } = require('./shared');

// One row = one item the assistant team leader recorded as withdrawn
const schema = new mongoose.Schema({
	teamKey: teamField,
	period: periodField,
	name: { type: String, required: [true, 'Item name is required'], trim: true, maxlength: 120 },
	materialNo: { type: String, required: [true, 'Material number is required'], trim: true, maxlength: 40 },
	pcs: { type: Number, required: [true, 'Pcs is required'], min: [1, 'Pcs must be at least 1'], validate: { validator: Number.isInteger, message: 'Pcs must be a whole number' } },
	date: dateField,
	midNo: { type: String, required: [true, 'MID number is required'], trim: true, maxlength: 40 },
	createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

schema.pre('validate', function (next) {
	if (this.date) this.period = periodOf(this.date);
	next();
});

module.exports = mongoose.model('Withdrawal', schema);
