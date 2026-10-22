// Small helpers shared by the models and controllers
const { DOWNTIME_ITEMS, TEAM_KEY_RE } = require('../config/constants');

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;          // 2026-01
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/; // 2026-01-31

// true only for real calendar dates (so 2026-02-30 is rejected)
function isRealDate(value) {
	if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
	const [y, m, d] = value.split('-').map(Number);
	const date = new Date(Date.UTC(y, m - 1, d));
	return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// Dates are stored as "YYYY-MM-DD" text so time zones can never move a date to another day
const periodOf = (date) => String(date).slice(0, 7);

// Mold numbers are written like "M3354". If the user types only the digits, we add the "M"
function normalizeMold(value) {
	const text = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
	return /^\d+$/.test(text) ? `M${text}` : text;
}

// Use the official spelling of a downtime item when the typed one matches (ignoring capital letters)
function canonicalDowntimeItem(group, value) {
	const text = String(value || '').trim();
	const found = (DOWNTIME_ITEMS[group] || []).find(item => item.toLowerCase() === text.toLowerCase());
	return found || text;
}

const dateField = {
	type: String,
	required: [true, 'Date is required'],
	validate: { validator: isRealDate, message: 'Date must be a real date (YYYY-MM-DD)' }
};

const periodField = {
	type: String,
	required: true,
	match: [PERIOD_RE, 'Period must look like 2026-01'],
	index: true
};

// Every record belongs to one team, for example "YC-D", so teams never see each other's data
const teamField = { type: String, required: true, match: TEAM_KEY_RE, index: true };

module.exports = { teamField, PERIOD_RE, DATE_RE, isRealDate, periodOf, normalizeMold, canonicalDowntimeItem, dateField, periodField };
