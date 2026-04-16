import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBVV1vJqPnfzRsMirdDKuwrs5BRwWPNyHA",
  authDomain: "bergenutstyr.firebaseapp.com",
  projectId: "bergenutstyr",
  storageBucket: "bergenutstyr.firebasestorage.app",
  messagingSenderId: "817970235956",
  appId: "1:817970235956:web:d27c23a4e75fca67841861"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);