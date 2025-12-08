// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyCx3-8SmOjmuREYenG3G3sKHUFJncyEwsQ",
  authDomain: "treffipelifirebase.firebaseapp.com",
  databaseURL:
    "https://treffipelifirebase-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "treffipelifirebase",
  storageBucket: "treffipelifirebase.firebasestorage.app",
  messagingSenderId: "879718367340",
  appId: "1:879718367340:web:ab32a1317aaf492cd8d849",
  measurementId: "G-EBV71GRRQ5",
};


const app = initializeApp(firebaseConfig);

// Expo/React Native needs persistence defined; fall back to default if already initialized.
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  auth = getAuth(app);
}

export const database = getDatabase(app);
export { auth };
