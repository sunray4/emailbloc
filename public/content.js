chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkForm") {
    let hasAuthForm = false;
    const forms = document.querySelectorAll("form");
    formsLoop: for (const form of forms) {
      let hasPassword = false;
      let hasUserField = false;
      for (const input of form.querySelectorAll("input")) {
        const type = input.type.toLowerCase();
        if (type === "password") hasPassword = true;
        if (
          type === "text" ||
          type === "email" ||
          input.name.toLowerCase().includes("user") ||
          input.name.toLowerCase().includes("login") ||
          input.name.toLowerCase().includes("email")
        ) {
          hasUserField = true;
        }
      }

      const buttons = form.querySelectorAll("button, input[type=submit]");
      let hasAuthButton = false;
      for (const btn of buttons) {
        const btnText = (btn.textContent || "") + (btn.value || "");
        if (/(login|log in|sign in|signup|sign up|register)/i.test(btnText)) {
          hasAuthButton = true;
          break;
        }
      }
      if (hasPassword && hasUserField && hasAuthButton) {
        hasAuthForm = true;
        break formsLoop;
      }
    }
    sendResponse({ hasForm: hasAuthForm });
  }
});