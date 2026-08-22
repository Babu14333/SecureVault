const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const sharingController = require('./controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Rate limiter for public share OTP requests to prevent abuse
const shareOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  message: { success: false, message: 'Too many OTP requests for this link. Try again later.' },
});

router.post(
  '/create',
  authenticate,
  [
    body('fileId').notEmpty().withMessage('File ID required'),
    body('expiresIn').optional({ checkFalsy: true }).isInt({ min: 1 }),
    body('maxDownloads').optional({ checkFalsy: true }).isInt({ min: 1 }),
    body('password').optional({ checkFalsy: true }).isLength({ min: 1 }),
    body('requireOtp').optional({ checkFalsy: true }).isBoolean(),
    validate,
  ],
  sharingController.createLink
);

// Public: request OTP to access an OTP-protected share link
router.post(
  '/request-otp/:token',
  shareOtpLimiter,
  sharingController.requestShareOTP
);

router.post('/verify/:token', sharingController.verifyLink);
router.get('/download/:token', sharingController.downloadLink);
router.get('/view/:token', sharingController.viewLink);
router.get('/', authenticate, sharingController.getLinks);
router.put('/:id/toggle', authenticate, sharingController.toggleLink);

module.exports = router;

