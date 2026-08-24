const BasePage = require('./BasePage');

class OTPPage extends BasePage {
  get otpContainer() { return this.getByTestId('otp-verification-screen'); }
  get otpInputBox1() { return this.getByTestId('otp-input-0'); }
  get otpInputBox2() { return this.getByTestId('otp-input-1'); }
  get otpInputBox3() { return this.getByTestId('otp-input-2'); }
  get otpInputBox4() { return this.getByTestId('otp-input-3'); }
  get otpInputBox5() { return this.getByTestId('otp-input-4'); }
  get otpInputBox6() { return this.getByTestId('otp-input-5'); }
  get verifyOtpButton() { return this.getByTestId('verify-otp-button'); }
  get resendOtpButton() { return this.getByTestId('resend-otp-button'); }
  get resendCountdownText() { return this.getByTestId('resend-countdown-timer'); }
  get otpErrorText() { return this.getByTestId('otp-error-message'); }
  get cancelButton() { return this.getByTestId('cancel-otp-button'); }

  async enterOtp(code) {
    const digits = String(code).split('');
    const boxes = [
      this.otpInputBox1,
      this.otpInputBox2,
      this.otpInputBox3,
      this.otpInputBox4,
      this.otpInputBox5,
      this.otpInputBox6
    ];
    for (let i = 0; i < Math.min(digits.length, boxes.length); i++) {
      await this.enterText(boxes[i], digits[i]);
    }
  }

  async submitOtp() {
    await this.tap(this.verifyOtpButton);
  }

  async resendOtp() {
    await this.tap(this.resendOtpButton);
  }
}

module.exports = new OTPPage();
