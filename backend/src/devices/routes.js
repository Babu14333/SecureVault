const express = require('express');
const devicesController = require('./controller');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// All device routes require authentication
router.get('/', authenticate, devicesController.getDevices);
router.delete('/:id', authenticate, devicesController.removeDevice);
router.put('/:id/trust', authenticate, devicesController.trustDevice);

module.exports = router;
