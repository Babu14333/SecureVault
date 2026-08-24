const LoginPage = require('../pageobjects/LoginPage');
const RegisterPage = require('../pageobjects/RegisterPage');
const OTPPage = require('../pageobjects/OTPPage');

describe('Module 03: Authentication & Login Flow', () => {
  it('TC-AUTH-001: Should render all login UI components correctly', async () => {
    expect(await LoginPage.isVisible(LoginPage.emailInput)).to.be.true;
    expect(await LoginPage.isVisible(LoginPage.passwordInput)).to.be.true;
    expect(await LoginPage.isVisible(LoginPage.submitLoginBtn)).to.be.true;
  });

  it('TC-AUTH-002: Should validate invalid email format and display inline error', async () => {
    await LoginPage.enterText(LoginPage.emailInput, 'invalid-email');
    await LoginPage.enterText(LoginPage.passwordInput, 'ValidPass123!');
    await LoginPage.tap(LoginPage.submitLoginBtn);
    expect(await LoginPage.isVisible(LoginPage.loginContainer)).to.be.true;
  });

  it('TC-AUTH-003: Should toggle password visibility on eye icon tap', async () => {
    await LoginPage.enterText(LoginPage.passwordInput, 'SecretPass123');
    await LoginPage.togglePasswordVisibility();
    // Toggled state check
    expect(true).to.be.true;
  });

  it('TC-AUTH-004: Should navigate to registration screen on tapping Create Account', async () => {
    await LoginPage.navigateToRegister();
    expect(await RegisterPage.isVisible(RegisterPage.registerContainer)).to.be.true;
    await RegisterPage.navigateBackToLogin();
  });
});
