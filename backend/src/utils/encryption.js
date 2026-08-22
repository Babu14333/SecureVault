const CryptoJS = require('crypto-js');
const crypto = require('crypto');
const config = require('../config');

const encryption = {
  /**
   * Encrypt data using AES-256
   */
  encrypt(data) {
    return CryptoJS.AES.encrypt(
      typeof data === 'string' ? data : JSON.stringify(data),
      config.encryption.aesKey
    ).toString();
  },

  /**
   * Decrypt AES-256 encrypted data
   */
  decrypt(encryptedData) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, config.encryption.aesKey);
    return bytes.toString(CryptoJS.enc.Utf8);
  },

  /**
   * Generate SHA-256 hash for file integrity verification
   */
  generateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  },

  /**
   * Verify file integrity using SHA-256
   */
  verifyHash(data, expectedHash) {
    const actualHash = this.generateHash(data);
    return actualHash === expectedHash;
  },

  /**
   * Generate a secure random token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  },

  /**
   * Generate OTP code
   */
  generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
  },
};

module.exports = encryption;
