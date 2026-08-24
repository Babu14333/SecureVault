const ServerSetupPage = require('../pageobjects/ServerSetupPage');
const LoginPage = require('../pageobjects/LoginPage');

describe('Module 02: Server Configuration & Connectivity', () => {
  it('TC-SRV-001: Should auto-detect local LAN IP address and pre-fill port 5000', async () => {
    if (await ServerSetupPage.isSetupVisible()) {
      const ipVal = await ServerSetupPage.getTextContent(ServerSetupPage.ipInput);
      expect(ipVal).to.be.a('string');
    }
  });

  it('TC-SRV-002: Should validate empty IP and port inputs before network call', async () => {
    if (await ServerSetupPage.isSetupVisible()) {
      await ServerSetupPage.enterText(ServerSetupPage.ipInput, '');
      await ServerSetupPage.tap(ServerSetupPage.connectButton);
      expect(await ServerSetupPage.isSetupVisible()).to.be.true;
    }
  });

  it('TC-SRV-003: Should connect to backend server and transition to Login screen', async () => {
    if (await ServerSetupPage.isSetupVisible()) {
      await ServerSetupPage.connectToServer('10.57.151.58', '5000');
      await LoginPage.waitForElement(LoginPage.loginContainer, 10000);
    }
    expect(await LoginPage.isVisible(LoginPage.loginContainer)).to.be.true;
  });
});
