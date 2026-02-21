(() => {
  const TOOL_BRUSH = "brush";
  const TOOL_RECT = "rect";
  const DRAW_COLOR = "#e03131";

  let overlayRoot = null;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "OPEN_BUG_EDITOR") {
      return;
    }

    openEditor(message.payload).catch((error) => {
      console.error("Error opening bug editor:", error);
    });

    sendResponse({ ok: true });
  });

  async function openEditor(payload) {
    if (!payload?.screenshotDataUrl || !payload?.functionUrl) {
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

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const screenshot = await loadImage(payload.screenshotDataUrl);
    ctx.drawImage(screenshot, 0, 0, canvas.width, canvas.height);

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
      report: payload.report,
      functionUrl: payload.functionUrl
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

        const imagenBase64 = canvas.toDataURL("image/png");
        const comentario = `${state.report.reporter}: ${state.report.comentario}`;

        const response = await fetch(state.functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            comentario,
            pasos: state.report.pasos || "Not provided",
            url: state.report.pageUrl || window.location.href,
            resolucion: `${window.innerWidth}x${window.innerHeight}`,
            imagenBase64
          })
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || `HTTP ${response.status}`);
        }

        status.textContent = "Report sent successfully";
        setTimeout(closeEditor, 900);
      } catch (error) {
        console.error(error);
        sendBtn.disabled = false;
        status.textContent = "Send failed. Check browser console.";
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

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not load screenshot."));
      image.src = src;
    });
  }
})();
