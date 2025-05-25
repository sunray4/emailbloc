import { db } from "./firebase.js";
import { doc, setDoc, getDoc } from "firebase/firestore";

function renderScoreCircle(score) {
  let color = "#4ade80";
  let label = "Safe";
  if (score > 13 && score <= 29.5) {
    color = "#facc15";
    label = "Decent";
  } else if (score > 29.5) {
    color = "#f87171";
    label = "Unsafe";
  }

  return `
    <div style="display:flex;flex-direction:column;align-items:center;margin-bottom:24px;">
      <svg height="90" width="90">
        <circle
          stroke="#233554"
          fill="transparent"
          stroke-width="8"
          r="36"
          cx="45"
          cy="45"
        />
        <circle
          stroke="${color}"
          fill="transparent"
          stroke-width="8"
          stroke-linecap="round"
          stroke-dasharray="${2 * Math.PI * 36}"
          stroke-dashoffset="0"
          r="36"
          cx="45"
          cy="45"
        />
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="${color}" font-size="1.5em" font-weight="bold">${score}</text>
      </svg>
      <div style="color:${color};font-weight:600;">Risk Score: <span>${label}</span> (lower is safer)</div>
      <div style="font-size:12px;color:#888;">≤13: Safe, ≤29.5: Decent, &gt;29.5: Unsafe</div>
    </div>
  `;
}

async function renderEmailChoice(score) {
  const primary_email_benchmark = 13;
  const sec_email_benchmark = 29.5;

  const { username } = await new Promise((resolve) =>
    chrome.storage.local.get(["username"], resolve)
  );
  if (!username) {
    return `<div id="email-choice" style="color: white;">
      <h3 style="color: white;">Suggested email:</h3>
      <span style="color: white;" id="email">No user</span>
    </div>`;
  }

  const userDocRef = doc(db, "users", username);
  const userDocSnap = await getDoc(userDocRef);
  let savedEmail = null;
  if (userDocSnap.exists() && userDocSnap.data().suggestedEmail) {
    savedEmail = userDocSnap.data().suggestedEmail;
  }

  let email = "";
  if (savedEmail) {
    email = savedEmail;
  } else {
    let emailChoice = "";
    if (score <= primary_email_benchmark) {
      emailChoice = "primary";
    } else if (score <= sec_email_benchmark) {
      emailChoice = "sec";
    } else {
      emailChoice = "backup";
    }

    if (emailChoice === "primary") {
      const data = await new Promise((resolve) =>
        chrome.storage.local.get(["primaryEmail"], resolve)
      );
      email = data.primaryEmail || "";
    } else {
      const data = await new Promise((resolve) =>
        chrome.storage.local.get(["additionalEmails"], resolve)
      );
      if (Array.isArray(data.additionalEmails)) {
        if (emailChoice === "sec") {
          const found = data.additionalEmails.find(
            (e) => e.label === "secondary"
          );
          if (found) email = found.email;
        } else {
          let found = data.additionalEmails.find((e) => e.label === "backup");
          if (!found)
            found = data.additionalEmails.find((e) => e.label === "secondary");
          if (found) email = found.email;
        }
      }
    }

    if (email) {
      await setDoc(userDocRef, { suggestedEmail: email }, { merge: true });
    }
  }

  return `
    <div id="email-choice" style="color: white;">
      <h3 style="color: white;">Suggested email:</h3>
      <span style="color: white;" id="email">${email}</span>
    </div>
  `;
}

function renderWebsiteBasics(urlObj) {
  if (!urlObj) return "";
  return `
    <h3 style="margin-bottom:4px;color: #f0f0f0">Website Basics</h3>
    <table class="security-table">
      <tr><th style="color: black;">Domain</th><td>${urlObj.domain}</td></tr>
      <tr><th style="color: black;">Hostname</th><td>${
        urlObj.hostname
      }</td></tr>
      <tr><th style="color: black;">Public Suffix</th><td>${
        urlObj.publicSuffix
      }</td></tr>
      <tr><th style="color: black;">Subdomain</th><td>${
        urlObj.subdomain || "-"
      }</td></tr>
      <tr><th style="color: black;">Is ICANN</th><td>${
        urlObj.isIcann ? "Yes" : "No"
      }</td></tr>
      <tr><th style="color: black;">Is IP</th><td>${
        urlObj.isIp ? "Yes" : "No"
      }</td></tr>
      <tr><th style="color: black;">Is Private</th><td>${
        urlObj.isPrivate ? "Yes" : "No"
      }</td></tr>
    </table>
  `;
}

function renderThirdPartyRequests(thirdpartyrequests) {
  if (!thirdpartyrequests || typeof thirdpartyrequests !== "object") return "";
  let html = `<h3 style="margin-bottom:4px;color: #f0f0f0">Third Party Requests</h3>
    <table class="security-table" style="color: #000000;">
      <tr>
        <th style="color: black;">Domain</th>
        <th style="color: black;">Whitelisted?</th>
        <th style="color: black;">Number of Requests</th>
        <th style="color: black;">Example URLs</th>
      </tr>
  `;
  for (const [domain, [urls, whitelisted]] of Object.entries(
    thirdpartyrequests
  )) {
    html += `
      <tr>
        <td>${domain}</td>
        <td style="color:${
          whitelisted ? "#4ade80" : "#f87171"
        };font-weight:600;">
          ${whitelisted ? "Yes" : "No"}
        </td>
        <td>${urls.length}</td>
        <td>
          <div style="max-width:250px;overflow-x:auto;font-size:12px;">
            ${urls
              .slice(0, 2)
              .map((u) => `<div>${u}</div>`)
              .join("")}
            ${
              urls.length > 2
                ? `<div style="color:#888;">+${urls.length - 2} more</div>`
                : ""
            }
          </div>
        </td>
      </tr>
    `;
  }
  html += "</table>";
  return html;
}

function renderCSP(csp) {
  if (!csp || typeof csp !== "object") return "";
  return `
    <h3 style="margin-bottom:4px;color: #f0f0f0">Content Security Policy (CSP)</h3>
    <table class="security-table">
      <tr>
        <th style="color: black;">Present in Header</th>
        <td>${csp.header ? "Yes" : "No"}</td>
      </tr>
      <tr>
        <th style="color: black;">Present in Meta</th>
        <td>${csp.meta ? "Yes" : "No"}</td>
      </tr>
      <tr>
        <th style="color: black;">Strict Dynamic</th>
        <td>${csp.policy && csp.policy.strictDynamic ? "Yes" : "No"}</td>
      </tr>
      <tr>
        <th style="color: black;">CSP Implemented</th>
        <td>${csp.implemented ? "Yes" : "No"}</td>
      </tr>
      <tr>
        <th style="color: black;">Data</th>
        <td>
          ${
            Array.isArray(csp.data) && csp.data.length > 0
              ? `<ul style="padding-left:18px;">${csp.data
                  .map((d) => `<li>${d}</li>`)
                  .join("")}</ul>`
              : "None"
          }
        </td>
      </tr>
    </table>
  `;
}

window.addEventListener("DOMContentLoaded", async function () {
  const resultElement = document.getElementById("security-results");
  const url = await getCurrentTabURL();
  if (
    !url ||
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://")
  ) {
    resultElement.textContent = "Cannot run on this page.";
    return;
  }
  const key = "securityResults_" + url;
  const fetchingKey = key + "_fetching";

  chrome.storage.local.get([key, fetchingKey], (data) => {
    if (data[fetchingKey]) {
      const text = `<p style="color: white;">Fetching results...</p>`;
      resultElement.innerHTML = text;
      pollForResults();
      return;
    }
    if (data[key] && Array.isArray(data[key]) && data[key].length === 2) {
      const [analysis, score] = data[key];
      let html = "";

      renderEmailChoice(score).then((emailHtml) => {
        html += emailHtml;
        html += renderScoreCircle(score);
        html += renderThirdPartyRequests(analysis.thirdpartyrequests);
        html += renderCSP(analysis.csp);
        html += renderWebsiteBasics(analysis.url);
        resultElement.innerHTML = html;
      });
      return;
    } else {
      const text = `<p style="color: white;">Fetching results...</p>`;
      resultElement.innerHTML = text;
      chrome.storage.local.set({ [fetchingKey]: true });
      console.log("fetching results for URL:", url);
      fetch("http://localhost:8100/check?fetch_url=" + encodeURIComponent(url))
        .then((res) => res.json())
        .then(([analysis, score]) => {
          chrome.storage.local.set(
            { [key]: [analysis, score], [fetchingKey]: false },
            () => {
              window.location.reload();
            }
          );
        })
        // .then((res) => res.json())
        // .then((result) => {
        //   chrome.storage.local.set(
        //     { [key]: result, [fetchingKey]: false },
        //     () => {
        //       window.location.reload();
        //     }
        //   );
        // })
        .catch((e) => {
          chrome.storage.local.set({ [fetchingKey]: false });
          resultElement.textContent = "Error fetching results: " + e.message;
        });
    }
  });

  function pollForResults() {
    setTimeout(() => {
      chrome.storage.local.get([key, fetchingKey], (data) => {
        if (!data[fetchingKey] && data[key]) {
          window.location.reload();
        } else if (data[fetchingKey]) {
          pollForResults();
        }
      });
    }, 1000);
  }

  chrome.storage.local.get(["username"], (data) => {
    const username = data.username;
    if (!username) {
      window.location.href = "index.html";
      return;
    }
    setupPage();
  });
});

function setupPage() {
  const expandBtn = document.getElementById("expand-extension");
  if (expandBtn) {
    expandBtn.addEventListener("click", function () {
      const settings = document.getElementById("settings");
      if (settings) {
        settings.style.display =
          settings.style.display === "none" ? "block" : "none";
      }
    });
  }

  chrome.storage.local.get(["multiDeviceSync"], (data) => {
    const checkbox = document.getElementById("multi-device-sync");
    if (checkbox) {
      checkbox.checked = !!data.multiDeviceSync;
      if (checkbox.checked) {
        fetchAllLocalStorage();
      }
      checkbox.addEventListener("change", (e) => {
        const enabled = e.target.checked;
        chrome.storage.local.set({ multiDeviceSync: enabled }, () => {
          if (enabled) {
            fetchAllLocalStorage();
          } else {
            chrome.storage.local.get(["username"], async (data) => {
              const username = data.username;
              if (!username) return;
              try {
                const userRef = doc(db, "users", username);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                  const userData = userSnap.data();
                  const createdAt = userData.createdAt;
                  const primaryEmail =
                    userData.primaryEmail || userData.email || null;
                  await setDoc(
                    userRef,
                    { createdAt, primaryEmail },
                    { merge: false }
                  );
                  console.log(
                    "Only createdAt and primaryEmail saved in Firestore for user:",
                    username
                  );
                }
              } catch (err) {
                console.error("Error removing fields from Firestore:", err);
              }
            });
          }
        });
      });
    }
  });
}

function hasNestedArray(obj) {
  if (Array.isArray(obj)) {
    return obj.some((item) => Array.isArray(item) || hasNestedArray(item));
  } else if (typeof obj === "object" && obj !== null) {
    return Object.values(obj).some((value) => hasNestedArray(value));
  }
  return false;
}

async function fetchAllLocalStorage() {
  chrome.storage.local.get(null, async (data) => {
    const username = data.username;
    if (!username) {
      console.error("No username found in local storage.");
      return;
    }

    const filtered = {};
    for (const [key, value] of Object.entries(data)) {
      if (hasNestedArray(value)) {
        console.warn(`Skipping key "${key}" due to nested arrays.`);
        continue;
      }
      filtered[key] = value;
    }

    try {
      await setDoc(doc(db, "users", username), filtered, { merge: true });
      console.log("Local storage data pushed to Firestore for user:", username);
    } catch (err) {
      console.error("Error pushing data to Firestore:", err);
    }
  });
}

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  const tab = tabs[0];
  const p = document.getElementById("form-detected");
  if (
    !tab ||
    !tab.url ||
    tab.url.startsWith("chrome://") ||
    tab.url.startsWith("chrome-extension://")
  ) {
    if (p) p.textContent = "Cannot run on this page.";
    return;
  }
  chrome.tabs.sendMessage(tab.id, { action: "checkForm" }, function (response) {
    if (chrome.runtime.lastError) {
      if (p) p.textContent = "Could not connect to content script.";
      return;
    }
    if (response && response.hasForm) {
      if (p) p.textContent = "Is signup/login form detected? Yes";
    } else {
      if (p) p.textContent = "Is signup/login form detected? No";
    }
  });
});


async function getCurrentTabURL() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs.length > 0) {
        resolve(tabs[0].url);
      } else {
        resolve(null);
      }
    });
  });
}

// document.getElementById("copy").addEventListener("click", function (e) {
//     e.preventDefault();
//     const email = document.getElementById("email").textContent;

//     navigator.clipboard.writeText(email)
//       .then(() => {
//         alert("Email copied to clipboard!");
//       })
//       .catch((err) => {
//         console.error("Failed to copy email:", err);
//       });
//   });

// document.getElementById("reject").addEventListener("click", function (e) {
//     e.preventDefault();
//     const element = document.getElementById("email-choice");
//     if (element) {
//       element.remove();
//     }

//   });

//   document.getElementById("accept").addEventListener("click", function (e) {
//     e.preventDefault();
//     const element = document.getElementById("choices");
//     if (element) {
//       element.remove();
//     }
//     const email = document.getElementById("email").textContent;
//     // alert("Email choice saved!");
//     //save

//   });
