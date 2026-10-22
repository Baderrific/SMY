const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../auth');
const { ROLES, AREAS, TEAMS } = require('../config/constants');

const CREATABLE_ROLES = [ROLES.ATL, ROLES.MANAGER];
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10); // so a wrong username takes as long as a wrong password

const publicUser = (u) => ({
	_id: u._id, fullName: u.fullName, username: u.username, role: u.role, isActive: u.isActive, createdAt: u.createdAt,
	area: u.area || null, team: u.team || null, teamKey: u.area && u.team ? `${u.area}-${u.team}` : null
});

// Each team (for example YC Team D) has exactly one Assistant Team Leader account
async function atlTaken(area, team, exceptId) {
	const other = await User.findOne({ role: ROLES.ATL, area, team });
	return Boolean(other && String(other._id) !== String(exceptId));
}

// POST /users/login  { username, password }
module.exports.login = async (req, res) => {
	const username = String(req.body.username || '').trim().toLowerCase();
	const password = String(req.body.password || '');

	if (!username || !password) {
		return res.status(400).send({ error: 'Enter your username and password.' });
	}

	const user = await User.findOne({ username });
	const ok = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);

	if (!user || !ok || !user.isActive) {
		return res.status(401).send({ error: 'Username or password is incorrect.' });
	}

	return res.status(200).send({ access: auth.createAccessToken(user), user: publicUser(user) });
};

// GET /users/details
module.exports.getProfile = async (req, res) => {
	const user = await User.findById(req.user.id);
	return res.status(200).send({ user: publicUser(user) });
};

// ----- Admin only: there is no public registration, the admin creates every account -----

module.exports.listUsers = async (req, res) => {
	const users = await User.find({}).sort({ area: 1, team: 1, role: 1, fullName: 1 });
	return res.status(200).send({ users: users.map(publicUser) });
};

module.exports.createUser = async (req, res) => {
	const { fullName, username, password, role, area, team } = req.body;

	if (!CREATABLE_ROLES.includes(role)) {
		return res.status(400).send({ error: 'Choose Assistant Team Leader or Manager / Staff.' });
	}
	if (typeof password !== 'string' || password.length < 8) {
		return res.status(400).send({ error: 'Password must be at least 8 characters.' });
	}

	if (!AREAS.includes(area)) return res.status(400).send({ error: 'Choose the area: YA, YB or YC.' });
	if (!TEAMS.includes(team)) return res.status(400).send({ error: 'Choose the team: A, B, C or D.' });
	if (role === ROLES.ATL && await atlTaken(area, team)) {
		return res.status(409).send({ error: `${area} Team ${team} already has an Assistant Team Leader account.` });
	}

	const exists = await User.findOne({ username: String(username || '').trim().toLowerCase() });
	if (exists) {
		return res.status(409).send({ error: 'That username is already taken.' });
	}

	const user = await User.create({ fullName, username, role, area, team, password: await bcrypt.hash(password, 10) });
	return res.status(201).send({ message: 'Account created.', user: publicUser(user) });
};

// Loads the target account and makes sure the admin cannot change the admin account here
async function findManageable(req, res) {
	const user = await User.findById(req.params.id);
	if (!user) { res.status(404).send({ error: 'Account not found.' }); return null; }
	if (user.role === ROLES.ADMIN) { res.status(403).send({ error: 'The admin account cannot be changed here.' }); return null; }
	return user;
}

module.exports.updateUser = async (req, res) => {
	const user = await findManageable(req, res);
	if (!user) return;

	if (req.body.role !== undefined) {
		if (!CREATABLE_ROLES.includes(req.body.role)) return res.status(400).send({ error: 'Invalid role.' });
		user.role = req.body.role;
	}
	if (req.body.area !== undefined) user.area = req.body.area;
	if (req.body.team !== undefined) user.team = req.body.team;
	if (user.role === ROLES.ATL && (req.body.role !== undefined || req.body.area !== undefined || req.body.team !== undefined) && await atlTaken(user.area, user.team, user._id)) {
		return res.status(409).send({ error: `${user.area} Team ${user.team} already has an Assistant Team Leader account.` });
	}
	if (req.body.fullName !== undefined) user.fullName = req.body.fullName;
	if (req.body.isActive !== undefined) user.isActive = Boolean(req.body.isActive);

	await user.save();
	return res.status(200).send({ message: 'Account updated.', user: publicUser(user) });
};

module.exports.resetPassword = async (req, res) => {
	const user = await findManageable(req, res);
	if (!user) return;

	const { newPassword } = req.body;
	if (typeof newPassword !== 'string' || newPassword.length < 8) {
		return res.status(400).send({ error: 'Password must be at least 8 characters.' });
	}

	user.password = await bcrypt.hash(newPassword, 10);
	await user.save();
	return res.status(200).send({ message: 'Password changed.' });
};

module.exports.deleteUser = async (req, res) => {
	const user = await findManageable(req, res);
	if (!user) return;

	await User.findByIdAndDelete(user._id);
	return res.status(200).send({ message: 'Account deleted.' });
};

// Creates the single admin account the first time the server starts (if none exists yet)
module.exports.bootstrapAdmin = async () => {
	const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
	if (await User.countDocuments({ role: ROLES.ADMIN })) return;

	if (!ADMIN_USERNAME || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
		console.warn('No admin account exists. Set ADMIN_USERNAME and ADMIN_PASSWORD (8+ characters) in server/.env and restart.');
		return;
	}

	await User.create({ fullName: 'Administrator', username: ADMIN_USERNAME, role: ROLES.ADMIN, password: await bcrypt.hash(ADMIN_PASSWORD, 10) });
	console.log(`Admin account "${ADMIN_USERNAME.toLowerCase()}" created.`);
};
