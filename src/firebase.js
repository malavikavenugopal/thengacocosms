import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBwEYoW0kvJEIQ0x-E0zPr0aYoVpMZCAh8",
  authDomain: "thengacocosms.firebaseapp.com",
  projectId: "thengacocosms",
  storageBucket: "thengacocosms.firebasestorage.app",
  messagingSenderId: "1066909999307",
  appId: "1:1066909999307:web:44eb1e9c8123e2f95abb4e",
  measurementId: "G-ZZ15FE7G7D"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = getAnalytics(app);
