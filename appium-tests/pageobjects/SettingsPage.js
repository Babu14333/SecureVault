const BasePage = require('./BasePage');

class SettingsPage extends BasePage {
  get settingsContainer() { return this.getByTestId('settings-screen'); }
  get userProfileAvatar() { return this.getByTestId('user-profile-avatar'); }
  get userDisplayName() { return this.getByTestId('user-display-name'); }
  get userEmailText() { return this.getByTestId('user-email-text'); }
  get serverSettingsSection() { return this.getByTestId('server-settings-section'); }
  get currentServerUrlText() { return this.getByTestId('current-server-url'); }
  get changeServerBtn() { return this.getByTestId('change-server-button'); }
  get biometricAuthSwitch() { return this.getByTestId('biometric-auth-switch'); }
  get twoFactorAuthSwitch() { return this.getByTestId('two-factor-auth-switch'); }
  get themeSelectorDark() { return this.getByTestId('theme-option-dark'); }
  get themeSelectorLight() { return this.getByTestId('theme-option-light'); }
  get themeSelectorSystem() { return this.getByTestId('theme-option-system'); }
  get clearCacheBtn() { return this.getByTestId('clear-cache-button'); }
  get logoutBtn() { return this.getByTestId('logout-button'); }
  get confirmLogoutBtn() { return this.getByTestId('confirm-logout-button'); }

  async toggleTheme(themeName) {
    if (themeName === 'light') await this.tap(this.themeSelectorLight);
    else if (themeName === 'dark') await this.tap(this.themeSelectorDark);
    else await this.tap(this.themeSelectorSystem);
  }

  async logout() {
    await this.tap(this.logoutBtn);
    await this.tap(this.confirmLogoutBtn);
  }
}

module.exports = new SettingsPage();
