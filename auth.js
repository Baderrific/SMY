const jwt = require('jsonwebtoken');
require('dotenv').config();
const User = require('./models/User');

module.exports.createAccessToken = (user) => {
	const data = { id: user._id, username: user.username, role: user.role };
	return jwt.sign(data, process.env.JWT_SECRET_KEY, { expiresIn: '12h' });
};

// Checks the Bearer token, then loads the user so a deactivated account is blocked right away
module.exports.verify = async (req, res, next) => {
	const header = req.headers.authorization;

	if (!header || !header.startsWith('Bearer ')) {
		return res.status(401).send({ auth: 'Failed', message: 'Please log in.' });
	}

	try {
		const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET_KEY);
		const user = await User.findById(decoded.id);

		if (!user || !user.isActive) {
			return res.status(401).send({ auth: 'Failed', message: 'This account is no longer active.' });
		}

		req.user = {
			id: String(user._id), username: user.username, fullName: user.fullName, role: user.role,
			area: user.area || null, team: user.team || null,
			teamKey: user.area && user.team ? `${user.area}-${user.team}` : null   // for example "YC-D"
		};
		next();
	} catch (err) {
		return res.status(401).send({ auth: 'Failed', message: 'Your session expired. Please log in again.' });
	}
};

// allow('atl', 'manager') lets only those roles through. Use it after verify.
module.exports.allow = (...roles) => (req, res, next) => {
	if (req.user && roles.includes(req.user.role)) return next();
	return res.status(403).send({ auth: 'Failed', message: 'You do not have access to this action.' });
};

// Dashboard data always belongs to the user's team, so an account without a team cannot use it
module.exports.needTeam = (req, res, next) => {
	if (req.user && req.user.teamKey) return next();
	return res.status(403).send({ auth: 'Failed', message: 'This account has no team yet. Ask the admin to set it.' });
};

// Stops password guessing: 8 wrong logins per 15 minutes for the same address + username
const attempts = new Map();
module.exports.loginLimiter = (req, res, next) => {
	const key = `${req.ip}|${String((req.body && req.body.username) || '').toLowerCase()}`;
	const now = Date.now();
	const entry = attempts.get(key);

	if (entry && now - entry.first < 15 * 60 * 1000 && entry.count >= 8) {
		return res.status(429).send({ error: 'Too many login attempts. Try again in a few minutes.' });
	}

	res.on('finish', () => {
		const current = attempts.get(key);
		if (res.statusCode === 401) {
			if (!current || now - current.first >= 15 * 60 * 1000) attempts.set(key, { first: now, count: 1 });
			else current.count += 1;
		} else if (res.statusCode === 200) {
			attempts.delete(key);
		}
	});
	next();
};

module.exports.errorHandler = (err, req, res, next) => {
	// Mongoose validation errors become a readable 400 message
	if (err.name === 'ValidationError') {
		const message = Object.values(err.errors).map(e => e.message).join('. ');
		return res.status(400).send({ error: message });
	}
	if (err.name === 'CastError') {
		return res.status(400).send({ error: 'Invalid value or id.' });
	}
	if (err.code === 11000) {
		return res.status(409).send({ error: 'This record already exists.' });
	}
	if (!err.status) console.error(err); // only unexpected errors are logged
	res.status(err.status || 500).send({ error: err.status ? err.message : 'Internal Server Error' });
};

// Lets controllers write async code without try/catch in every function
module.exports.wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
