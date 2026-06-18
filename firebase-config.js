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
  apiKey:            "PASTE_YOUR_API_KEY_HERE",
  authDomain:        "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "PASTE_YOUR_PROJECT_ID",
  storageBucket:     "PASTE_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId:             "PASTE_YOUR_APP_ID"
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
