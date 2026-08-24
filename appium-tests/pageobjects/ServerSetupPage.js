const BasePage = require('./BasePage');

class ServerSetupPage extends BasePage {
  get serverSetupContainer() { return this.getByTestId('server-setup-screen'); }
  get ipInput() { return this.getByTestId('server-ip-input'); }
  get portInput() { return this.getByTestId('server-port-input'); }
  get connectButton() { return this.getByTestId('server-connect-button'); }
  get statusToast() { return this.getByTestId('server-status-toast'); }
  get autoDetectButton() { return this.getByTestId('auto-detect-lan-btn'); }
  get ngrokInputToggle() { return this.getByTestId('ngrok-toggle-btn'); }

  async connectToServer(ip = '10.57.151.58', port = '5000') {
    await this.enterText(this.ipInput, ip);
    await this.enterText(this.portInput, port);
    await this.tap(this.connectButton);
  }

  async connectWithFullUrl(url) {
    if (await this.isVisible(this.ngrokInputToggle)) {
      await this.tap(this.ngrokInputToggle);
    }
    await this.enterText(this.ipInput, url);
    await this.tap(this.connectButton);
  }

  async isSetupVisible() {
    return await this.isVisible(this.serverSetupContainer);
  }
}

module.exports = new ServerSetupPage();
