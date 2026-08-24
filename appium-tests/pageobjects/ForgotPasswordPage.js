const BasePage = require('./BasePage');

class ForgotPasswordPage extends BasePage {
  get forgotPasswordContainer() { return this.getByTestId('forgot-password-screen'); }
  get emailInput() { return this.getByTestId('forgot-email-input'); }
  get sendResetCodeBtn() { return this.getByTestId('send-reset-code-button'); }
  get resetCodeInput() { return this.getByTestId('reset-code-input'); }
  get newPasswordInput() { return this.getByTestId('new-password-input'); }
  get confirmNewPasswordInput() { return this.getByTestId('confirm-new-password-input'); }
  get updatePasswordBtn() { return this.getByTestId('update-password-button'); }
  get backToLoginBtn() { return this.getByTestId('back-to-login-btn'); }
  get statusFeedback() { return this.getByTestId('reset-status-feedback'); }

  async requestResetCode(email) {
    await this.enterText(this.emailInput, email);
    await this.tap(this.sendResetCodeBtn);
  }

  async resetPassword(code, newPassword, confirmNewPassword) {
    await this.enterText(this.resetCodeInput, code);
    await this.enterText(this.newPasswordInput, newPassword);
    await this.enterText(this.confirmNewPasswordInput, confirmNewPassword);
    await this.tap(this.updatePasswordBtn);
  }
}

module.exports = new ForgotPasswordPage();
