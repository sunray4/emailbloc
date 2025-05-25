import { db } from "./firebase.js";
import { getDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  const tab = tabs[0];
  if (
    !tab ||
    !tab.url ||
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://")
  ) {
    const p = document.getElementById("form-detected");
    if (p) p.textContent = "Cannot run on this page.";
    return;
  }
  chrome.tabs.sendMessage(tab.id, { action: "checkForm" }, function (response) {
    const p = document.getElementById("form-detected");
    if (chrome.runtime.lastError) {
      p.textContent = "Could not connect to content script.";
      return;
    }
    if (response && response.hasForm) {
      p.textContent = "Is signup/login form detected? Yes";
    } else {
      p.textContent = "Is signup/login form detected? No";
    }
  });
});

document.addEventListener("DOMContentLoaded", function () {
  chrome.storage.local.get(["initialized", "username"], (data) => {
    const initialized = data.initialized;
    if (initialized) {
      window.location.href = "home.html";
      return;
    } else {
      document.getElementById("init-form").style.display = "block";
      document.getElementById("email-form").style.display = "none";
    }
  });
});

document
  .getElementById("submit-username")
  .addEventListener("click", async () => {
    console.log("submit-username clicked");
    const username = document.getElementById("username-input").value.trim();
    const errorText = document.getElementById("username-error");
    if (!username) {
      errorText.textContent = "Please enter a username.";
      return;
    }

    const userRef = doc(db, "users", username);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      errorText.textContent = "Username is taken.";
      return;
    } else {
      document.getElementById("init-form").style.display = "none";
      document.getElementById("email-form").style.display = "block";
      errorText.textContent = "";
      sessionStorage.setItem("pendingUsername", username);
    }
  });

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (
    !tab ||
    !tab.url ||
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://")
  ) {
    const p = document.getElementById("form-detected");
    if (p) p.textContent = "Cannot run on this page.";
    return;
  }
  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      files: ["content.js"],
    },
    () => {
      chrome.tabs.sendMessage(tab.id, { action: "checkForm" }, (response) => {
        const p = document.getElementById("form-detected");
        if (response && response.hasForm) {
          p.textContent = "Is signup/login form detected? Yes";
        } else {
          p.textContent = "Is signup/login form detected? No";
        }
      });
    }
  );
});

// add email
document.getElementById("add-email").addEventListener("click", () => {
  const container = document.getElementById("additional-emails");
  if (container.children.length >= 5) return;

  const div = document.createElement("div");
  div.innerHTML = `
  <input type="email" placeholder="Email" class="extra-email w-2/3 rounded-lg bg-blue-800 text-blue-100 placeholder-blue-300 border border-blue-700 focus:ring-2 focus:ring-blue-400 focus:outline-none p-2 mr-2 pb-2"/>
  <select class="email-label w-1/3 rounded-lg bg-blue-800 text-blue-100 border border-blue-700 focus:ring-2 focus:ring-blue-400 focus:outline-none p-2 mr-2 pt-4">
    <option value="secondary">Secondary</option>
    <option value="school">School</option>
    <option value="work">Work</option>
    <option value="backup">Backup</option>
  </select>
  <button class="remove-email bg-red-600 hover:bg-red-500 text-white rounded-lg px-3 py-2 transition">Remove</button>
`;
  container.appendChild(div);
  div
    .querySelector(".remove-email")
    .addEventListener("click", () => div.remove());
});

document.getElementById("save-emails").addEventListener("click", async () => {
  const primary = document.getElementById("primary-email").value.trim();
  const secondary = document.getElementById("secondary-email").value.trim();

  if (!primary || !secondary) {
    alert("Both primary and secondary emails are required.");
    return;
  }

  const extras = Array.from(document.querySelectorAll(".extra-email")).map(
    (e) => e.value.trim()
  );
  const labels = Array.from(document.querySelectorAll(".email-label")).map(
    (e) => e.value
  );
  const combined = extras.map((email, i) => ({ email, label: labels[i] }));


  combined.unshift({ email: secondary, label: "secondary" });

  const username = sessionStorage.getItem("pendingUsername");
  if (!username) {
    alert("Username not found. Please restart the signup process.");
    window.location.href = "index.html";
    return;
  }

  try {
    await setDoc(
      doc(db, "users", username),
      {
        createdAt: serverTimestamp(),
        primaryEmail: primary,
        secondaryEmail: secondary,
        additionalEmails: combined,
      }
    );
  } catch (err) {
    alert("Failed to save emails to Firestore: " + err.message);
    return;
  }

  chrome.storage.local.set(
    {
      initialized: true,
      username: username,
      primaryEmail: primary,
      secondaryEmail: secondary,
      additionalEmails: combined,
    },
    () => {
      alert("Emails saved locally!");
      sessionStorage.removeItem("pendingUsername");
      window.location.href = "home.html";
    }
  );
});

document.getElementById("go-to-login").addEventListener("click", () => {
  window.location.href = "login.html";
});