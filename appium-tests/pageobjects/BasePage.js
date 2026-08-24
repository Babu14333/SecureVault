/**
 * BasePage: Core interaction helpers for Appium WebdriverIO tests
 */
class BasePage {
  /**
   * Find element by accessibility id (recommended for React Native testID)
   */
  getByTestId(testId) {
    return $(`~${testId}`);
  }

  /**
   * Find element by Android UIAutomator text / resource-id
   */
  getByText(text) {
    return $(`android=new UiSelector().text("${text}")`);
  }

  getByTextContains(text) {
    return $(`android=new UiSelector().textContains("${text}")`);
  }

  /**
   * Safe wait for element to be visible
   */
  async waitForElement(element, timeout = 10000) {
    await element.waitForDisplayed({ timeout });
    return element;
  }

  /**
   * Safe click with wait
   */
  async tap(element, timeout = 10000) {
    await this.waitForElement(element, timeout);
    await element.click();
  }

  /**
   * Safe text input with clear
   */
  async enterText(element, text, timeout = 10000) {
    await this.waitForElement(element, timeout);
    await element.clearValue();
    await element.setValue(text);
  }

  /**
   * Check if element is displayed
   */
  async isVisible(element, timeout = 5000) {
    try {
      return await element.isDisplayed();
    } catch (e) {
      return false;
    }
  }

  /**
   * Get text content of element
   */
  async getTextContent(element, timeout = 10000) {
    await this.waitForElement(element, timeout);
    return await element.getText();
  }

  /**
   * Hide software keyboard
   */
  async dismissKeyboard() {
    try {
      if (await driver.isKeyboardShown()) {
        await driver.hideKeyboard();
      }
    } catch (e) {
      // Ignored if keyboard not active
    }
  }

  /**
   * Scroll down screen
   */
  async scrollDown() {
    const { width, height } = await driver.getWindowSize();
    await driver.touchPerform([
      { action: 'press', options: { x: width / 2, y: height * 0.8 } },
      { action: 'wait', options: { ms: 500 } },
      { action: 'moveTo', options: { x: width / 2, y: height * 0.2 } },
      { action: 'release' }
    ]);
  }

  /**
   * Scroll up screen (pull to refresh)
   */
  async pullToRefresh() {
    const { width, height } = await driver.getWindowSize();
    await driver.touchPerform([
      { action: 'press', options: { x: width / 2, y: height * 0.25 } },
      { action: 'wait', options: { ms: 600 } },
      { action: 'moveTo', options: { x: width / 2, y: height * 0.75 } },
      { action: 'release' }
    ]);
  }
}

module.exports = BasePage;
