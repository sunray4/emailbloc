# EmailBloc (Privathon 2025)

## Inspiration 🧠
Too often, users reuse the same email address across websites with varying levels of trustworthiness. One data breach can compromise everything. We wanted to give users control by assigning importance-based emails and analyzing a site's behaviour before they even register.

## What it does ⚙️
EmailBloc is a Chrome extension that chooses the right email for every website signup based on the website's security and your intended usage. It automatically analyzes privacy risks—like third-party cookies and insecure connections—and selects one of your predefined emails (important, less important, unimportant, etc.). This keep your primary inbox safe and declutters spam from risky sites.

## How we built it 👷🔧
- JavaScript and Vite for the extension framework,
- Chrome Extension APIs (i.e. scripting, local storage, tabs, content scripts, puppeteer),
- Firebase Firestore (database for multi-device sync),
- Manual content script injector (using Chrome's scripting.exectuteScript to bypass CSP issues),
- Web privacy evaluation model modified from open source program Webbkoll

## Challenges we ran into 💀
- Chrome would not recognize its content.js script for reading web content, so we had to use a workaround to use a script injector.
- Vite's module system conflicted with Chrome's CSP rules, which broke our content script injection code. We fixed this by copying unbundled content scripts via vite-plugin-static-copy and using chrome.scripting for injection.
- Our privacy evaluation model is a little slow (as it has to wait for all requests to be complete), which takes away from the overall user experience. We solved this by running the model with low background resources when the page loads, so information will be available to the users every time the extension is opened.
- We had to restructure some files into a public/ folder to avoid Vite treating the content scripts as modules
- First-time extension builders here, so we had extremely limited time to read up the docs and complete the project.

## Accomplishments that we're proud of 🎉
- Built a working Chrome extension (first time for all of us) that connects form detection, privacy analysis, and smart email selection.
- Has an optional cloud sync, which keeps the data synced for all devices. It's disabled by default to keep all data private and on-device.

##  What we learned 📝
- How Chrome extensions operate under Manifest V3 and CSP rules
- Programmatically inject content scripts to avoid Vite's default bundling strategy
- Complexity of real-time privacy analysis with limited resources
- Transfer of data between extension and backend server.

## What's next for EmailBloc 🔮
- Security scoring model with more evaluations, such as also evaluating the referrer policy of the website.
- Autofill login/signup forms with selected emails and generate passwords
- Remember which email were used for different websites (all stored on-device)
- More privacy indicators, like DNS lookup, DNS records, etc.
- Increased account security
