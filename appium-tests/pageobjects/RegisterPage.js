const BasePage = require('./BasePage');

class RegisterPage extends BasePage {
  get registerContainer() { return this.getByTestId('register-screen-container'); }
  get fullNameInput() { return this.getByTestId('register-fullname-input'); }
  get emailInput() { return this.getByTestId('register-email-input'); }
  get phoneInput() { return this.getByTestId('register-phone-input'); }
  get passwordInput() { return this.getByTestId('register-password-input'); }
  get confirmPasswordInput() { return this.getByTestId('register-confirm-password-input'); }
  get passwordStrengthBar() { return this.getByTestId('password-strength-bar'); }
  get passwordStrengthText() { return this.getByTestId('password-strength-label'); }
  get submitRegisterBtn() { return this.getByTestId('register-submit-button'); }
  get loginLink() { return this.getByTestId('back-to-login-link'); }
  get termsCheckbox() { return this.getByTestId('terms-agreement-checkbox'); }

  async registerUser(fullName, email, phone, password, confirmPassword) {
    if (fullName) await this.enterText(this.fullNameInput, fullName);
    if (email) await this.enterText(this.emailInput, email);
    if (phone) await this.enterText(this.phoneInput, phone);
    if (password) await this.enterText(this.passwordInput, password);
    if (confirmPassword) await this.enterText(this.confirmPasswordInput, confirmPassword);
    await this.tap(this.submitRegisterBtn);
  }

  async navigateBackToLogin() {
    await this.tap(this.loginLink);
  }
}

module.exports = new RegisterPage();
