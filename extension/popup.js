import { APP_CONFIG } from "./config.js";

const form = document.getElementById("qa-form");
const reporterInput = document.getElementById("reporter");
const comentarioInput = document.getElementById("comentario");
const pasosInput = document.getElementById("pasos");
const startBtn = document.getElementById("start-btn");
const status = document.getElementById("status");

chrome.storage.local.get(["open_bug_reporter_developer"], (result) => {
  if (result.open_bug_reporter_developer) {
    reporterInput.value = result.open_bug_reporter_developer;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const reporter = reporterInput.value.trim();
  const comentario = comentarioInput.value.trim();
  const pasos = pasosInput.value.trim();

  if (!reporter || !comentario) {
    status.textContent = "Developer name and bug description are required.";
    return;
  }

  if (!APP_CONFIG.functionUrl.includes("cloudfunctions.net") && !APP_CONFIG.functionUrl.includes("run.app")) {
    status.textContent = "Set your Firebase Function URL in config.js";
    return;
  }

  chrome.storage.local.set({ open_bug_reporter_developer: reporter });

  startBtn.disabled = true;
  status.textContent = "Capturing screen...";

  try {
    const response = await chrome.runtime.sendMessage({
      type: "START_BUG_REPORT",
      payload: {
        reporter,
        comentario,
        pasos
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
