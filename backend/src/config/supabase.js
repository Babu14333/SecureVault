const { createClient } = require('@supabase/supabase-js');
const config = require('./index');
const logger = require('../utils/logger');

// Direct Native Supabase Client for Cloud Database Execution
const supabase = createClient(
  config.supabase.url || '',
  config.supabase.serviceKey || config.supabase.anonKey || ''
);

// Admin Client for privileged operations
const supabaseAdmin = createClient(
  config.supabase.url || '',
  config.supabase.serviceKey || ''
);

logger.info('Supabase client initialized. Running exclusively in Cloud database mode.');

module.exports = { supabase, supabaseAdmin };
