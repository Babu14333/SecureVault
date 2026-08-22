const express = require('express');
const securityController = require('./controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/logs', authenticate, securityController.getLogs);
router.get('/alerts', authenticate, securityController.getAlerts);
router.get('/sessions', authenticate, securityController.getSessions);
router.delete('/sessions/:sessionId', authenticate, securityController.terminateSession);

module.exports = router;
