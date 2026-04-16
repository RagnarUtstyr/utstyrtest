import { auth } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const loginForm = document.getElementById("admin-login-form");
const logoutButton = document.getElementById("admin-logout-button");
const authStatus = document.getElementById("auth-status");

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard.html";
    } catch (error) {
      console.error("Login failed:", error);
      if (authStatus) {
        authStatus.textContent = "Login failed. Check email and password.";
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