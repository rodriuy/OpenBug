import { APP_CONFIG } from "./config.js";

const MSG_START = "START_BUG_REPORT";
const MSG_OPEN_EDITOR = "OPEN_BUG_EDITOR";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== MSG_START) {
    return;
  }

  startBugFlow(message.payload)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

async function startBugFlow(payload) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("Could not detect the active tab.");
  }
  if (!isSupportedUrl(tab.url)) {
    throw new Error("Open an HTTP/HTTPS website and try again.");
  }

  const shotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
    format: "png"
  });

  await openEditor(tab.id, {
    type: MSG_OPEN_EDITOR,
    payload: {
      functionUrl: APP_CONFIG.functionUrl,
      shotDataUrl,
      report: {
        developer: payload?.developer || payload?.reporter || "",
        comment: payload?.comment || payload?.comentario || "",
        steps: payload?.steps || payload?.pasos || "",
        pageUrl: tab.url || ""
      }
    }
  });
}

function isSupportedUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

async function openEditor(tabId, message) {
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
    // After extension reload, content scripts are often missing on old tabs.
    // Inject on-demand instead of forcing the user to reload the page.
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
  } catch (error) {
    throw new Error("Cannot inject script on this tab. Try a regular website.");
  }

  await chrome.tabs.sendMessage(tabId, message);
}
