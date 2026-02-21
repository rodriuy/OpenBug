(() => {
  const MSG_OPEN_EDITOR = "OPEN_BUG_EDITOR";
  const TOOL_BRUSH = "brush";
  const TOOL_RECT = "rect";
  const DRAW_COLOR = "#e03131";
  const REQUEST_TIMEOUT_MS = 20000;
  const MAX_IMAGE_DATA_URL_LEN = 10_000_000;

  let overlayRoot = null;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== MSG_OPEN_EDITOR) {
      return;
    }

    openEditor(message.payload).catch((error) => {
      console.error("Error opening bug editor:", error);
    });

    sendResponse({ ok: true });
  });

  async function openEditor(payload) {
    const shotDataUrl = payload?.shotDataUrl || payload?.screenshotDataUrl;
    if (!shotDataUrl || !payload?.functionUrl) {
      throw new Error("Incomplete payload for bug editor.");
    }

    closeEditor();

    overlayRoot = document.createElement("div");
    overlayRoot.id = "open-bug-overlay";
    overlayRoot.innerHTML = `
      <style>
        #open-bug-overlay {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          background: rgba(6, 17, 31, 0.84);
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(1.5px);
        }

        #open-bug-canvas-wrap {
          position: relative;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
        }

        #open-bug-canvas {
          width: 100%;
          height: 100%;
          cursor: crosshair;
          display: block;
        }

        #open-bug-toolbar {
          position: fixed;
          top: 14px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 8px;
          align-items: center;
          padding: 8px;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.92);
          border: 1px solid rgba(148, 163, 184, 0.22);
          font-family: "Segoe UI", "Helvetica Neue", sans-serif;
          color: #e2e8f0;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
        }

        .open-bug-btn {
          border: 0;
          border-radius: 10px;
          padding: 8px 10px;
          font-size: 12px;
          line-height: 1;
          font-weight: 600;
          cursor: pointer;
          color: #0f172a;
          background: #e2e8f0;
        }

        .open-bug-btn[data-active="true"] {
          background: #ef4444;
          color: #ffffff;
        }

        .open-bug-btn--primary {
          background: #06b6d4;
          color: #042f2e;
        }

        .open-bug-btn--ghost {
          background: #cbd5e1;
          color: #1e293b;
        }

        #open-bug-status {
          min-width: 150px;
          font-size: 12px;
          color: #cbd5e1;
          text-align: right;
          padding-left: 4px;
        }
      </style>
      <div id="open-bug-canvas-wrap">
        <canvas id="open-bug-canvas"></canvas>
      </div>
      <div id="open-bug-toolbar">
        <button class="open-bug-btn" id="open-tool-brush" data-tool="brush" data-active="true">Red Brush</button>
        <button class="open-bug-btn" id="open-tool-rect" data-tool="rect" data-active="false">Rectangle</button>
        <button class="open-bug-btn open-bug-btn--primary" id="open-send-btn">Finish and Send</button>
        <button class="open-bug-btn open-bug-btn--ghost" id="open-close-btn">Cancel</button>
        <span id="open-bug-status">Ready to annotate</span>
      </div>
    `;

    document.documentElement.appendChild(overlayRoot);

    const canvas = overlayRoot.querySelector("#open-bug-canvas");
    const ctx = canvas.getContext("2d");
    const brushBtn = overlayRoot.querySelector("#open-tool-brush");
    const rectBtn = overlayRoot.querySelector("#open-tool-rect");
    const sendBtn = overlayRoot.querySelector("#open-send-btn");
    const closeBtn = overlayRoot.querySelector("#open-close-btn");
    const status = overlayRoot.querySelector("#open-bug-status");

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    canvas.width = Math.floor(viewW * dpr);
    canvas.height = Math.floor(viewH * dpr);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    ctx.scale(dpr, dpr);

    const screenshot = await loadImage(shotDataUrl);
    ctx.drawImage(screenshot, 0, 0, viewW, viewH);

    ctx.strokeStyle = DRAW_COLOR;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const state = {
      tool: TOOL_BRUSH,
      isDrawing: false,
      startX: 0,
      startY: 0,
      snapshot: null,
      report: normalizeReport(payload.report),
      functionUrl: payload.functionUrl,
      viewport: `${viewW}x${viewH}`
    };

    const setTool = (tool) => {
      state.tool = tool;
      brushBtn.dataset.active = String(tool === TOOL_BRUSH);
      rectBtn.dataset.active = String(tool === TOOL_RECT);
    };

    brushBtn.addEventListener("click", () => setTool(TOOL_BRUSH));
    rectBtn.addEventListener("click", () => setTool(TOOL_RECT));

    closeBtn.addEventListener("click", closeEditor);

    sendBtn.addEventListener("click", async () => {
      try {
        sendBtn.disabled = true;
        status.textContent = "Sending report to QA Tester...";

        const imageBase64 = canvas.toDataURL("image/png");
        if (imageBase64.length > MAX_IMAGE_DATA_URL_LEN) {
          throw new Error("Screenshot is too large. Try again with less zoom.");
        }

        const payload = {
          developer: state.report.developer,
          comment: state.report.comment,
          steps: state.report.steps || "Not provided",
          pageUrl: state.report.pageUrl || window.location.href,
          viewport: state.viewport,
          imageBase64,
          // Future-me note: keep legacy keys for older functions during upgrades.
          comentario: state.report.comment,
          pasos: state.report.steps || "Not provided",
          url: state.report.pageUrl || window.location.href,
          resolucion: state.viewport,
          imagenBase64: imageBase64
        };

        const response = await postJson(state.functionUrl, payload, REQUEST_TIMEOUT_MS);
        if (!response.ok) {
          throw new Error(response.error || `HTTP ${response.status}`);
        }

        status.textContent = "Report sent successfully";
        setTimeout(closeEditor, 900);
      } catch (error) {
        console.error(error);
        sendBtn.disabled = false;
        status.textContent = error.message || "Send failed. Check browser console.";
      }
    });

    canvas.addEventListener("pointerdown", (event) => {
      const point = getPoint(canvas, event);
      state.isDrawing = true;

      if (state.tool === TOOL_BRUSH) {
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
      } else {
        state.startX = point.x;
        state.startY = point.y;
        state.snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!state.isDrawing) {
        return;
      }

      const point = getPoint(canvas, event);

      if (state.tool === TOOL_BRUSH) {
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      } else {
        ctx.putImageData(state.snapshot, 0, 0);
        const width = point.x - state.startX;
        const height = point.y - state.startY;
        ctx.strokeRect(state.startX, state.startY, width, height);
      }
    });

    const stopDrawing = () => {
      if (!state.isDrawing) {
        return;
      }

      state.isDrawing = false;
      ctx.beginPath();
      state.snapshot = null;
    };

    canvas.addEventListener("pointerup", stopDrawing);
    canvas.addEventListener("pointercancel", stopDrawing);
    canvas.addEventListener("pointerleave", stopDrawing);

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        closeEditor();
      }
    };

    overlayRoot.addEventListener("keydown", onKeyDown);
    overlayRoot.tabIndex = 0;
    overlayRoot.focus();
  }

  function closeEditor() {
    if (overlayRoot) {
      overlayRoot.remove();
      overlayRoot = null;
    }
  }

  function getPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function normalizeReport(input = {}) {
    return {
      developer: String(input.developer || input.reporter || "").trim(),
      comment: String(input.comment || input.comentario || "").trim(),
      steps: String(input.steps || input.pasos || "").trim(),
      pageUrl: String(input.pageUrl || input.url || "").trim()
    };
  }

  async function postJson(url, body, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      const text = await res.text();
      let data = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { error: text };
        }
      }

      return {
        ok: res.ok && data?.ok !== false,
        status: res.status,
        error: data?.error,
        data
      };
    } catch (error) {
      if (error.name === "AbortError") {
        return { ok: false, status: 408, error: "Request timed out. Check network or function URL." };
      }
      return { ok: false, status: 0, error: error.message || "Request failed" };
    } finally {
      clearTimeout(timer);
    }
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load screenshot."));
      image.src = src;
    });
  }
})();
