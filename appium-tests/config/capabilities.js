/**
 * Appium Desired Capabilities for SecureVault Mobile Testing
 */

const androidCapabilities = {
  // Physical Android Device connected via USB/Wi-Fi running Expo Go
  expoGoPhysical: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': 'Android Device',
    'appium:appPackage': 'host.exp.exponent',
    'appium:appActivity': 'host.exp.exponent.experience.HomeActivity',
    'appium:noReset': true,
    'appium:fullReset': false,
    'appium:newCommandTimeout': 300,
    'appium:autoGrantPermissions': true,
    'appium:ignoreHiddenApiPolicyError': true
  },

  // Android Emulator with Standalone APK Build
  standaloneApkEmulator: {
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': 'Pixel_6_API_33',
    'appium:app': './android/app/build/outputs/apk/release/app-release.apk',
    'appium:appPackage': 'com.securevault.app',
    'appium:appActivity': 'com.securevault.app.MainActivity',
    'appium:noReset': false,
    'appium:fullReset': false,
    'appium:newCommandTimeout': 300,
    'appium:autoGrantPermissions': true
  },

  // iOS Simulator configuration (for cross-platform compatibility)
  iosSimulator: {
    platformName: 'iOS',
    'appium:automationName': 'XCUITest',
    'appium:deviceName': 'iPhone 15 Pro',
    'appium:platformVersion': '17.2',
    'appium:bundleId': 'host.exp.Exponent',
    'appium:noReset': true,
    'appium:newCommandTimeout': 300
  }
};

module.exports = {
  androidCapabilities
};
