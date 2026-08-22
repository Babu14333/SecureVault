const express = require('express');
const { body } = require('express-validator');
const authController = require('./controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const router = express.Router();

router.get('/check-admin', authController.checkAdminExists);

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('fullName').trim().notEmpty().withMessage('Full name required'),
    body('phone').optional().isMobilePhone(),
    validate,
  ],
  authController.register
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    validate,
  ],
  authController.login
);

router.post(
  '/verify-otp',
  [
    body('userId').notEmpty(),
    body('otp').isLength({ min: 6, max: 6 }),
    body('type').isIn(['email_verification', 'phone_verification', 'login', 'download']),
    validate,
  ],
  authController.verifyOTP
);

router.post(
  '/resend-otp',
  [
    body('userId').notEmpty().isUUID().withMessage('Valid userId required'),
    validate,
  ],
  authController.resendOTP
);

router.post(
  '/refresh',
  [body('refreshToken').notEmpty(), validate],
  authController.refreshToken
);

router.post('/logout', authenticate, authController.logout);
router.post('/request-password-otp', authenticate, authController.requestPasswordOTP);
router.put(
  '/change-password',
  authenticate,
  [
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
    body('oldPassword').optional().isString(),
    body('otpCode').optional().isString(),
    validate,
  ],
  authController.changePassword
);
router.get('/profile', authenticate, authController.getProfile);
router.post('/two-factor', authenticate, authController.toggleTwoFactor);
router.post('/delete-account', authenticate, authController.deleteAccount);

// Verify OTP after suspicious login — no auth token yet, so no authenticate middleware
router.post(
  '/verify-login-otp',
  [
    body('userId').notEmpty().isUUID().withMessage('Valid userId required'),
    body('otpCode').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
    body('deviceId').optional().isUUID(),
    body('trustDevice').optional().isBoolean(),
    validate,
  ],
  authController.verifyLoginOTP
);

router.post(
  '/forgot-password/request',
  [
    body('email')
      .optional()
      .isEmail()
      .withMessage('Valid email address is required'),
    validate,
  ],
  authController.forgotPasswordRequest
);

router.post(
  '/forgot-password/verify',
  [
    body('userId').notEmpty().isUUID().withMessage('Valid userId required'),
    body('otpCode').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
    validate
  ],
  authController.forgotPasswordVerify
);

router.post(
  '/forgot-password/reset',
  [
    body('userId').notEmpty().isUUID().withMessage('Valid userId required'),
    body('resetToken').notEmpty().withMessage('Reset token is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
    validate
  ],
  authController.forgotPasswordReset
);

module.exports = router;

