# 🔒 SecureVault

A state-of-the-art, production-ready, self-hosted file vault and secure sharing system. Built with a highly secure **Node.js/Express API** and a premium, fluid **React Native/Expo Mobile App** utilizing Expo SDK 54, React Native 0.81, and React 19.

SecureVault is engineered with zero-hardcoded network dependencies, letting users dynamically run a secure personal storage server on their laptop and connect to it seamlessly from their mobile devices over local networks (Wi-Fi/Hotspots) or global secure tunnels (ngrok) with native biometrics and multi-factor SMS authentication.

---

## 📸 Architectural Ecosystem

```
┌─────────────────────────────────┐
│     SecureVault Mobile Client   │
│      (Expo SDK 54 / RN 0.81)    │
└────────────────┬────────────────┘
                 │
      [HTTP / HTTPS (Cleartext)]
                 │
                 ▼
┌─────────────────────────────────┐
│      SecureVault API Server     │
│      (Express / Node.js)        │
└──────┬───────────────────┬──────┘
       │                   │
  [REST Calls]         [SMS API]
       │                   │
       ▼                   ▼
┌──────────────┐    ┌──────────────┐
│   Supabase   │    │  Twilio SMS  │
│ (DB/Storage) │    │  (2FA/OTP)   │
└──────────────┘    └──────────────┘
```

---

## ✨ Core Features

### 🛡️ 1. Military-Grade Security & Authentication
* **Multi-Factor Authentication (MFA)**: Secure logins protected by automatic one-time-passwords (OTP) delivered instantly via the **Twilio SMS API**.
* **Trusted Devices & Biometrics**: Integrated **Expo Local Authentication** for secure FaceID/Fingerprint unlocks. Devices are tracked, allowing users to register and manage trusted hardware.
* **Security Activity Auditor**: Real-time logging of sessions, logins, suspends, and sensitive operations, backed by automatic security score calculation.

### 📁 2. Secure File Management
* **Encrypted Storage**: Direct upload of documents, images, and files securely routed through standard file streams to cloud-backed Supabase storage buckets.
* **Dynamic Sharing Links**: Generate timed share links with optional password protection, maximum download counts, and expiration dates.
* **File Stats & Dashboard**: A beautiful interface rendering file usage, storage graphs, alerts, and active connections.

### 🌐 3. Zero-Hardcoded Dynamic Routing
* **Server Setup Screen**: First-time users are greeted by a beautiful configuration interface. Enter any IP, Port, or ngrok URL; the app instantly tests the connection, stores the clean API route securely, and never asks again unless manually updated.
* **CORS & Global Network Binding**: Backend server binds to `0.0.0.0`, allowing inbound client connections globally through standard router interfaces.
* **Cleartext Network Config**: Fully configured through `expo-build-properties` to allow secure HTTP traffic over local networks, bypassing Android 9+ default restrictions.

---

## 🛠️ Technology Stack

### Mobile Client (Frontend)
* **Framework**: React Native (via **Expo SDK 54.0.35**)
* **UI Engine**: React 19.1.0 (optimizing rendering threads)
* **Routing**: Expo Router (filesystem-based navigation)
* **Animations**: React Native Reanimated (running on highly smooth native worklets)
* **State Management**: Zustand (lightweight global store)
* **API Client**: Axios (dynamically configured baseURL interceptor)
* **Secure Storage**: Expo SecureStore (for private JWTs) & AsyncStorage (for server configuration)
* **Iconography**: Lucide React Native

### API Server (Backend)
* **Runtime**: Node.js & Express (v5.1.0)
* **Database**: Supabase (PostgreSQL Cloud instance)
* **Object Store**: Supabase Buckets (for raw file storage)
* **Communications**: Twilio SDK (SMS OTP delivery)
* **Security & Defense**: Helmet (header protection), Express Rate Limit, CORS
* **Logging**: Winston Logger & Morgan HTTP inspector

---

## 🚀 Installation & Local Setup

### 📋 Prerequisites
* [Node.js](https://nodejs.org/) (v20+ recommended)
* [Expo Go app](https://expo.dev/client) on your Android/iOS phone
* A free [Supabase](https://supabase.com/) Account
* A free [Twilio](https://www.twilio.com/) Account (for MFA SMS)

---

### 1. Backend Server Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure environment variables**:
   Create a `.env` file in `backend/` and configure the following keys:
   ```env
   PORT=5000
   NODE_ENV=development
   
   # Supabase Credentials
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   
   # JWT Config
   JWT_SECRET=your_jwt_signing_secret
   
   # Twilio Configuration (MFA OTP)
   TWILIO_ACCOUNT_SID=your_twilio_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=your_twilio_from_phone_num
   ```
4. **Start the backend development server**:
   ```bash
   npm run dev
   ```
   The backend will now be live on `http://localhost:5000`.

---

### 2. Mobile Client Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```
2. **Install dependencies cleanly**:
   ```bash
   npm install --legacy-peer-deps
   ```
3. **Run the Expo server**:
   ```bash
   npx expo start
   ```

---

## 📲 Client Deployment & Mobile Testing

To demonstrate the application seamlessly to clients or users, you can run the server on your laptop and connect the mobile app through three distinct modes:

### 📶 Mode 1: Same Wi-Fi Network (Default)
1. Ensure both your **laptop** and **mobile phone** are on the exact same Wi-Fi.
2. Open Command Prompt on your laptop, run `ipconfig`, and find your **IPv4 Address** under the Wi-Fi adapter (e.g. `10.110.124.148` or `192.168.1.50`).
3. Open the installed SecureVault app on your phone.
4. On the **Connect to Server** screen, type in your laptop's IP address (e.g. `10.110.124.148`) and Port `5000`.
5. Tap **Connect**. The app will test the connection, store it securely, and open the app!

### 🔌 Mode 2: Mobile Hotspot (For Offline / Travel Demos)
1. Turn on the **Mobile Hotspot** on your phone.
2. Connect your laptop to that phone's Hotspot Wi-Fi.
3. Run `ipconfig` on the laptop to find the new IP address assigned by the phone hotspot.
4. Open the app on your phone, enter this new IP, and tap **Connect**.

### 🌍 Mode 3: Connect from ANYWHERE on the Internet (via ngrok)
If you want your client to test your app from their home while the server is running on your laptop at your home, use a secure tunnel:
1. Start `ngrok` on your laptop:
   ```bash
   npx ngrok http 5000
   ```
2. Copy the secure public URL generated by ngrok (e.g. `https://measurable-caridad-untunably.ngrok-free.dev`).
3. Send this URL to your client.
4. They can type this exact URL directly into the setup screen on their phone. **It will connect instantly over LTE/5G from anywhere in the world!**

---

## 🤝 Hand-Off & APK Installation
The APK built for testing is optimized for standard Android distributions. 
* To trigger new cloud builds, simply use Expo's EAS command:
  ```bash
  eas build --platform android --profile preview --non-interactive
  ```
* Once compiled, EAS will generate a QR code and download link. Open it on your Android devices to install the optimized standalone client instantly.

---

## 💻 Migrating / Setting up on another Laptop

To set up the backend server on a new laptop, they only need to install Node.js. They **do not** need to install or configure the frontend mobile development files if they just want to host the server and use the already-compiled mobile APK.

### Step-by-Step Server Setup on the new Laptop:
1. **Get the Code**: Copy the project files (or `git clone` the repository) onto the new laptop.
2. **Install Node.js**: Download and install Node.js (v20+ recommended) from [nodejs.org](https://nodejs.org/).
3. **Configure Environment Secrets**:
   - Create a file named `.env` in the `backend/` folder.
   - Copy-paste the Supabase and Twilio secrets into this file:
     ```env
     PORT=5000
     NODE_ENV=development
     SUPABASE_URL=your_supabase_project_url
     SUPABASE_ANON_KEY=your_supabase_anon_key
     JWT_SECRET=your_jwt_signing_secret
     TWILIO_ACCOUNT_SID=your_twilio_sid
     TWILIO_AUTH_TOKEN=your_twilio_auth_token
     TWILIO_PHONE_NUMBER=your_twilio_from_phone_num
     ```
4. **Install Dependencies**:
   Open a terminal/command prompt inside the `backend/` folder and run:
   ```bash
   npm install
   ```
5. **Start the Server**:
   ```bash
   npm start
   ```

### No-Download ngrok Setup on the new Laptop:
Since Node.js/NPM is installed, there is **no need to manually download or extract ngrok**. It can be run on-the-fly:
1. **Authenticate (One-time setup)**:
   Sign up on [ngrok.com](https://ngrok.com) for a free account, copy the Authtoken from their dashboard, and run this in the terminal:
   ```bash
   npx ngrok config add-authtoken <YOUR_AUTHTOKEN>
   ```
2. **Expose the Port**:
   Start the tunnel by running:
   ```bash
   npx ngrok http 5000
   ```
3. **Connect**: Copy the secure `https://...ngrok-free.app` URL printed in the terminal, paste it into the **SecureVault** mobile app, and hit **Connect**!
#   S e c u r e V a u l t  
 