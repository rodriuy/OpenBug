# Open Bug Reporter

English | [Español](README.es.md)

This tool came from a real team bottleneck: bug reports sent by chat usually miss context and waste time.
With Open Bug Reporter, a **QA Tester** can capture and annotate the current screen, and a **Developer** receives the report by email in seconds.

It is intentionally simple: fast reporting, clear context, low setup friction.

## Stack
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

## Real Flow
1. Reporter opens the popup and fills name, comment, and optional steps.
2. `background.js` captures the active tab screenshot.
3. `content.js` opens a full-screen overlay to annotate (brush + rectangle).
4. `content.js` sends JSON to the backend.
5. `submitBugReport` validates payload and sends an email with PNG attachment.

Current payload:
- `developer`
- `comment`
- `steps`
- `pageUrl`
- `viewport`
- `imageBase64`

Compatibility note: frontend and backend still accept legacy keys (`comentario`, `pasos`, etc.) during migrations.

## Requirements
- Node.js 20+
- Firebase CLI
- Firebase project on Blaze plan
- Verified Resend domain (`your-domain.com`)

## 1) Configure Functions
```bash
cd firebase/functions
npm install
cp .env.example .env
```

Edit `.env`:
```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
QA_REPORT_TO=YOUR_EMAIL@example.com
QA_REPORT_FROM=Open Bug Reporter <no-reply@your-domain.com>
```

`QA_REPORT_TO` is the report recipient mailbox (commonly a Developer inbox).

## 2) Configure Firebase Project
```bash
cp .firebaserc.example .firebaserc
```

Then replace the project id in `.firebaserc`:
```json
{
  "projects": {
    "default": "your-firebase-project-id"
  }
}
```

## 3) Deploy
From project root:
```bash
firebase login
firebase deploy --only functions:submitBugReport
```

Logs:
```bash
firebase functions:log --only submitBugReport
```

## 4) Configure Extension
```bash
cp extension/config.example.js extension/config.js
```

Edit `extension/config.js`:
```js
export const APP_CONFIG = {
  functionUrl: "https://us-central1-your-project-id.cloudfunctions.net/submitBugReport"
};
```

## 5) Load in Chrome
1. Go to `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select `extension/`

## Troubleshooting
- `Receiving end does not exist`
  - Common right after reloading the extension. The background script attempts runtime injection of `content.js`.

- Deploy fails due to billing/APIs
  - Enable Blaze and redeploy.

- Email is not delivered
  - Verify `RESEND_API_KEY`, domain verification status, and function logs.

## Known Limitations
- Endpoint is public by default. Add auth/rate-limit if exposed to the internet.
- Very large screenshots can fail due to payload size limits.

## License
MIT (`LICENSE`).
