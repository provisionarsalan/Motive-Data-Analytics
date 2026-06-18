// ============================================================
// 🔥 FIREBASE CONFIGURATION — MOTIVE ANALYTICS PRO
// ============================================================
// SETUP STEPS:
// 1. Go to https://console.firebase.google.com
// 2. Click "Add project" → name it "motive-analytics"
// 3. Click "</>" Web icon to register app → name "motive-web"
// 4. Copy the config values below from Firebase Console
// 5. Enable Authentication → Sign-in method → Email/Password
// 6. Enable Firestore Database → Start in test mode
// 7. Create admin account: Authentication → Users → Add user
//    e.g. Email: admin@gomotive.com | Password: YourPass123!
// ============================================================

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCFHJ1JqKMeZZKrBk14NQ56KBuwtllohH8",
  authDomain: "motive-analytics.firebaseapp.com",
  projectId: "motive-analytics",
  storageBucket: "motive-analytics.firebasestorage.app",
  messagingSenderId: "823396422793",
  appId: "1:823396422793:web:1c591d9b1acd14d2cda258",
  measurementId: "G-ZQYBDJ1T0Q"
};

// ============================================================
// FIRESTORE SECURITY RULES — Paste in Firebase Console → Rules
// ============================================================
/*
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /settings/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /performanceData/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /qaData/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /members/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /pods/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
*/
