import { APP_CONFIG } from "./config.js";

const MSG_START = "START_BUG_REPORT";
const STORAGE_DEV = "obr.devName";

const form = document.getElementById("bug-form");
const developerInput = document.getElementById("developer");
const commentInput = document.getElementById("comment");
const stepsInput = document.getElementById("steps");
const startBtn = document.getElementById("start-btn");
const status = document.getElementById("status");

chrome.storage.local.get([STORAGE_DEV], (result) => {
  if (result[STORAGE_DEV]) {
    developerInput.value = result[STORAGE_DEV];
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const developer = developerInput.value.trim();
  const comment = commentInput.value.trim();
  const steps = stepsInput.value.trim();

  if (!developer || !comment) {
    status.textContent = "Developer name and bug description are required.";
    return;
  }

  if (!isFunctionUrl(APP_CONFIG.functionUrl)) {
    status.textContent = "Set your Firebase Function URL in config.js";
    return;
  }

  chrome.storage.local.set({ [STORAGE_DEV]: developer });

  startBtn.disabled = true;
  status.textContent = "Capturing screen...";

  try {
    const response = await chrome.runtime.sendMessage({
      type: MSG_START,
      payload: {
        developer,
        comment,
        steps
      }
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Could not open the editor on the active tab.");
    }

    status.textContent = "Editor opened on active tab.";
    window.close();
  } catch (error) {
    status.textContent = error.message || "Unexpected error.";
    startBtn.disabled = false;
  }
});

function isFunctionUrl(value) {
  if (typeof value !== "string") {
    return false;
  }
  return value.includes("cloudfunctions.net") || value.includes("run.app");
}
