const express = require('express');
const c = require('../controllers/userController');
const { verify, allow, loginLimiter, wrap } = require('../auth');
const { ROLES } = require('../config/constants');

const router = express.Router();

// There is no register route on purpose: only the admin can create accounts
router.post('/login', loginLimiter, wrap(c.login));
router.get('/details', verify, wrap(c.getProfile));

router.get('/', verify, allow(ROLES.ADMIN), wrap(c.listUsers));
router.post('/', verify, allow(ROLES.ADMIN), wrap(c.createUser));
router.patch('/:id', verify, allow(ROLES.ADMIN), wrap(c.updateUser));
router.patch('/:id/password', verify, allow(ROLES.ADMIN), wrap(c.resetPassword));
router.delete('/:id', verify, allow(ROLES.ADMIN), wrap(c.deleteUser));

module.exports = router;
