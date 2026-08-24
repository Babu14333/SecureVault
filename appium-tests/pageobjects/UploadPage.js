const BasePage = require('./BasePage');

class UploadPage extends BasePage {
  get uploadContainer() { return this.getByTestId('upload-screen'); }
  get selectFileButton() { return this.getByTestId('select-file-button'); }
  get cameraCaptureButton() { return this.getByTestId('camera-capture-button'); }
  get selectedFilePreviewCard() { return this.getByTestId('selected-file-preview'); }
  get selectedFileNameText() { return this.getByTestId('selected-file-name'); }
  get selectedFileSizeText() { return this.getByTestId('selected-file-size'); }
  get clientEncryptionToggle() { return this.getByTestId('client-encryption-toggle'); }
  get tagsInputField() { return this.getByTestId('upload-tags-input'); }
  get uploadSubmitButton() { return this.getByTestId('upload-submit-button'); }
  get uploadProgressBar() { return this.getByTestId('upload-progress-bar'); }
  get cancelUploadButton() { return this.getByTestId('cancel-upload-button'); }
  get uploadSuccessBadge() { return this.getByTestId('upload-success-badge'); }

  async triggerFileSelection() {
    await this.tap(this.selectFileButton);
  }

  async submitUpload() {
    await this.tap(this.uploadSubmitButton);
  }

  async toggleClientEncryption() {
    await this.tap(this.clientEncryptionToggle);
  }
}

module.exports = new UploadPage();
