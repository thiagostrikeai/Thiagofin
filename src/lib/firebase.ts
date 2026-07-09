import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "affable-unfolding-hnn32",
  appId: "1:578428392407:web:0bef2abf266e7fa29af192",
  apiKey: "AIzaSyDaW6ADouHcE11V6RFr-pH1oMWDfUpRwbw",
  authDomain: "affable-unfolding-hnn32.firebaseapp.com",
  storageBucket: "affable-unfolding-hnn32.firebasestorage.app",
  messagingSenderId: "578428392407",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Use the custom database ID provisioned by AI Studio
export const db = getFirestore(app, "ai-studio-a9ee1025-aa43-4ecd-878d-94d1a3361583");

export const googleProvider = new GoogleAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');
