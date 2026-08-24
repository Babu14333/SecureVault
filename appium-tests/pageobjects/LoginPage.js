const BasePage = require('./BasePage');

class LoginPage extends BasePage {
  get loginContainer() { return this.getByTestId('login-screen-container'); }
  get emailInput() { return this.getByTestId('login-email-input'); }
  get passwordInput() { return this.getByTestId('login-password-input'); }
  get togglePasswordVisibilityBtn() { return this.getByTestId('toggle-password-visibility'); }
  get submitLoginBtn() { return this.getByTestId('login-submit-button'); }
  get forgotPasswordLink() { return this.getByTestId('forgot-password-link'); }
  get registerAccountLink() { return this.getByTestId('register-link'); }
  get emailErrorText() { return this.getByTestId('email-error-message'); }
  get passwordErrorText() { return this.getByTestId('password-error-message'); }
  get loginErrorBanner() { return this.getByTestId('login-error-banner'); }
  get biometricUnlockBtn() { return this.getByTestId('biometric-unlock-button'); }
  get changeServerLink() { return this.getByTestId('change-server-link'); }

  async login(email, password) {
    if (email !== undefined) await this.enterText(this.emailInput, email);
    if (password !== undefined) await this.enterText(this.passwordInput, password);
    await this.tap(this.submitLoginBtn);
  }

  async navigateToRegister() {
    await this.tap(this.registerAccountLink);
  }

  async navigateToForgotPassword() {
    await this.tap(this.forgotPasswordLink);
  }

  async togglePasswordVisibility() {
    await this.tap(this.togglePasswordVisibilityBtn);
  }
}

module.exports = new LoginPage();
