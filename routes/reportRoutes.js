const express = require('express');
const s = require('../controllers/sectionControllers');
const { verify, allow, needTeam, wrap } = require('../auth');
const { ROLES } = require('../config/constants');

const router = express.Router();

// Dashboards are for the Assistant Team Leader and the Manager / Staff only (the admin only manages accounts).
// Only the Assistant Team Leader can add, change or delete data.
// Everything is limited to the user's own team (needTeam), for example YC Team D.
const view = [verify, allow(ROLES.ATL, ROLES.MANAGER), needTeam];
const edit = [verify, allow(ROLES.ATL), needTeam];

router.get('/periods', ...view, wrap(s.periods));
router.get('/summary/year/:year', ...view, wrap(s.yearSummary));
router.get('/summary/:period', ...view, wrap(s.summary));
router.get('/settings/:period', ...view, wrap(s.getMeta));
router.put('/settings/:period', ...edit, wrap(s.saveMeta));

router.get('/efficiency', ...view, wrap(s.efficiencyList));
router.put('/efficiency/day', ...edit, wrap(s.efficiencySaveDay));
router.delete('/efficiency/:id', ...edit, wrap(s.efficiencyRemove));

for (const [path, ctrl] of [['stripping', s.stripping], ['downtime', s.downtime], ['personnel', s.personnel], ['withdrawals', s.withdrawals]]) {
	router.get(`/${path}`, ...view, wrap(ctrl.list));
	router.post(`/${path}`, ...edit, wrap(ctrl.create));
	router.patch(`/${path}/:id`, ...edit, wrap(ctrl.update));
	router.delete(`/${path}/:id`, ...edit, wrap(ctrl.remove));
}
router.post('/personnel/copy', ...edit, wrap(s.personnelCopy));

router.get('/swabstick', ...view, wrap(s.swabList));
router.put('/swabstick', ...edit, wrap(s.swabSave));

router.get('/audits', ...view, wrap(s.auditList));
router.post('/audits', ...edit, wrap(s.auditStart));
router.put('/audits/:id', ...edit, wrap(s.auditSave));
router.delete('/audits/:id', ...edit, wrap(s.auditRemove));

module.exports = router;
