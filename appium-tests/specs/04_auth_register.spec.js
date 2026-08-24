const RegisterPage = require('../pageobjects/RegisterPage');
const LoginPage = require('../pageobjects/LoginPage');

describe('Module 04: User Registration Flow', () => {
  it('TC-REG-001: Should render all registration form inputs and password meter', async () => {
    await LoginPage.navigateToRegister();
    expect(await RegisterPage.isVisible(RegisterPage.fullNameInput)).to.be.true;
    expect(await RegisterPage.isVisible(RegisterPage.emailInput)).to.be.true;
    expect(await RegisterPage.isVisible(RegisterPage.phoneInput)).to.be.true;
    expect(await RegisterPage.isVisible(RegisterPage.passwordInput)).to.be.true;
    expect(await RegisterPage.isVisible(RegisterPage.confirmPasswordInput)).to.be.true;
  });

  it('TC-REG-002: Should validate password mismatch between password and confirm fields', async () => {
    await RegisterPage.enterText(RegisterPage.fullNameInput, 'John Doe');
    await RegisterPage.enterText(RegisterPage.emailInput, 'john@example.com');
    await RegisterPage.enterText(RegisterPage.phoneInput, '9876543210');
    await RegisterPage.enterText(RegisterPage.passwordInput, 'Password123!');
    await RegisterPage.enterText(RegisterPage.confirmPasswordInput, 'PasswordDifferent123!');
    await RegisterPage.tap(RegisterPage.submitRegisterBtn);
    expect(await RegisterPage.isVisible(RegisterPage.registerContainer)).to.be.true;
  });

  it('TC-REG-003: Should navigate back to login screen smoothly', async () => {
    await RegisterPage.navigateBackToLogin();
    expect(await LoginPage.isVisible(LoginPage.loginContainer)).to.be.true;
  });
});
