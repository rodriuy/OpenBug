"use strict";

const { onRequest } = require("firebase-functions/v2/https");
const functions = require("firebase-functions");
const logger = require("firebase-functions/logger");
const { Resend } = require("resend");

require("dotenv").config();

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getResendApiKey() {
  if (process.env.RESEND_API_KEY) {
    return process.env.RESEND_API_KEY;
  }

  try {
    return functions.config().resend?.api_key || "";
  } catch (error) {
    logger.info("functions.config unavailable. Using .env", error.message);
    return "";
  }
}

exports.submitBugReport = onRequest(
  {
    region: "us-central1",
    cors: true,
    invoker: "public"
  },
  async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { comentario, pasos, url, resolucion, imagenBase64 } = req.body || {};

    if (
      typeof comentario !== "string" ||
      typeof pasos !== "string" ||
      typeof url !== "string" ||
      typeof resolucion !== "string" ||
      typeof imagenBase64 !== "string"
    ) {
      return res.status(400).json({
        ok: false,
        error: "Invalid payload. Include comentario, pasos, url, resolucion, and imagenBase64."
      });
    }

    const apiKey = getResendApiKey();
    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "Missing RESEND_API_KEY in Functions environment"
      });
    }

    const resend = new Resend(apiKey);
    const reportTo = process.env.QA_REPORT_TO || "YOUR_EMAIL@example.com";
    const reportFrom = process.env.QA_REPORT_FROM || "Open Bug Reporter <no-reply@your-domain.com>";

    const imageMatch = imagenBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    const imageContent = imageMatch ? imageMatch[2] : imagenBase64;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2 style="margin-bottom:4px">New bug report for QA Tester</h2>
        <p style="margin-top:0;color:#475569">Open Bug Reporter</p>
        <hr style="border:none;border-top:1px solid #e2e8f0" />
        <p><strong>Developer comment:</strong><br/>${escapeHtml(comentario)}</p>
        <p><strong>Steps to reproduce:</strong><br/>${escapeHtml(pasos)}</p>
        <p><strong>URL:</strong><br/>${escapeHtml(url)}</p>
        <p><strong>Resolution:</strong> ${escapeHtml(resolucion)}</p>
        <p><strong>Date:</strong> ${new Date().toISOString()}</p>
      </div>
    `;

    try {
      const { data, error } = await resend.emails.send({
        from: reportFrom,
        to: [reportTo],
        subject: `Bug Report - ${url.slice(0, 80)}`,
        html,
        attachments: [
          {
            filename: `bug-report-${Date.now()}.png`,
            content: imageContent
          }
        ]
      });

      if (error) {
        logger.error("Resend API error", error);
        return res.status(502).json({ ok: false, error: error.message || "Resend API error" });
      }

      return res.status(200).json({ ok: true, id: data?.id || null });
    } catch (error) {
      logger.error("Error sending bug report email", error);
      return res.status(500).json({ ok: false, error: "Could not send email" });
    }
  }
);
