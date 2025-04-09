import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCTFX6rES6uGZwYPFKjXs0w9tGhMUvPQ68",
  authDomain: "cvai-17978.firebaseapp.com",
  projectId: "cvai-17978",
  storageBucket: "cvai-17978.firebasestorage.app",
  messagingSenderId: "278714164740",
  appId: "1:278714164740:web:8c3a21d5471f10b7a97751",
  measurementId: "G-K68HNPV091"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

export { auth, provider, db };
export default app;