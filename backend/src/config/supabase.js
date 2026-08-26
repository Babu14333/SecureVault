const { createClient } = require('@supabase/supabase-js');
const config = require('./index');
const logger = require('../utils/logger');

const fallbackUrl = config.supabase?.url || process.env.SUPABASE_URL || 'https://mock-vault.supabase.co';
const fallbackKey = config.supabase?.serviceKey || config.supabase?.anonKey || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'mock-anon-key-for-test-environments';
const fallbackAdminKey = config.supabase?.serviceKey || process.env.SUPABASE_SERVICE_KEY || fallbackKey;

// Direct Native Supabase Client for Cloud Database Execution
let supabase;
let supabaseAdmin;

try {
  supabase = createClient(fallbackUrl, fallbackKey);
  supabaseAdmin = createClient(fallbackUrl, fallbackAdminKey);
  logger.info('Supabase client initialized.');
} catch (err) {
  logger.warn(`Supabase client initialized with fallback placeholder: ${err.message}`);
  supabase = createClient('https://mock-vault.supabase.co', 'mock-key-placeholder');
  supabaseAdmin = createClient('https://mock-vault.supabase.co', 'mock-key-placeholder');
}

module.exports = { supabase, supabaseAdmin };

