const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const config = require('../config');
const logger = require('../utils/logger');

const OTP_EXPIRY_MS = 5 * 60 * 1000;       // 5 minutes
const OTP_MAX_ATTEMPTS = 5;                  // lock after 5 wrong guesses
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;   // 60 seconds between resends
const OTP_BCRYPT_ROUNDS = 10;

/**
 * Initialise the Twilio client lazily (only when SMS is actually needed)
 */
let _twilioClient = null;
function getTwilioClient() {
  if (!_twilioClient) {
    const twilio = require('twilio');
    _twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return _twilioClient;
}

/**
 * Generate a cryptographically secure 6-digit OTP code.
 */
function generateOTPCode() {
  // crypto.randomInt is CSPRNG-backed (Node ≥ 14.10)
  return String(crypto.randomInt(100000, 999999));
}

/**
 * Normalise a phone number to E.164 with Indian default (+91).
 * If the number already starts with '+' it is returned as-is.
 */
function normalisePhone(phone) {
  if (!phone) return null;
  const stripped = phone.replace(/\s/g, '');
  if (stripped.startsWith('+')) return stripped;
  // Default to India country code
  return `+91${stripped}`;
}

/**
 * Send an SMS via Twilio.
 * Returns { success, sid } or { success: false, error }.
 */
async function sendSMS(toPhone, message) {
  try {
    const client = getTwilioClient();
    const msg = await client.messages.create({
      body: message,
      from: config.twilio.phoneNumber,
      to: toPhone,
    });
    logger.info('Twilio SMS sent', { sid: msg.sid, to: toPhone });
    return { success: true, sid: msg.sid };
  } catch (err) {
    logger.error('Twilio SMS failed', { error: err.message, to: toPhone });
    return { success: false, error: err.message };
  }
}

/**
 * Generate a new OTP, hash it, persist to otp_logs, and send via Twilio SMS.
 *
 * @param {object} opts
 * @param {string|null} opts.userId        - null for unauthenticated share recipients
 * @param {string}      opts.type          - 'suspicious_login' | 'share_access' | 'phone_verification'
 * @param {string}      opts.targetPhone   - recipient phone number (raw, will be normalised)
 * @param {string|null} opts.refId         - for share_access: the shared_links.id
 * @returns {{ success, otpLogId, maskedPhone }} or throws
 */
async function generateAndSendOTP({ userId, type, targetPhone, refId = null }) {
  const phone = normalisePhone(targetPhone);
  if (!phone) {
    throw new Error('A valid phone number is required to send an OTP.');
  }

  const code = generateOTPCode();
  const hash = await bcrypt.hash(code, OTP_BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
  const otpLogId = uuidv4();

  const { error: insertError } = await supabase.from('otp_logs').insert({
    id: otpLogId,
    user_id: userId || null,
    otp_hash: hash,
    type,
    target_phone: phone,
    ref_id: refId || null,
    is_used: false,
    attempts: 0,
    last_sent_at: new Date().toISOString(),
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  });

  if (insertError) {
    logger.error('OTP insert failed', { error: insertError.message });
    throw new Error('Failed to create OTP record.');
  }

  // Compose message
  const appName = config.app.name || 'SecureVault';
  const message = `[${appName}] Your verification code is: ${code}. Valid for 5 minutes. Do not share this code.`;

  // Fire-and-forget in production; await for proper error handling
  const smsResult = await sendSMS(phone, message);

  if (!smsResult.success) {
    if (process.env.NODE_ENV === 'development' || !process.env.TWILIO_ACCOUNT_SID?.startsWith('AC')) {
      logger.info(`[DEV MODE] SMS delivery skipped/failed (${smsResult.error}). Use dev OTP code: ${code}`, {
        type,
        userId,
        phone,
        otpCode: code,
      });
      const maskedPhone = phone.slice(0, -4).replace(/\d/g, '•') + phone.slice(-4);
      return { success: true, otpLogId, maskedPhone, devCode: code };
    }
    // Clean up the OTP record so the caller can retry
    await supabase.from('otp_logs').delete().eq('id', otpLogId);
    throw new Error(`SMS delivery failed: ${smsResult.error}`);
  }

  // Mask phone for safe client display: +91XXXXXX7357 → ••••••7357
  const maskedPhone = phone.slice(0, -4).replace(/\d/g, '•') + phone.slice(-4);

  logger.info('OTP generated and sent via SMS', { type, userId, phone: maskedPhone });
  return { success: true, otpLogId, maskedPhone };
}

/**
 * Verify a submitted OTP code against the latest valid otp_log record.
 *
 * @param {object} opts
 * @param {string|null} opts.userId
 * @param {string}      opts.otpCode   - the plaintext code submitted by user
 * @param {string}      opts.type
 * @param {string|null} opts.refId     - for share_access matching
 * @returns {{ success, reason }}
 */
async function verifyOTP({ userId, otpCode, type, refId = null }) {
  // Build query for the most recent unused, non-expired OTP log
  let query = supabase
    .from('otp_logs')
    .select('*')
    .eq('is_used', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1);

  if (type) {
    query = query.eq('type', type);
  }
  if (userId) {
    query = query.eq('user_id', userId);
  }
  if (refId) {
    query = query.eq('ref_id', refId);
  }

  let { data: records, error } = await query;

  if (error) {
    logger.error('OTP query failed', { error: error.message });
    throw new Error('Verification service unavailable.');
  }

  let record = records?.[0];

  // If not found with strict type/refId filter, fallback to any active unexpired OTP for this user
  if (!record && userId) {
    const { data: fallbackRecords } = await supabase
      .from('otp_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (fallbackRecords && fallbackRecords.length > 0) {
      record = fallbackRecords[0];
    }
  }

  if (!record) {
    return { success: false, reason: 'expired' };
  }

  // Check brute-force limit
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { success: false, reason: 'locked' };
  }

  const isMatch = await bcrypt.compare(otpCode, record.otp_hash);

  if (!isMatch) {
    // Increment attempt counter
    const newAttempts = record.attempts + 1;
    await supabase
      .from('otp_logs')
      .update({ attempts: newAttempts })
      .eq('id', record.id);

    // Log suspicious repeated failure
    if (newAttempts >= 3) {
      logger.warn('Multiple OTP failures detected', {
        type,
        userId,
        attempts: newAttempts,
        phone: record.target_phone,
      });
    }

    const attemptsLeft = OTP_MAX_ATTEMPTS - newAttempts;
    return {
      success: false,
      reason: attemptsLeft <= 0 ? 'locked' : 'invalid',
      attemptsLeft: Math.max(0, attemptsLeft),
    };
  }

  // Mark as used
  await supabase
    .from('otp_logs')
    .update({ is_used: true })
    .eq('id', record.id);

  logger.info('OTP verified successfully', { type, userId });
  return { success: true, reason: 'ok', targetPhone: record.target_phone };
}

/**
 * Resend an OTP, enforcing the cooldown window.
 * Invalidates prior OTP records for this user/type before generating a new one.
 *
 * @param {object} opts
 * @param {string|null} opts.userId
 * @param {string}      opts.type
 * @param {string}      opts.targetPhone
 * @param {string|null} opts.refId
 */
async function resendOTP({ userId, type, targetPhone, refId = null }) {
  // Find the most recent otp_log to check cooldown
  let cooldownQuery = supabase
    .from('otp_logs')
    .select('last_sent_at')
    .eq('type', type)
    .eq('is_used', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (userId) cooldownQuery = cooldownQuery.eq('user_id', userId);
  if (refId) cooldownQuery = cooldownQuery.eq('ref_id', refId);

  const { data: recent } = await cooldownQuery;
  if (recent?.[0]) {
    const elapsed = Date.now() - new Date(recent[0].last_sent_at).getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw Object.assign(new Error(`Please wait ${waitSeconds}s before requesting a new code.`), {
        code: 'COOLDOWN',
        waitSeconds,
      });
    }
  }

  // Invalidate old pending OTPs for this context so they can't be replayed
  let invalidateQuery = supabase
    .from('otp_logs')
    .update({ is_used: true })
    .eq('type', type)
    .eq('is_used', false);

  if (userId) invalidateQuery = invalidateQuery.eq('user_id', userId);
  if (refId) invalidateQuery = invalidateQuery.eq('ref_id', refId);
  await invalidateQuery;

  return generateAndSendOTP({ userId, type, targetPhone, refId });
}

/**
 * Mask an email address for safe client display: user@example.com -> u***r@example.com
 */
function maskEmail(email) {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 2) return `${name[0]}*@${domain}`;
  const maskedName = name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  return `${maskedName}@${domain}`;
}

/**
 * Lazy nodemailer transporter
 */
let _emailTransporter = null;
function getEmailTransporter() {
  if (!_emailTransporter) {
    const nodemailer = require('nodemailer');
    if (config.email.user && config.email.pass) {
      _emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
    } else {
      _emailTransporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465,
        auth: config.email.user ? { user: config.email.user, pass: config.email.pass } : undefined,
        tls: {
          rejectUnauthorized: false,
        },
      });
    }
  }
  return _emailTransporter;
}

/**
 * Send an email containing the OTP code via Nodemailer.
 */
async function sendEmailOTPNotification(toEmail, code) {
  const appName = config.app.name || 'SecureVault';
  const subject = `[${appName}] Verification Code: ${code}`;
  const text = `Your ${appName} verification code is ${code}. Valid for 5 minutes. Do not share this code with anyone.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #3b82f6; text-align: center; margin-bottom: 20px;">${appName}</h2>
      <p style="font-size: 16px; color: #1e293b;">Hello,</p>
      <p style="font-size: 15px; color: #475569;">Your dynamic verification code for logging into <strong>${appName}</strong> is:</p>
      <div style="text-align: center; margin: 28px 0;">
        <span style="font-size: 34px; font-weight: bold; letter-spacing: 8px; color: #0f172a; background-color: #f1f5f9; padding: 14px 28px; border-radius: 10px; border: 1px dashed #cbd5e1; display: inline-block;">${code}</span>
      </div>
      <p style="font-size: 14px; color: #64748b;">This code is valid for <strong>5 minutes</strong>. If you did not request this verification code, please secure your account immediately.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">${appName} Encrypted Cloud Vault Security</p>
    </div>
  `;

  try {
    if (config.email.user && config.email.pass) {
      const transporter = getEmailTransporter();
      await transporter.sendMail({
        from: config.email.from,
        to: toEmail,
        subject,
        text,
        html,
      });
      logger.info(`📧 [SecureVault OTP] Dispatched code: ${code} to ${toEmail}`);
      return { success: true, code };
    } else {
      logger.info(`[DEV MODE / SMTP NOT CONFIGURED] Dynamic OTP for ${toEmail}: ${code}`);
      return { success: true, devMode: true, code };
    }
  } catch (err) {
    logger.error('Nodemailer OTP email failed', { error: err.message, to: toEmail });
    logger.info(`[SMTP FALLBACK] Dynamic OTP for ${toEmail}: ${code}`);
    return { success: true, fallback: true, code };
  }
}

/**
 * Generate a new dynamic OTP and send via Nodemailer email.
 */
async function generateAndSendEmailOTP({ userId, type, targetEmail, refId = null }) {
  if (!targetEmail) {
    throw new Error('A valid email address is required to send an OTP.');
  }

  const code = generateOTPCode();
  const hash = await bcrypt.hash(code, OTP_BCRYPT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS).toISOString();
  const otpLogId = uuidv4();

  const { error: insertError } = await supabase.from('otp_logs').insert({
    id: otpLogId,
    user_id: userId || null,
    otp_hash: hash,
    type,
    target_phone: (targetEmail || '').slice(0, 30),
    ref_id: refId || null,
    is_used: false,
    attempts: 0,
    last_sent_at: new Date().toISOString(),
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  });

  if (insertError) {
    logger.error('OTP insert failed', { error: insertError.message });
    throw new Error('Failed to create OTP record.');
  }

  await sendEmailOTPNotification(targetEmail, code);
  const maskedEmail = maskEmail(targetEmail);

  logger.info('Dynamic Email OTP generated and sent to email', { type, userId, email: maskedEmail });
  return {
    success: true,
    otpLogId,
    maskedEmail,
  };
}

module.exports = {
  generateAndSendOTP,
  generateAndSendEmailOTP,
  verifyOTP,
  resendOTP,
  normalisePhone,
  maskEmail,
};
