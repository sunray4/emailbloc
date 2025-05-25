import { db } from "./firebase.js";
import { doc, getDoc } from "firebase/firestore";

const usernameInput = document.getElementById("login-username");
const emailInput = document.getElementById("login-email");
const loginBtn = document.getElementById("login-btn");
const message = document.getElementById("login-message");

loginBtn.addEventListener("click", async () => {
  const username = usernameInput.value.trim();
  const email = emailInput.value.trim().toLowerCase();

  if (!username || !email) {
    message.textContent = "Please enter both username and email.";
    return;
  }

  message.textContent = "Checking credentials...";

  try {
    const userRef = doc(db, "users", username);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      message.textContent = "Username not found.";
      return;
    }

    const userData = userSnap.data();

    if (
      (userData.primaryEmail &&
        userData.primaryEmail.toLowerCase() === email) ||
      (userData.email && userData.email.toLowerCase() === email)
    ) {

      chrome.storage.local.set(
        { ...userData, username, initialized: true },
        () => {
          message.style.color = "green";
          message.textContent = "Login successful! Redirecting...";
          setTimeout(() => {
            window.location.href = "home.html";
          }, 1000);
        }
      );
    } else {
      message.textContent = "Email does not match the username.";
    }
  } catch (err) {
    message.textContent = "Error: " + err.message;
  }
});

document.getElementById('go-to-signup').addEventListener('click', () => {
  window.location.href = "index.html";
});