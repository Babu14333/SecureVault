const { v4: uuidv4 } = require('uuid');
const otpService = require('./service');
const response = require('../utils/response');
const logger = require('../utils/logger');
const { supabase } = require('../config/supabase');

const otpController = {
  /**
   * POST /api/otp/send
   * Body: { userId?, type, targetPhone, refId? }
   * Authenticated endpoint — for suspicious_login the userId comes from req.body.
   * For share_access this can be called without a token.
   */
  async send(req, res) {
    try {
      const { userId, type, targetPhone, refId } = req.body;

      if (!type || !targetPhone) {
        return response.error(res, 'type and targetPhone are required', 400);
      }

      const allowedTypes = ['suspicious_login', 'share_access', 'phone_verification'];
      if (!allowedTypes.includes(type)) {
        return response.error(res, 'Invalid OTP type', 400);
      }

      const result = await otpService.generateAndSendOTP({
        userId: userId || null,
        type,
        targetPhone,
        refId: refId || null,
      });

      return response.success(res, {
        maskedPhone: result.maskedPhone,
        expiresIn: 300, // seconds
        resendCooldown: 60,
      }, 'Verification code sent');
    } catch (err) {
      logger.error('OTP send controller error', { error: err.message });
      return response.error(res, err.message || 'Failed to send verification code', 500);
    }
  },

  /**
   * POST /api/otp/verify
   * Body: { userId?, otpCode, type, refId? }
   */
  async verify(req, res) {
    try {
      const { userId, otpCode, type, refId } = req.body;

      if (!otpCode || !type) {
        return response.error(res, 'otpCode and type are required', 400);
      }

      const result = await otpService.verifyOTP({
        userId: userId || null,
        otpCode,
        type,
        refId: refId || null,
      });

      if (!result.success) {
        const messages = {
          expired: 'Verification code has expired. Please request a new one.',
          locked: 'Too many failed attempts. Please request a new code.',
          invalid: `Invalid verification code.${result.attemptsLeft != null ? ` ${result.attemptsLeft} attempt(s) remaining.` : ''}`,
        };
        return response.error(res, messages[result.reason] || 'Verification failed', 400);
      }

      return response.success(res, { verified: true }, 'Code verified successfully');
    } catch (err) {
      logger.error('OTP verify controller error', { error: err.message });
      return response.error(res, err.message || 'Verification failed', 500);
    }
  },

  /**
   * POST /api/otp/resend
   * Body: { userId?, type, targetPhone, refId? }
   */
  async resend(req, res) {
    try {
      const { userId, type, targetPhone, refId } = req.body;

      if (!type || !targetPhone) {
        return response.error(res, 'type and targetPhone are required', 400);
      }

      const result = await otpService.resendOTP({
        userId: userId || null,
        type,
        targetPhone,
        refId: refId || null,
      });

      return response.success(res, {
        maskedPhone: result.maskedPhone,
        expiresIn: 300,
        resendCooldown: 60,
      }, 'New verification code sent');
    } catch (err) {
      // Cooldown error has a special code
      if (err.code === 'COOLDOWN') {
        return response.error(res, err.message, 429);
      }
      logger.error('OTP resend controller error', { error: err.message });
      return response.error(res, err.message || 'Failed to resend code', 500);
    }
  },
};

module.exports = otpController;
