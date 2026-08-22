const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const otpController = require('./controller');
const { validate } = require('../middleware/validation');

const router = express.Router();

// Strict rate limiter for OTP endpoints to prevent SMS bombing
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 OTP requests per IP per 15 min
  message: { success: false, message: 'Too many OTP requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many verification attempts.' },
});

router.post(
  '/send',
  otpLimiter,
  [
    body('type')
      .isIn(['suspicious_login', 'share_access', 'phone_verification'])
      .withMessage('Invalid OTP type'),
    body('targetPhone')
      .notEmpty()
      .withMessage('Target phone number is required'),
    body('userId').optional().isUUID(),
    body('refId').optional().isUUID(),
    validate,
  ],
  otpController.send
);

router.post(
  '/verify',
  otpVerifyLimiter,
  [
    body('otpCode')
      .isLength({ min: 6, max: 6 })
      .isNumeric()
      .withMessage('OTP must be a 6-digit number'),
    body('type')
      .isIn(['suspicious_login', 'share_access', 'phone_verification'])
      .withMessage('Invalid OTP type'),
    body('userId').optional().isUUID(),
    body('refId').optional().isUUID(),
    validate,
  ],
  otpController.verify
);

router.post(
  '/resend',
  otpLimiter,
  [
    body('type')
      .isIn(['suspicious_login', 'share_access', 'phone_verification'])
      .withMessage('Invalid OTP type'),
    body('targetPhone')
      .notEmpty()
      .withMessage('Target phone number is required'),
    body('userId').optional().isUUID(),
    body('refId').optional().isUUID(),
    validate,
  ],
  otpController.resend
);

module.exports = router;
