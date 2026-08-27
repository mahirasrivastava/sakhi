// security/email.js
// Outbound transactional email — email verification and password reset only.
//
// Follows the same zero-config philosophy as the rest of Sakhi: with no SMTP
// settings the app still runs, and email is delivered to the SERVER CONSOLE
// instead of an inbox. That is a real dev/demo mode (you copy the link from the
// terminal), not a broken one — so a judge can clone and demo forgot-password
// without owning a mail server. Set SMTP_* for a real deployment.
//
// nodemailer is imported dynamically and ONLY when SMTP is configured, so the
// app boots even if the dependency isn't installed yet. Run `npm install` in
// server/ to pull it in before enabling SMTP.

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER || "Sakhi <no-reply@sakhi.local>";

export const isEmailConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transportPromise = null;

// Built once, lazily. A bad SMTP config should surface on first send with a
// clear log line, not crash the whole server at boot.
async function getTransport() {
  if (!isEmailConfigured) return null;
  if (!transportPromise) {
    transportPromise = (async () => {
      try {
        const nodemailer = (await import("nodemailer")).default;
        return nodemailer.createTransport({
          host: SMTP_HOST,
          port: SMTP_PORT,
          secure: SMTP_PORT === 465, // 465 = implicit TLS; 587 = STARTTLS
          auth: { user: SMTP_USER, pass: SMTP_PASS },
        });
      } catch (err) {
        console.error("[email] nodemailer not available — run `npm install` in server/. Falling back to console.", err?.message);
        return null;
      }
    })();
  }
  return transportPromise;
}

/**
 * Send one email. Never throws — a failed send must not take down the request
 * that triggered it (a signup should still succeed even if the confirmation
 * mail bounces). Returns { ok, delivered: "smtp" | "console" }.
 */
async function send({ to, subject, text, html }) {
  const transport = await getTransport();

  if (!transport) {
    // Console fallback. In dev this is how you read the verification link.
    console.log("\n" + "─".repeat(64));
    console.log(`[email:console] To: ${to}`);
    console.log(`[email:console] Subject: ${subject}`);
    console.log(`[email:console]\n${text}`);
    console.log("─".repeat(64) + "\n");
    return { ok: true, delivered: "console" };
  }

  try {
    await transport.sendMail({ from: MAIL_FROM, to, subject, text, html });
    return { ok: true, delivered: "smtp" };
  } catch (err) {
    console.error("[email] SMTP send failed:", err?.message);
    // Still log to console so the flow is recoverable in an emergency.
    console.log(`[email:fallback] To: ${to} — ${subject}\n${text}`);
    return { ok: false, delivered: "console" };
  }
}

const APP_NAME = "Sakhi";

export function sendVerificationEmail(to, { handle, url, code }) {
  const subject = `${APP_NAME}: confirm your email`;
  const text =
    `Hello ${handle},\n\n` +
    `Confirm this email address for your ${APP_NAME} account:\n\n${url}\n\n` +
    (code ? `Or enter this code in the app: ${code}\n\n` : "") +
    `This link expires in 24 hours. If you didn't create a ${APP_NAME} account, ignore this email.\n`;
  return send({ to, subject, text });
}

export function sendPasswordResetEmail(to, { handle, url, code }) {
  const subject = `${APP_NAME}: reset your password`;
  const text =
    `Hello ${handle},\n\n` +
    `Someone asked to reset the password for your ${APP_NAME} account.\n` +
    `If it was you, use this link:\n\n${url}\n\n` +
    (code ? `Or enter this code in the app: ${code}\n\n` : "") +
    `This link expires in 1 hour. If it wasn't you, ignore this email — your password stays unchanged.\n`;
  return send({ to, subject, text });
}
