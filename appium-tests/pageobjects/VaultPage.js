const BasePage = require('./BasePage');

class VaultPage extends BasePage {
  get vaultContainer() { return this.getByTestId('vault-screen'); }
  get searchInput() { return this.getByTestId('vault-search-input'); }
  get clearSearchBtn() { return this.getByTestId('clear-search-button'); }
  get filterTabAll() { return this.getByTestId('filter-tab-all'); }
  get filterTabDocuments() { return this.getByTestId('filter-tab-documents'); }
  get filterTabImages() { return this.getByTestId('filter-tab-images'); }
  get filterTabEncrypted() { return this.getByTestId('filter-tab-encrypted'); }
  get sortMenuButton() { return this.getByTestId('vault-sort-menu-button'); }
  get fileListFlatList() { return this.getByTestId('vault-files-flatlist'); }
  get emptyVaultIllustration() { return this.getByTestId('empty-vault-placeholder'); }
  get emptyVaultUploadBtn() { return this.getByTestId('empty-vault-upload-cta'); }
  
  // Context Actions Bottom Sheet
  get actionSheetModal() { return this.getByTestId('file-action-sheet'); }
  get actionShare() { return this.getByTestId('action-share-file'); }
  get actionPreview() { return this.getByTestId('action-preview-file'); }
  get actionDownload() { return this.getByTestId('action-download-file'); }
  get actionRename() { return this.getByTestId('action-rename-file'); }
  get actionDelete() { return this.getByTestId('action-delete-file'); }
  get confirmDeleteBtn() { return this.getByTestId('confirm-delete-button'); }

  // Share Dialog
  get shareModal() { return this.getByTestId('share-file-modal'); }
  get shareExpirySelector() { return this.getByTestId('share-expiry-picker'); }
  get sharePasswordToggle() { return this.getByTestId('share-password-toggle'); }
  get sharePasswordInput() { return this.getByTestId('share-password-input'); }
  get generateShareLinkBtn() { return this.getByTestId('generate-share-link-btn'); }
  get copyShareLinkBtn() { return this.getByTestId('copy-share-link-btn'); }

  async searchFiles(query) {
    await this.enterText(this.searchInput, query);
  }

  async filterByCategory(category) {
    if (category === 'Documents') await this.tap(this.filterTabDocuments);
    else if (category === 'Images') await this.tap(this.filterTabImages);
    else if (category === 'Encrypted') await this.tap(this.filterTabEncrypted);
    else await this.tap(this.filterTabAll);
  }

  async openFileActions(fileName) {
    const fileCard = this.getByText(fileName);
    await this.tap(fileCard);
  }

  async deleteFile(fileName) {
    await this.openFileActions(fileName);
    await this.tap(this.actionDelete);
    await this.tap(this.confirmDeleteBtn);
  }
}

module.exports = new VaultPage();
