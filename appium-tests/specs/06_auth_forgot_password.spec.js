const ForgotPasswordPage = require('../pageobjects/ForgotPasswordPage');
const LoginPage = require('../pageobjects/LoginPage');

describe('Module 06: Password Recovery & Reset Flow', () => {
  it('TC-PWD-001: Should navigate to forgot password screen on link tap', async () => {
    await LoginPage.navigateToForgotPassword();
    expect(await ForgotPasswordPage.isVisible(ForgotPasswordPage.emailInput)).to.be.true;
  });

  it('TC-PWD-002: Should validate empty email on reset password request', async () => {
    await ForgotPasswordPage.enterText(ForgotPasswordPage.emailInput, '');
    await ForgotPasswordPage.tap(ForgotPasswordPage.sendResetCodeBtn);
    expect(await ForgotPasswordPage.isVisible(ForgotPasswordPage.forgotPasswordContainer)).to.be.true;
  });

  it('TC-PWD-003: Should allow returning back to login screen', async () => {
    await ForgotPasswordPage.tap(ForgotPasswordPage.backToLoginBtn);
    expect(await LoginPage.isVisible(LoginPage.loginContainer)).to.be.true;
  });
});
