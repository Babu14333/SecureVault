const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_KEY,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    expiry: process.env.JWT_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER,
  },
  encryption: {
    aesKey: process.env.AES_SECRET_KEY || 'default-aes-key-32-chars-long!!',
  },
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: (process.env.SMTP_USER || process.env.GMAIL_USER || '').trim(),
    pass: (process.env.SMTP_PASS || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, ''),
    from: process.env.SMTP_FROM || `SecureVault <${(process.env.SMTP_USER || process.env.GMAIL_USER || 'noreply@securevault.app').trim()}>`,
  },
  app: {
    name: process.env.APP_NAME || 'SecureVault',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8081',
  },
};

module.exports = config;
