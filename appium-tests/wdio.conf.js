/**
 * WebdriverIO & Appium Configuration for SecureVault Frontend E2E Tests
 */
const path = require('path');
const { androidCapabilities } = require('./config/capabilities');

exports.config = {
  // ====================
  // Runner Configuration
  // ====================
  runner: 'local',
  port: 4723,
  path: '/',

  // ==================
  // Specify Test Files
  // ==================
  specs: [
    './specs/**/*.spec.js'
  ],
  exclude: [],

  // ============
  // Capabilities
  // ============
  maxInstances: 1,
  capabilities: [
    androidCapabilities.expoGoPhysical
  ],

  // ===================
  // Test Configurations
  // ===================
  logLevel: 'info',
  bail: 0,
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  services: [
    ['appium', {
      args: {
        relaxedSecurity: true,
        address: '127.0.0.1',
        port: 4723
      },
      logPath: './logs'
    }]
  ],

  framework: 'mocha',
  reporters: ['spec'],

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000
  },

  // =====
  // Hooks
  // =====
  beforeSession: function (config, capabilities, specs) {
    console.log('[WDIO] Starting Appium test session for SecureVault Mobile App...');
  },

  before: function (capabilities, specs) {
    const chai = require('chai');
    global.expect = chai.expect;
    global.assert = chai.assert;
  },

  afterTest: async function(test, context, { error, result, duration, passed, retries }) {
    if (error) {
      const screenshotPath = path.join(__dirname, `screenshots/${test.title.replace(/\s+/g, '_')}.png`);
      await driver.saveScreenshot(screenshotPath);
      console.log(`[WDIO] Test failed. Screenshot saved to ${screenshotPath}`);
    }
  },

  afterSession: function (config, capabilities, specs) {
    console.log('[WDIO] Appium session ended successfully.');
  }
};
