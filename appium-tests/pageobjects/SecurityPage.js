const BasePage = require('./BasePage');

class SecurityPage extends BasePage {
  get securityContainer() { return this.getByTestId('security-screen'); }
  get securityScoreHeader() { return this.getByTestId('security-score-widget'); }
  get scorePercentageText() { return this.getByTestId('security-score-percentage'); }
  get auditLogsList() { return this.getByTestId('siem-audit-logs-list'); }
  get logFilterAll() { return this.getByTestId('log-filter-all'); }
  get logFilterCritical() { return this.getByTestId('log-filter-critical'); }
  get logFilterWarning() { return this.getByTestId('log-filter-warning'); }
  get logFilterInfo() { return this.getByTestId('log-filter-info'); }
  get activeSessionsList() { return this.getByTestId('active-sessions-section'); }
  get currentDeviceTag() { return this.getByTestId('current-device-tag'); }
  get revokeOtherSessionsBtn() { return this.getByTestId('revoke-other-sessions-btn'); }
  get mfaStatusBadge() { return this.getByTestId('mfa-status-badge'); }
  get vulnerabilityList() { return this.getByTestId('vulnerability-recommendations'); }

  async filterAuditLogs(level) {
    if (level === 'Critical') await this.tap(this.logFilterCritical);
    else if (level === 'Warning') await this.tap(this.logFilterWarning);
    else if (level === 'Info') await this.tap(this.logFilterInfo);
    else await this.tap(this.logFilterAll);
  }

  async revokeAllOtherSessions() {
    await this.tap(this.revokeOtherSessionsBtn);
  }
}

module.exports = new SecurityPage();
