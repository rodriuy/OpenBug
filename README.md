# Open Bug Reporter

Open source bug reporting toolkit for web teams. A **Developer** can capture and annotate the current browser view from a Chrome extension, then submit the report to a **QA Tester** by email using Firebase Cloud Functions + Resend.

## Tech Stack
- Chrome Extension (Manifest V3)
- Firebase Cloud Functions v2 (Node.js 20)
- Resend (email delivery)

## Project Structure
```text
.
├─ extension/
│  ├─ manifest.json
│  ├─ background.js
│  ├─ content.js
│  ├─ popup.html
│  ├─ popup.css
│  ├─ popup.js
│  ├─ config.js
│  └─ config.example.js
├─ firebase/
│  └─ functions/
│     ├─ index.js             # HTTP endpoint: submitBugReport
│     ├─ package.json
│     └─ .env.example
├─ dist/
├─ .firebaserc.example
└─ firebase.json
```

## How It Works
1. The **Developer** opens the extension popup and fills name, bug description, and optional steps.
2. `background.js` captures the visible tab with `chrome.tabs.captureVisibleTab`.
3. `content.js` opens a full-screen canvas for annotation (red brush + rectangle).
4. The Developer clicks **Finish and Send**.
5. The extension sends a `POST` request to `submitBugReport` with:
   - `comentario`
   - `pasos`
   - `url`
   - `resolucion`
   - `imagenBase64`
6. Firebase Function sends an email with the annotated screenshot attachment to the **QA Tester**.

## Requirements
- Node.js 20+
- Firebase CLI
- Firebase project on **Blaze** plan (required for Functions v2)
- Resend account with a verified sending domain (for example: `your-domain.com`)

## 1) Backend Setup (Firebase Functions)
From `firebase/functions`:

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
QA_REPORT_TO=YOUR_EMAIL@example.com
QA_REPORT_FROM=Open Bug Reporter <no-reply@your-domain.com>
```

Notes:
- `QA_REPORT_TO`: mailbox used by the QA Tester.
- `QA_REPORT_FROM`: verified sender identity in Resend.

Optional (legacy Firebase config support in code):

```bash
firebase functions:config:set resend.api_key="re_xxxxxxxxxxxxxxxxxxxxx"
```

## 2) Firebase Project Setup
1. Duplicate `.firebaserc.example` as `.firebaserc`.
2. Replace `your-firebase-project-id` with your real project id.

Example:
```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

## 3) Deploy Function
From project root:

```bash
firebase login
firebase deploy --only functions:submitBugReport
```

Check logs:

```bash
firebase functions:log --only submitBugReport
```

## 4) Extension Setup
Copy the example config and set your deployed function URL:

```bash
cp extension/config.example.js extension/config.js
```

Then edit `extension/config.js`:

```js
export const APP_CONFIG = {
  functionUrl: "https://us-central1-your-project-id.cloudfunctions.net/submitBugReport"
};
```

## 5) Load Extension in Chrome
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `extension/`.

## Host Permissions (MV3)
`extension/manifest.json` includes:

```json
"host_permissions": [
  "https://*.cloudfunctions.net/*",
  "https://*.run.app/*"
]
```

This is required for `fetch` calls from the extension to Firebase endpoints in Manifest V3.

## End-to-End Test
1. Open a normal website (`http://` or `https://`).
2. Open extension popup.
3. Fill report fields and click **Capture and annotate**.
4. Draw on screenshot and click **Finish and Send**.
5. Confirm email arrives in the QA Tester inbox.

## Troubleshooting
- `Manifest file is missing or unreadable`
  - You selected the wrong folder. Load the folder that contains `manifest.json`.

- `Could not establish connection. Receiving end does not exist`
  - Reload the extension in `chrome://extensions`.
  - Retry on an `http/https` page (not `chrome://`).

- Firebase deploy error related to billing/APIs
  - Enable Blaze plan and retry deployment.

## License
MIT (see `LICENSE`).
