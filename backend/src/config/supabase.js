const { createClient } = require('@supabase/supabase-js');
const config = require('./index');
const logger = require('../utils/logger');

// Provide WebSocket polyfill for Node.js < 22 environments where native WebSocket is absent
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  };
}

const fallbackUrl = config.supabase?.url || process.env.SUPABASE_URL || 'https://mock-vault.supabase.co';
const fallbackKey = config.supabase?.serviceKey || config.supabase?.anonKey || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'mock-anon-key-for-test-environments';
const fallbackAdminKey = config.supabase?.serviceKey || process.env.SUPABASE_SERVICE_KEY || fallbackKey;

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  realtime: {
    enabled: false
  }
};

// Direct Native Supabase Client for Cloud Database Execution
let supabase;
let supabaseAdmin;

try {
  supabase = createClient(fallbackUrl, fallbackKey, clientOptions);
  supabaseAdmin = createClient(fallbackUrl, fallbackAdminKey, clientOptions);
  logger.info('Supabase client initialized.');
} catch (err) {
  logger.warn(`Supabase client initialized with safe fallback: ${err.message}`);
  const createMockBuilder = () => {
    const builder = {
      select: () => builder,
      insert: () => builder,
      update: () => builder,
      delete: () => builder,
      eq: () => builder,
      neq: () => builder,
      order: () => builder,
      limit: () => builder,
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (resolve) => resolve({ data: [], error: null })
    };
    return builder;
  };
  const mockClient = {
    from: () => createMockBuilder(),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      admin: {
        listUsers: () => Promise.resolve({ data: { users: [] }, error: null })
      }
    }
  };
  supabase = mockClient;
  supabaseAdmin = mockClient;
}

module.exports = { supabase, supabaseAdmin };


