const express = require('express');
const adminController = require('./controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and admin privileges
router.use(authenticate, authorize('admin', 'security_admin', 'storage_admin', 'audit_admin'));

// 1. SOC Overview & Live Telemetry Stream
router.get('/overview', adminController.getSecurityOverview);
router.get('/live-stream', adminController.getLiveSecurityStream);
router.get('/analytics', adminController.getSecurityOverview);

// 2. User Risk Governance & Sessions
router.get('/users', adminController.getUsersMonitoring);
router.get('/users/monitoring', adminController.getUsersMonitoring);
router.get('/users/:userId/sessions', adminController.getUserSessions);
router.post('/users/:userId/revoke-sessions', adminController.revokeUserSessions);
router.put('/users/:userId/role', adminController.updateUserRole);
router.post('/users/:userId/suspend', adminController.suspendUser);
router.delete('/users/:userId', adminController.deleteUser);

// 3. File & Integrity Monitoring
router.get('/files/monitoring', adminController.getFilesMonitoring);
router.post('/files/:fileId/revoke-sharing', adminController.revokeFileSharing);

// 4. Threat Center & Incident Investigation
router.get('/security-alerts', adminController.getSecurityAlerts);
router.put('/security-alerts/:alertId/status', adminController.updateAlertStatus);
router.get('/incidents/:alertId', adminController.getIncidentInvestigation);
router.post('/incidents/:alertId/remediate', adminController.remediateIncident);

// 5. Secure Sharing Governance
router.get('/sharing', adminController.getSharingManagement);
router.post('/sharing/:linkId/revoke', adminController.revokeSharedLink);

// 6. Access Logs (SIEM Audit Trail)
router.get('/access-logs', adminController.getAccessLogs);

// 7. Security Policies Engine
router.get('/policies', adminController.getSecurityPolicies);
router.put('/policies', adminController.updateSecurityPolicies);

module.exports = router;
