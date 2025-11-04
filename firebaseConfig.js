// firebaseConfig.js
import { initializeApp } from 'firebase/app';
// Poistetaan Analytics import
// import { getAnalytics } from 'firebase/analytics';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDuiOW2N2aeEuW1BxBXF6onDJPGFI5y4sI",
  authDomain: "treffipelifireba.firebaseapp.com",
  projectId: "treffipelifireba",
  storageBucket: "treffipelifireba.appspot.com",
  messagingSenderId: "98059928267",
  appId: "1:98059928267:web:b67b1343edb45b3d7f514e",
  measurementId: "G-Z65GMN5J0T",
  databaseURL: "https://treffipelifireba-default-rtdb.europe-west1.firebasedatabase.app/" // Tämä on tärkeä!
};


const app = initializeApp(firebaseConfig);
// Analytics pois käytöstä
// const analytics = getAnalytics(app);
export const database = getDatabase(app);
