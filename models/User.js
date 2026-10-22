const mongoose = require('mongoose');
const { ROLES, AREAS, TEAMS } = require('../config/constants');

const userSchema = new mongoose.Schema({
	fullName: {
		type: String,
		required: [true, 'Full name is required'],
		trim: true,
		maxlength: 80
	},
	// Login uses a username only (no email). Stored in lowercase so "Bader" and "bader" are the same account
	username: {
		type: String,
		required: [true, 'Username is required'],
		unique: true,
		lowercase: true,
		trim: true,
		match: [/^[a-z0-9._-]{3,30}$/, 'Username must be 3-30 characters: letters, numbers, dot, dash or underscore']
	},
	password: {
		type: String,
		required: [true, 'Password is required']
	},
	role: {
		type: String,
		enum: Object.values(ROLES),
		required: true
	},
	// The Assistant Team Leader and Manager / Staff belong to one team, for example YC Team D (area "YC", team "D")
	area: {
		type: String,
		enum: { values: AREAS, message: 'Choose YA, YB or YC.' },
		required: [function () { return this.role !== ROLES.ADMIN; }, 'Choose the area (YA, YB or YC).']
	},
	team: {
		type: String,
		enum: { values: TEAMS, message: 'Choose Team A, B, C or D.' },
		required: [function () { return this.role !== ROLES.ADMIN; }, 'Choose the team (A, B, C or D).']
	},
	isActive: {
		type: Boolean,
		default: true
	}
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
