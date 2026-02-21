import { APP_CONFIG } from "./config.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "START_BUG_REPORT") {
    return;
  }

  handleStartBugReport(message.payload)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

async function handleStartBugReport(payload) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("Could not detect the active tab.");
  }
  if (!isSupportedUrl(tab.url)) {
    throw new Error("Open an HTTP/HTTPS website and try again.");
  }

  const screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png"
  });

  await sendMessageToEditor(tab.id, {
    type: "OPEN_BUG_EDITOR",
    payload: {
      functionUrl: APP_CONFIG.functionUrl,
      screenshotDataUrl,
      report: {
        reporter: payload.reporter,
        comentario: payload.comentario,
        pasos: payload.pasos || "",
        pageUrl: tab.url || ""
      }
    }
  });
}

function isSupportedUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

async function sendMessageToEditor(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return;
  } catch (error) {
    const msg = String(error?.message || "");
    const isMissingReceiver = msg.includes("Receiving end does not exist");
    if (!isMissingReceiver) {
      throw error;
    }
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  } catch (error) {
    throw new Error("Cannot inject script on this tab. Try a regular website.");
  }

  await chrome.tabs.sendMessage(tabId, message);
}
