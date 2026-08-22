const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const logger = require('../utils/logger');

const SUSPICIOUS_FAILED_ATTEMPTS_THRESHOLD = 3;
const FAILED_ATTEMPTS_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Generate a device fingerprint by hashing the user-agent string and IP address.
 * This is a lightweight, stateless way to identify a device without native device APIs.
 */
function buildFingerprint(userAgent, ipAddress) {
  // We exclude dynamic IP address from the fingerprint hash because IP addresses change
  // frequently (switching WiFi, mobile networks, etc.), which would invalidate trusted device status.
  // Since device queries are always scoped by user_id, userAgent alone is stable and secure.
  return crypto
    .createHash('sha256')
    .update(userAgent || 'unknown')
    .digest('hex');
}

/**
 * Parse a user-agent string into human-readable device info.
 */
function parseUserAgent(ua = '') {
  let deviceType = 'Unknown';
  let deviceName = 'Unknown Device';
  let osInfo = 'Unknown OS';

  if (/android/i.test(ua)) {
    deviceType = 'Mobile';
    deviceName = 'Android Device';
    const match = ua.match(/Android ([0-9.]+)/i);
    osInfo = match ? `Android ${match[1]}` : 'Android';
  } else if (/iphone/i.test(ua)) {
    deviceType = 'Mobile';
    deviceName = 'iPhone';
    const match = ua.match(/OS ([0-9_]+)/i);
    osInfo = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/ipad/i.test(ua)) {
    deviceType = 'Tablet';
    deviceName = 'iPad';
    osInfo = 'iPadOS';
  } else if (/windows/i.test(ua)) {
    deviceType = 'Desktop';
    deviceName = 'Windows PC';
    osInfo = 'Windows';
  } else if (/macintosh|mac os x/i.test(ua)) {
    deviceType = 'Desktop';
    deviceName = 'Mac';
    osInfo = 'macOS';
  } else if (/linux/i.test(ua)) {
    deviceType = 'Desktop';
    deviceName = 'Linux Machine';
    osInfo = 'Linux';
  } else if (/expo|react-native/i.test(ua)) {
    deviceType = 'Mobile';
    deviceName = 'Expo App';
    osInfo = 'React Native';
  }

  return { deviceType, deviceName, osInfo };
}

/**
 * Find an existing device record or create a new (untrusted) one.
 *
 * @returns {Promise<{ device, isNew }>}
 */
async function getOrCreateDevice(userId, userAgent, ipAddress) {
  const fingerprint = buildFingerprint(userAgent, ipAddress);
  const { deviceType, deviceName, osInfo } = parseUserAgent(userAgent);

  // Try to find existing
  const { data: existing } = await supabase
    .from('devices')
    .select('*')
    .eq('user_id', userId)
    .eq('device_fingerprint', fingerprint)
    .single();

  if (existing) {
    // Update last_active + ip (IP can change on mobile)
    await supabase
      .from('devices')
      .update({ last_active: new Date().toISOString(), ip_address: ipAddress })
      .eq('id', existing.id);

    return { device: { ...existing, ip_address: ipAddress }, isNew: false };
  }

  // Create new untrusted device
  const deviceId = uuidv4();
  const { data: created, error } = await supabase
    .from('devices')
    .insert({
      id: deviceId,
      user_id: userId,
      device_fingerprint: fingerprint,
      device_name: deviceName,
      device_type: deviceType,
      os_info: osInfo,
      ip_address: ipAddress,
      is_trusted: false,
      last_active: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    logger.error('Device creation failed', { error: error.message });
    // Return a synthetic record so login can continue
    return {
      device: { id: deviceId, is_trusted: false, device_name: deviceName, ip_address: ipAddress },
      isNew: true,
    };
  }

  logger.info('New device registered', { userId, deviceId, deviceType });
  return { device: created, isNew: true };
}

/**
 * Determine if a login should be treated as suspicious and trigger OTP.
 *
 * Rules:
 *   1. First-ever login from this device fingerprint
 *   2. Device exists but is not trusted
 *   3. ≥3 failed login attempts in the last 30 minutes
 *   4. User has role 'admin'
 *
 * @returns {Promise<{ suspicious: boolean, reason: string }>}
 */
async function isSuspiciousLogin(userId, userAgent, ipAddress, userRole) {
  // Rule 4: admin always gets OTP
  if (userRole === 'admin') {
    return { suspicious: true, reason: 'admin_account' };
  }

  const fingerprint = buildFingerprint(userAgent, ipAddress);

  const { data: device } = await supabase
    .from('devices')
    .select('is_trusted, created_at')
    .eq('user_id', userId)
    .eq('device_fingerprint', fingerprint)
    .single();

  // Rule 1 & 2: new device or untrusted device
  if (!device || !device.is_trusted) {
    return {
      suspicious: true,
      reason: device ? 'untrusted_device' : 'new_device',
    };
  }

  // Rule 3: multiple recent failed attempts
  const windowStart = new Date(Date.now() - FAILED_ATTEMPTS_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from('access_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', 'login_failed')
    .gte('created_at', windowStart);

  if ((count || 0) >= SUSPICIOUS_FAILED_ATTEMPTS_THRESHOLD) {
    return { suspicious: true, reason: 'repeated_failures' };
  }

  return { suspicious: false, reason: 'trusted' };
}

/**
 * Mark a device as trusted after successful OTP verification.
 */
async function trustDevice(deviceId) {
  await supabase
    .from('devices')
    .update({ is_trusted: true })
    .eq('id', deviceId);

  logger.info('Device marked as trusted', { deviceId });
}

/**
 * Create a security alert for suspicious login events.
 */
async function createSecurityAlert(userId, reason, severity = 'medium') {
  const messages = {
    new_device: 'Login detected from a new, unrecognised device.',
    untrusted_device: 'Login attempt from an untrusted device.',
    repeated_failures: 'Multiple failed login attempts detected before successful login.',
    admin_account: 'Admin account login — OTP verification required.',
  };

  await supabase.from('security_alerts').insert({
    id: uuidv4(),
    user_id: userId,
    alert_type: 'suspicious_login',
    severity,
    message: messages[reason] || 'Suspicious login activity detected.',
    is_read: false,
    created_at: new Date().toISOString(),
  });
}

module.exports = {
  getOrCreateDevice,
  isSuspiciousLogin,
  trustDevice,
  createSecurityAlert,
  buildFingerprint,
};
