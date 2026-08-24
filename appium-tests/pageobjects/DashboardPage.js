const BasePage = require('./BasePage');

class DashboardPage extends BasePage {
  get dashboardContainer() { return this.getByTestId('dashboard-screen'); }
  get headerGreeting() { return this.getByTestId('dashboard-greeting-text'); }
  get userAvatar() { return this.getByTestId('dashboard-user-avatar'); }
  get totalFilesCard() { return this.getByTestId('stat-card-total-files'); }
  get storageUsedCard() { return this.getByTestId('stat-card-storage-used'); }
  get storageProgressBar() { return this.getByTestId('storage-progress-bar'); }
  get securityScoreCard() { return this.getByTestId('stat-card-security-score'); }
  get securityScoreValue() { return this.getByTestId('security-score-value'); }
  get securityAlertBanner() { return this.getByTestId('security-alert-banner'); }
  get quickActionUpload() { return this.getByTestId('quick-action-upload'); }
  get quickActionVault() { return this.getByTestId('quick-action-vault'); }
  get quickActionSecurity() { return this.getByTestId('quick-action-security'); }
  get quickActionSettings() { return this.getByTestId('quick-action-settings'); }
  get recentActivitySection() { return this.getByTestId('recent-activity-list'); }
  get bottomTabDashboard() { return this.getByTestId('tab-dashboard'); }
  get bottomTabVault() { return this.getByTestId('tab-vault'); }
  get bottomTabUpload() { return this.getByTestId('tab-upload'); }
  get bottomTabSecurity() { return this.getByTestId('tab-security'); }
  get bottomTabSettings() { return this.getByTestId('tab-settings'); }

  async navigateToTab(tabName) {
    switch(tabName.toLowerCase()) {
      case 'dashboard': await this.tap(this.bottomTabDashboard); break;
      case 'vault': await this.tap(this.bottomTabVault); break;
      case 'upload': await this.tap(this.bottomTabUpload); break;
      case 'security': await this.tap(this.bottomTabSecurity); break;
      case 'settings': await this.tap(this.bottomTabSettings); break;
      default: throw new Error(`Unknown tab: ${tabName}`);
    }
  }

  async getSecurityScore() {
    return await this.getTextContent(this.securityScoreValue);
  }
}

module.exports = new DashboardPage();
