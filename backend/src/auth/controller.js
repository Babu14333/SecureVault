const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');
const config = require('../config');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');
const encryption = require('../utils/encryption');
const otpService = require('../otp/service');
const deviceService = require('../devices/service');
const response = require('../utils/response');
const logger = require('../utils/logger');
const scoreService = require('../security/scoreService');


const ADMIN_EMAIL = 'nagababuy92@gmail.com';

const authController = {
  /**
   * Check if at least one admin exists in the database
   */
  async checkAdminExists(req, res) {
    try {
      return response.success(res, { hasAdmin: true });
    } catch (error) {
      logger.error('Failed to check admin status', { error: error.message });
      return response.error(res, 'Failed to verify admin configuration', 500);
    }
  },

  /**
   * Register a new user
   */
  async register(req, res) {
    try {
      const { email, password, fullName, phone } = req.body;
      const cleanEmail = (email || '').trim().toLowerCase();

      // Check if user exists
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id, email, is_verified, full_name, role')
        .ilike('email', cleanEmail);

      const userRole = cleanEmail === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user';

      if (existingUsers && existingUsers.length > 0) {
        const existing = existingUsers[0];
        if (existing.is_verified) {
          return response.error(res, 'Email already registered. Please sign in.', 409);
        }

        // Account created but unverified -> update credentials and re-send dynamic Gmail OTP
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(password, salt);
        await supabase
          .from('users')
          .update({
            password_hash: passwordHash,
            full_name: fullName,
            role: userRole,
          })
          .eq('id', existing.id);

        const otpResult = await otpService.generateAndSendEmailOTP({
          userId: existing.id,
          type: 'email_verification',
          targetEmail: cleanEmail,
        });

        logger.info('Unverified account registration re-triggered Gmail OTP', { userId: existing.id, email: cleanEmail });

        return response.success(res, {
          user: { id: existing.id, email: cleanEmail, full_name: fullName, role: userRole },
          requiresOtp: true,
          userId: existing.id,
          maskedEmail: otpResult.maskedEmail,
          reason: 'email_verification',
          message: 'Verification code sent to your registered Gmail address',
        }, 'Registration successful', 200);
      }

      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(password, salt);
      const userId = uuidv4();

      // Check for strong password usage (+5 score bonus)
      const isStrongPassword = password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
      const initialScore = isStrongPassword ? 55 : 50;

      const { data: user, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: cleanEmail,
          password_hash: passwordHash,
          full_name: fullName,
          phone: phone || null,
          role: userRole,
          is_verified: false,
          security_score: initialScore,
          storage_used: 0,
          storage_limit: 5368709120, // 5GB
          created_at: new Date().toISOString(),
        })
        .select('id, email, full_name, role')
        .single();

      if (error) throw error;

      if (isStrongPassword) {
        await supabase.from('access_logs').insert({
          id: uuidv4(),
          user_id: userId,
          action: 'security_score_increase',
          details: JSON.stringify({
            eventType: 'strong_password_usage',
            delta: 5,
            previousScore: 50,
            newScore: 55,
            message: 'User registered with a cryptographically strong password.'
          }),
          created_at: new Date().toISOString(),
        });
      }

      // Generate & send OTP to registered Gmail address
      const otpResult = await otpService.generateAndSendEmailOTP({
        userId,
        type: 'email_verification',
        targetEmail: cleanEmail,
      });

      logger.info('User registered and verification code sent to Gmail', { userId, email: cleanEmail });

      return response.success(res, {
        user,
        requiresOtp: true,
        userId,
        maskedEmail: otpResult.maskedEmail,
        reason: 'email_verification',
        message: 'Verification code sent to your registered Gmail address',
      }, 'Registration successful', 201);
    } catch (error) {
      logger.error('Registration failed', { error: error.message });
      return response.error(res, 'Registration failed', 500);
    }
  },

  /**
   * Login — with suspicious device / new device OTP protection
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const cleanEmail = (email || '').trim().toLowerCase();
      const userAgent = req.headers['user-agent'] || 'unknown';
      const ipAddress = req.ip || req.connection.remoteAddress;

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', cleanEmail)
        .single();

      if (error || !user) {
        await supabase.from('access_logs').insert({
          id: uuidv4(),
          action: 'login_failed',
          ip_address: ipAddress,
          user_agent: userAgent,
          details: JSON.stringify({ email }),
          created_at: new Date().toISOString(),
        });
        return response.error(res, 'No account found with this email. Please create an account.', 401);
      }

      if (user.is_suspended) {
        return response.error(res, 'Account suspended. Contact support.', 403);
      }

      const isValid = await bcrypt.compare(password, user.password_hash);
      if (!isValid) {
        await supabase.from('access_logs').insert({
          id: uuidv4(),
          user_id: user.id,
          action: 'login_failed',
          ip_address: ipAddress,
          user_agent: userAgent,
          details: JSON.stringify({ reason: 'invalid_password' }),
          created_at: new Date().toISOString(),
        });

        // Deduct -10 for multiple failed logins
        await scoreService.decreaseSecurityScore(user.id, 10, 'multiple_failed_logins');

        return response.error(res, 'Incorrect password. Please try again or reset it.', 401);
      }

      // Enforce role consistency for dedicated admin email
      if (cleanEmail === ADMIN_EMAIL.toLowerCase()) {
        if (user.role !== 'admin') {
          await supabase.from('users').update({ role: 'admin' }).eq('id', user.id);
          user.role = 'admin';
        }
      } else {
        if (user.role === 'admin') {
          await supabase.from('users').update({ role: 'user' }).eq('id', user.id);
          user.role = 'user';
        }
      }

      // ----------------------------------------------------------
      // Device fingerprinting
      // ----------------------------------------------------------
      const { device } = await deviceService.getOrCreateDevice(
        user.id,
        userAgent,
        ipAddress
      );

      // ----------------------------------------------------------
      // Check if user account is verified
      // Existing verified users -> Direct login without OTP
      // Newly registered unverified users -> Require dynamic Gmail OTP
      // ----------------------------------------------------------
      if (!user.is_verified) {
        try {
          const otpResult = await otpService.generateAndSendEmailOTP({
            userId: user.id,
            type: 'login_verification',
            targetEmail: user.email,
            refId: device.id,
          });

          logger.info('Account verification OTP sent to registered Gmail for unverified user', { userId: user.id, email: user.email });

          return response.success(res, {
            requiresOtp: true,
            userId: user.id,
            deviceId: device.id,
            maskedEmail: otpResult.maskedEmail,
            reason: 'login_verification',
            expiresIn: 300,
            resendCooldown: 60,
          }, 'Account verification code sent to your registered Gmail.');
        } catch (otpErr) {
          logger.error('Failed to send email OTP during login flow', {
            userId: user.id,
            error: otpErr.message,
          });
          return response.error(res, 'Failed to send verification email. Please try again.', 500);
        }
      }

      // Existing verified users -> Direct Login without OTP
      logger.info('User authenticated successfully — Direct Login without OTP', { userId: user.id, email: user.email });
      return await createAuthSession(user, device, ipAddress, userAgent, res);
    } catch (error) {
      logger.error('Login failed', { error: error.message });
      return response.error(res, 'Login failed', 500);
    }
  },

  /**
   * Verify suspicious-login OTP and complete the auth session.
   * POST /api/auth/verify-login-otp
   * Body: { userId, otpCode, deviceId, trustDevice? }
   */
  async verifyLoginOTP(req, res) {
    try {
      const { userId, otpCode, deviceId, trustDevice = false } = req.body;
      const userAgent = req.headers['user-agent'] || 'unknown';
      const ipAddress = req.ip || req.connection.remoteAddress;

      // Fetch user
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return response.error(res, 'User not found', 404);
      }

      // Verify OTP — checking all valid login/registration OTP types
      const possibleTypes = ['email_verification', 'login_verification', 'suspicious_login', '2fa_login'];
      let result = { success: false, reason: 'expired' };

      for (const type of possibleTypes) {
        result = await otpService.verifyOTP({
          userId,
          otpCode,
          type,
          refId: deviceId || null,
        });
        if (result.success) break;
      }

      // If still not matched, try matching without deviceId refId filter
      if (!result.success && deviceId) {
        for (const type of possibleTypes) {
          const fallbackResult = await otpService.verifyOTP({
            userId,
            otpCode,
            type,
            refId: null,
          });
          if (fallbackResult.success) {
            result = fallbackResult;
            break;
          }
        }
      }

      if (!result.success) {
        const messages = {
          expired: 'Verification code has expired. Please request a new one.',
          locked: 'Too many failed attempts. Please request a new code.',
          invalid: `Invalid verification code.${result.attemptsLeft != null ? ` ${result.attemptsLeft} attempt(s) remaining.` : ''}`,
        };
        
        // Deduct score for failed OTP attempt
        if (result.reason === 'expired') {
          await scoreService.decreaseSecurityScore(userId, 3, 'expired_otp_attempt');
        } else {
          await scoreService.decreaseSecurityScore(userId, 5, 'failed_otp_attempt');
        }

        return response.error(res, messages[result.reason] || 'Verification failed', 400);
      }

      // Enforce role consistency for dedicated admin email
      if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        if (user.role !== 'admin') {
          await supabase.from('users').update({ role: 'admin' }).eq('id', userId);
          user.role = 'admin';
        }
      } else {
        if (user.role === 'admin') {
          await supabase.from('users').update({ role: 'user' }).eq('id', userId);
          user.role = 'user';
        }
      }

      // Verify OTP successful - award +2 for OTP verification and mark account as verified
      await supabase.from('users').update({ is_verified: true, role: user.role }).eq('id', userId);
      user.is_verified = true;
      await scoreService.increaseSecurityScore(userId, 2, 'otp_verification');

      // Optionally mark device as trusted
      if (trustDevice && deviceId) {
        await deviceService.trustDevice(deviceId);
        // Award +3 for trusted device setup
        await scoreService.increaseSecurityScore(userId, 3, 'trusted_device_setup');
      }

      // Fetch device record to pass to session builder
      let device = { id: deviceId, is_trusted: trustDevice };

      return await createAuthSession(user, device, ipAddress, userAgent, res);
    } catch (error) {
      logger.error('Verify login OTP failed', { error: error.message });
      return response.error(res, 'Verification failed', 500);
    }
  },

  /**
   * Verify OTP
   */
  async verifyOTP(req, res) {
    try {
      const { userId, otp, type } = req.body;

      const result = await otpService.verifyOTP({
        userId,
        otpCode: otp,
        type: type || 'email_verification',
      });

      if (!result.success) {
        const messages = {
          expired: 'Verification code has expired. Please request a new one.',
          locked: 'Too many failed attempts. Please request a new code.',
          invalid: `Invalid verification code.${result.attemptsLeft != null ? ` ${result.attemptsLeft} attempt(s) remaining.` : ''}`,
        };

        if (result.reason === 'expired') {
          await scoreService.decreaseSecurityScore(userId, 3, 'expired_otp_attempt');
        } else {
          await scoreService.decreaseSecurityScore(userId, 5, 'failed_otp_attempt');
        }

        return response.error(res, messages[result.reason] || 'Invalid or expired OTP', 400);
      }

      if (type === 'email_verification') {
        await supabase
          .from('users')
          .update({ is_verified: true, security_score: 70 })
          .eq('id', userId);

        await supabase.from('access_logs').insert({
          id: uuidv4(),
          user_id: userId,
          action: 'security_score_increase',
          details: JSON.stringify({
            eventType: 'email_verification',
            delta: 20,
            previousScore: 50,
            newScore: 70,
            message: 'User email address successfully verified.'
          }),
          created_at: new Date().toISOString(),
        });
      } else {
        await scoreService.increaseSecurityScore(userId, 2, 'otp_verification');
      }

      logger.info('OTP verified', { userId, type });
      return response.success(res, null, 'OTP verified successfully');
    } catch (error) {
      logger.error('OTP verification failed', { error: error.message });
      return response.error(res, 'Verification failed', 500);
    }
  },

  /**
   * Resend dynamic Gmail OTP
   * POST /api/auth/resend-otp
   */
  async resendOTP(req, res) {
    try {
      const { userId, type = 'login_verification' } = req.body;
      if (!userId) {
        return response.error(res, 'User ID is required', 400);
      }

      const { data: user, error } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return response.error(res, 'User not found', 404);
      }

      const otpResult = await otpService.generateAndSendEmailOTP({
        userId: user.id,
        type,
        targetEmail: user.email,
      });

      logger.info('Resent dynamic OTP to Gmail', { userId: user.id, email: user.email });

      return response.success(res, {
        userId: user.id,
        maskedEmail: otpResult.maskedEmail,
        message: 'Dynamic verification code resent to your Gmail address.',
      }, 'Verification code resent successfully');
    } catch (error) {
      logger.error('Resend OTP failed', { error: error.message });
      return response.error(res, 'Failed to resend verification code', 500);
    }
  },

  /**
   * Refresh token
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      const decoded = verifyRefreshToken(refreshToken);

      // Check session
      const { data: session } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('refresh_token', refreshToken)
        .eq('is_active', true)
        .single();

      if (!session) {
        return response.error(res, 'Invalid session', 401);
      }

      const tokenPayload = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };

      const newAccessToken = generateAccessToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      // Rotate refresh token
      await supabase
        .from('user_sessions')
        .update({ refresh_token: newRefreshToken })
        .eq('id', session.id);

      return response.success(res, {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      }, 'Token refreshed');
    } catch (error) {
      return response.error(res, 'Token refresh failed', 401);
    }
  },

  /**
   * Logout
   */
  async logout(req, res) {
    try {
      const { sessionId } = req.body;
      const userId = req.user.userId;

      if (sessionId) {
        await supabase
          .from('user_sessions')
          .update({ is_active: false })
          .eq('id', sessionId)
          .eq('user_id', userId);
      }

      await supabase.from('access_logs').insert({
        id: uuidv4(),
        user_id: userId,
        action: 'logout',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        created_at: new Date().toISOString(),
      });

      logger.info('User logged out', { userId });
      return response.success(res, null, 'Logged out successfully');
    } catch (error) {
      return response.error(res, 'Logout failed', 500);
    }
  },

  /**
   * Change Password
   */
  /**
   * Request OTP for password reset when user does not know their current password
   */
  async requestPasswordOTP(req, res) {
    try {
      const userId = req.user.userId;
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return response.error(res, 'User account not found', 404);
      }

      const otpResult = await otpService.generateAndSendEmailOTP({
        userId: user.id,
        type: 'password_reset',
        targetEmail: user.email,
      });

      logger.info('Password reset OTP sent to registered email', { userId: user.id, email: user.email });

      return response.success(res, {
        maskedEmail: otpResult.maskedEmail,
        message: 'A 6-digit verification code has been sent to your registered Gmail address.',
      }, 'Verification code sent successfully');
    } catch (err) {
      logger.error('Failed to send password reset OTP', { error: err.message });
      return response.error(res, 'Failed to send verification code to your email', 500);
    }
  },

  /**
   * Change or reset password
   * Supports two authentication paths:
   * 1. Via current password (oldPassword)
   * 2. Via live email OTP verification (otpCode)
   */
  async changePassword(req, res) {
    try {
      const { oldPassword, otpCode, newPassword } = req.body;
      const userId = req.user.userId;

      if (!newPassword || newPassword.length < 8) {
        return response.error(res, 'New password must be at least 8 characters', 400);
      }

      // Get user from DB
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return response.error(res, 'User account not found', 404);
      }

      if (otpCode) {
        // Authenticate via live Email OTP
        const verifyResult = await otpService.verifyOTP({
          userId,
          otpCode: String(otpCode).trim(),
          type: 'password_reset',
        });

        if (!verifyResult.success) {
          return response.error(res, verifyResult.reason || 'Invalid or expired verification code', 400);
        }
      } else if (oldPassword) {
        // Authenticate via current password
        const isValid = await bcrypt.compare(oldPassword, user.password_hash);
        if (!isValid) {
          return response.error(res, 'Incorrect current password. If you forgot it, choose "Verify with Email OTP".', 400);
        }
      } else {
        return response.error(res, 'Please provide either your current password or verify via email OTP', 400);
      }

      const salt = await bcrypt.genSalt(12);
      const newHash = await bcrypt.hash(newPassword, salt);

      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: newHash, security_score: 85 })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Log security event
      await supabase.from('access_logs').insert({
        id: uuidv4(),
        user_id: userId,
        action: otpCode ? 'password_reset_via_otp' : 'password_change_via_current_password',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        created_at: new Date().toISOString(),
      });

      logger.info('User password successfully updated in Supabase', { userId, method: otpCode ? 'otp' : 'old_password' });
      return response.success(res, null, 'Your password has been changed successfully.');
    } catch (err) {
      logger.error('Failed to change password', { error: err.message });
      return response.error(res, err.message || 'Failed to update password', 500);
    }
  },

  async getProfile(req, res) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, full_name, phone, role, is_verified, security_score, storage_used, storage_limit, avatar_url, created_at, last_login')
        .eq('id', req.user.userId)
        .single();

      if (error || !user) {
        return response.error(res, 'User not found', 404);
      }

      let isTwoFactorEnabled = false;
      let avatar = user.avatar_url;
      if (user.avatar_url) {
        try {
          const parsed = JSON.parse(user.avatar_url);
          if (parsed && typeof parsed === 'object') {
            isTwoFactorEnabled = !!parsed.is_two_factor_enabled;
            avatar = parsed.avatar || null;
          }
        } catch (e) {
          // not JSON
        }
      }

      return response.success(res, {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        isVerified: user.is_verified,
        isTwoFactorEnabled,
        securityScore: user.security_score,
        storageUsed: user.storage_used,
        storageLimit: user.storage_limit,
        avatar,
        createdAt: user.created_at,
        lastLogin: user.last_login,
      });
    } catch (error) {
      return response.error(res, 'Failed to fetch profile', 500);
    }
  },

  /**
   * Toggle Two-Factor Authentication settings
   */
  async toggleTwoFactor(req, res) {
    try {
      const userId = req.user.userId;
      const { enabled } = req.body;

      // 1. Fetch user to verify phone registration
      const { data: user, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (fetchError || !user) {
        return response.error(res, 'User not found', 404);
      }

      if (enabled && !user.phone) {
        return response.error(res, 'A registered phone number is required to enable Two-Factor Authentication.', 400);
      }

      // 2. Store 2FA state inside avatar_url metadata column as JSON
      let settings = {};
      if (user.avatar_url) {
        try {
          settings = JSON.parse(user.avatar_url);
          if (typeof settings !== 'object' || settings === null) {
            settings = { avatar: user.avatar_url };
          }
        } catch (e) {
          settings = { avatar: user.avatar_url };
        }
      }
      settings.is_two_factor_enabled = !!enabled;

      // Update users table in db
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: JSON.stringify(settings) })
        .eq('id', userId);

      if (updateError) throw updateError;

      // 3. Security score adjustment (+10 enabled, -10 disabled)
      let updatedScore = user.security_score;
      if (enabled) {
        updatedScore = await scoreService.increaseSecurityScore(userId, 10, 'two_factor_enabled');
      } else {
        updatedScore = await scoreService.decreaseSecurityScore(userId, 10, 'two_factor_disabled');
      }

      return response.success(res, { isTwoFactorEnabled: !!enabled, securityScore: updatedScore || user.security_score }, `Two-Factor Authentication updated successfully.`);
    } catch (err) {
      logger.error('Failed to toggle two-factor', { error: err.message });
      return response.error(res, 'Failed to update Two-Factor Authentication setting', 500);
    }
  },

  /**
   * Delete user account permanently
   * POST /api/auth/delete-account
   */
  async deleteAccount(req, res) {
    try {
      const userId = req.user.userId;

      // 1. Fetch storage paths for all user files to delete them from cloud storage
      const { data: filesToDelete, error: fetchError } = await supabase
        .from('files')
        .select('storage_path')
        .eq('user_id', userId);

      if (fetchError) throw fetchError;

      if (filesToDelete && filesToDelete.length > 0) {
        const filePaths = filesToDelete.map(f => f.storage_path);
        const { error: storageError } = await supabase.storage
          .from('encrypted-files')
          .remove(filePaths);

        if (storageError) {
          logger.warn('Some encrypted files could not be purged from storage', {
            userId,
            error: storageError.message,
          });
        }
      }

      // 2. Delete the user row. Cascade constraints will clean up database records.
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (deleteError) throw deleteError;

      logger.info('User account permanently deleted', { userId });

      return response.success(res, null, 'Your account and all related data have been permanently deleted.');
    } catch (error) {
      logger.error('Account self-deletion failed', { error: error.message });
      return response.error(res, 'Failed to delete account permanently', 500);
    }
  },

  async forgotPasswordRequest(req, res) {
    try {
      const { email, phone } = req.body;
      const cleanEmail = (email || '').trim().toLowerCase();

      if (!cleanEmail && !phone) {
        return response.error(res, 'Email address is required.', 400);
      }

      let user = null;

      if (cleanEmail) {
        const { data: users, error } = await supabase
          .from('users')
          .select('id, email, phone, full_name, is_verified')
          .ilike('email', cleanEmail)
          .limit(1);

        if (error || !users || users.length === 0) {
          return response.error(res, 'This email does not exist. Please create an account.', 404);
        }
        user = users[0];
      } else if (phone) {
        const normalised = otpService.normalisePhone(phone);
        const raw = phone.replace(/[^0-9]/g, '');
        const raw10Digit = raw.length > 10 ? raw.slice(-10) : raw;

        const { data: users, error } = await supabase
          .from('users')
          .select('id, email, phone, full_name')
          .or(`phone.eq."${normalised}",phone.eq."${phone}",phone.eq."${raw}",phone.eq."${raw10Digit}"`)
          .limit(1);

        if (error || !users || users.length === 0) {
          return response.error(res, 'No account registered with this phone number.', 404);
        }
        user = users[0];
      }

      // Generate and send live 6-digit OTP to user's registered Gmail address
      const otpResult = await otpService.generateAndSendEmailOTP({
        userId: user.id,
        type: 'forgot_password',
        targetEmail: user.email,
      });

      logger.info('Forgot password live OTP generated and sent to email', { userId: user.id, email: user.email });

      return response.success(res, {
        userId: user.id,
        maskedEmail: otpResult.maskedEmail,
        maskedPhone: otpResult.maskedPhone,
      }, 'Verification code sent to your registered Gmail address.');
    } catch (err) {
      logger.error('Forgot password request failed', { error: err.message });
      return response.error(res, err.message || 'Failed to initiate forgot password flow', 500);
    }
  },

  async forgotPasswordVerify(req, res) {
    try {
      const { userId, otpCode } = req.body;

      const verifyResult = await otpService.verifyOTP({
        userId,
        otpCode,
        type: 'forgot_password',
      });

      if (!verifyResult.success) {
        let errorMsg = 'Invalid verification code.';
        if (verifyResult.reason === 'expired') errorMsg = 'Verification code has expired.';
        if (verifyResult.reason === 'locked') errorMsg = 'Account locked due to too many failed attempts. Please request a new code.';
        return response.error(res, errorMsg, 400);
      }

      const resetToken = jwt.sign(
        { userId, purpose: 'password_reset' },
        config.jwt.secret,
        { expiresIn: '10m' }
      );

      logger.info('Forgot password OTP verified successfully', { userId });

      return response.success(res, {
        userId,
        resetToken,
      }, 'OTP verified. You can now reset your password.');
    } catch (err) {
      logger.error('Forgot password OTP verification failed', { error: err.message });
      return response.error(res, 'Verification failed. Please try again.', 500);
    }
  },

  async forgotPasswordReset(req, res) {
    try {
      const { userId, resetToken, newPassword } = req.body;

      let decoded;
      try {
        decoded = jwt.verify(resetToken, config.jwt.secret);
      } catch (tokenErr) {
        return response.error(res, 'Reset token has expired or is invalid. Please request a new OTP.', 401);
      }

      if (decoded.userId !== userId || decoded.purpose !== 'password_reset') {
        return response.error(res, 'Invalid reset session details.', 400);
      }

      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: passwordHash, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) throw updateError;

      await supabase.from('user_sessions').update({ is_active: false }).eq('user_id', userId);

      logger.info('User password reset successfully', { userId });

      return response.success(res, null, 'Your password has been successfully updated. You can now sign in.');
    } catch (err) {
      logger.error('Forgot password reset failed', { error: err.message });
      return response.error(res, 'Failed to reset password. Please try again.', 500);
    }
  },
};

// ---------------------------------------------------------------------------
// Shared helper: create a full auth session and return tokens
// Called by both login() and verifyLoginOTP()
// ---------------------------------------------------------------------------
async function createAuthSession(user, device, ipAddress, userAgent, res) {
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  const sessionId = uuidv4();
  await supabase.from('user_sessions').insert({
    id: sessionId,
    user_id: user.id,
    refresh_token: refreshToken,
    device_info: userAgent,
    ip_address: ipAddress,
    is_active: true,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  await supabase.from('access_logs').insert({
    id: uuidv4(),
    user_id: user.id,
    action: 'login_success',
    ip_address: ipAddress,
    user_agent: userAgent,
    details: JSON.stringify({
      deviceId: device?.id,
      isTrusted: device?.is_trusted,
    }),
    created_at: new Date().toISOString(),
  });

  // Check if they deserve the "+5 no suspicious activity for long period" bonus
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  
  // 1. Check for any recent negative events in access logs
  const { data: negativeEvents } = await supabase
    .from('access_logs')
    .select('id')
    .eq('user_id', user.id)
    .eq('action', 'security_score_decrease')
    .gte('created_at', thirtyDaysAgo)
    .limit(1);

  // 2. Check for any security alerts in last 30 days
  const { data: recentAlerts } = await supabase
    .from('security_alerts')
    .select('id')
    .eq('user_id', user.id)
    .gte('created_at', thirtyDaysAgo)
    .limit(1);

  let noSuspiciousActivity = false;
  if ((!negativeEvents || negativeEvents.length === 0) && (!recentAlerts || recentAlerts.length === 0)) {
    // 3. Check if they were already awarded this bonus in the last 30 days
    const { data: alreadyAwarded } = await supabase
      .from('access_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('action', 'security_score_increase')
      .like('details', '%no_suspicious_activity_long_period%')
      .gte('created_at', thirtyDaysAgo)
      .limit(1);

    if (!alreadyAwarded || alreadyAwarded.length === 0) {
      noSuspiciousActivity = true;
    }
  }

  // Award +1 score for successful secure login
  let updatedScore = await scoreService.increaseSecurityScore(user.id, 1, 'secure_login');
  
  if (noSuspiciousActivity) {
    const finalScore = await scoreService.increaseSecurityScore(user.id, 5, 'no_suspicious_activity_long_period');
    if (finalScore !== null) {
      updatedScore = finalScore;
    }
  }

  let isTwoFactorEnabled = false;
  let avatar = user.avatar_url;
  if (user.avatar_url) {
    try {
      const parsed = JSON.parse(user.avatar_url);
      if (parsed && typeof parsed === 'object') {
        isTwoFactorEnabled = !!parsed.is_two_factor_enabled;
        avatar = parsed.avatar || null;
      }
    } catch (e) {
      // not JSON
    }
  }

  await supabase
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', user.id);

  logger.info('Auth session created', { userId: user.id });

  return response.success(res, {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      isVerified: user.is_verified,
      isTwoFactorEnabled,
      securityScore: updatedScore !== null ? updatedScore : (user.security_score || 50),
      storageUsed: user.storage_used,
      storageLimit: user.storage_limit,
      avatar,
      phone: user.phone,
    },
    accessToken,
    refreshToken,
    sessionId,
    device: device ? {
      id: device.id,
      isTrusted: device.is_trusted,
    } : null,
  }, 'Login successful');
}

module.exports = authController;

