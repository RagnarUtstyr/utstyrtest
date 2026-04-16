import { auth } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const googleLoginButton = document.getElementById("google-login-button");
const logoutButton = document.getElementById("admin-logout-button");
const authStatus = document.getElementById("auth-status");

const provider = new GoogleAuthProvider();

if (googleLoginButton) {
  googleLoginButton.addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, provider);
      window.location.href = "dashboard.html";
    } catch (error) {
      console.error("Google login failed:", error);
      if (authStatus) {
        authStatus.textContent = "Google login failed.";
      }
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

onAuthStateChanged(auth, (user) => {
  if (authStatus) {
    authStatus.textContent = user ? `Signed in as ${user.email}` : "Not signed in";
  }

  const isDashboardPage = window.location.pathname.includes("/admin/dashboard.html");
  if (isDashboardPage && !user) {
    window.location.href = "login.html";
  }
});