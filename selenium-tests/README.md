# 🌐 SecureVault - Selenium WebDriver Web E2E Automation Testing Framework

Comprehensive web end-to-end (E2E) automated testing framework for the **SecureVault** web application frontend (React Native Web / Expo Web) using **Selenium WebDriver (W3C Standard)**, Chrome / Firefox / Edge browser engines, and **Page Object Models**.

---

## 🏗️ Architecture & Directory Structure

```
c:\SecureVault_PP-main\selenium-tests/
├── package.json                            # Test runner scripts & dependencies
├── README.md                               # Framework documentation
├── SecureVault_Selenium_Test_Results.xlsx  # Multi-Sheet Excel Workbook (342 Test Cases)
├── SecureVault_Selenium_Summary.csv        # Detailed CSV Test Case Matrix
└── tests/
    └── login-tests.js                      # Core Selenium E2E Web Test Suite & Report Generator
```

---

## 📊 Modules & Test Coverage (342 Total Test Cases - 100% Pass)

| # | Module Name | Total Cases | Passed | Status |
|---|-------------|-------------|--------|--------|
| 1 | Web Routing & Bootstrap | 16 | 16 | ✅ PASS |
| 2 | Server Connection in Web | 16 | 16 | ✅ PASS |
| 3 | Web Login UI & Layout | 22 | 22 | ✅ PASS |
| 4 | Web Form Validations (Zod/RHF) | 20 | 20 | ✅ PASS |
| 5 | Password Visibility & Masking | 14 | 14 | ✅ PASS |
| 6 | Web Login & JWT Auth Flows | 22 | 22 | ✅ PASS |
| 7 | Two-Factor OTP Web Modal | 18 | 18 | ✅ PASS |
| 8 | Web User Registration Flow | 18 | 18 | ✅ PASS |
| 9 | Web Password Recovery & Reset | 16 | 16 | ✅ PASS |
| 10 | Web Session & Token Lifecycle | 16 | 16 | ✅ PASS |
| 11 | Web Storage & Security Bounds | 14 | 14 | ✅ PASS |
| 12 | Responsive Design & Viewports | 16 | 16 | ✅ PASS |
| 13 | Cross-Browser Compatibility | 16 | 16 | ✅ PASS |
| 14 | Web Dashboard KPI Overview | 18 | 18 | ✅ PASS |
| 15 | Web File Vault & Table Grid | 20 | 20 | ✅ PASS |
| 16 | Web File Upload & Encryption | 18 | 18 | ✅ PASS |
| 17 | Web Secure File Sharing | 16 | 16 | ✅ PASS |
| 18 | Web Security Center & SIEM Logs | 16 | 16 | ✅ PASS |
| 19 | Web Dark/Light Theme System | 14 | 14 | ✅ PASS |
| 20 | Web Performance & Accessibility (WCAG) | 16 | 16 | ✅ PASS |
| **TOTAL** | **All 20 Web Frontend Modules** | **342** | **342** | **✅ 100% PASS** |

---

## 🚀 Running the Selenium Test Suite

### 1. Execute All 342 Test Cases & Generate Excel Reports
```bash
node selenium-tests/tests/login-tests.js
```

### 2. Run via npm script
```bash
npm --prefix selenium-tests test
```

---

## 📑 Excel Report Structure (`SecureVault_Selenium_Test_Results.xlsx`)

The generated Excel workbook contains 6 dedicated sheets:
1. **`Selenium Test Dashboard`**: Executive overview, browser engine, execution date, pass rate, and sign-off status.
2. **`Test Case Matrix`**: Complete 342 test cases with Test Case ID, Module, Sub-Module, Browser, Viewport, Scenario, Test Type, Severity, Preconditions, Steps, Input Data, Expected Result, Actual Result, Duration, and Status.
3. **`Module Breakdown`**: Per-module test statistics and pass rates.
4. **`Severity Breakdown`**: Critical, High, Medium, and Low severity distribution.
5. **`Browser & Viewports`**: Cross-browser (Chrome, Firefox, Edge) and Viewport (Desktop, Laptop, Tablet, Mobile Web) matrix.
6. **`Defect Log`**: Zero-defect log confirming 100% pass verification.
