/**
 * Reusable SES sender — AWS SDK v3 (@aws-sdk/client-sesv2).
 * BACKEND ONLY. Never import this into browser/mobile code.
 *
 * Install: npm i @aws-sdk/client-sesv2
 * Env: AWS_REGION, SES_FROM (a verified SES identity), and AWS credentials via
 *      the standard SDK chain (env vars locally; IAM role in Lambda/ECS/EC2).
 *      SES_FROM is per-app config — pass `from` to override per call if needed.
 */
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const client = new SESv2Client({ region: process.env.AWS_REGION || "us-east-1" });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Send a transactional email.
 * @param {{to:string|string[], subject:string, html?:string, text?:string,
 *          from?:string, replyTo?:string|string[]}} msg
 * @returns {Promise<{messageId:string}>}
 */
export async function sendEmail(msg) {
  const from = msg.from || process.env.SES_FROM;
  const to = Array.isArray(msg.to) ? msg.to : [msg.to];

  // Validate at the boundary — never trust the caller.
  if (!from) throw new Error("SES_FROM not set (must be a verified SES identity)");
  if (!to.length || to.some((a) => !EMAIL_RE.test(a))) throw new Error("Invalid 'to' address");
  if (!msg.subject?.trim()) throw new Error("Missing 'subject'");
  if (!msg.html && !msg.text) throw new Error("Provide 'html' or 'text' body");

  const body = {};
  if (msg.html) body.Html = { Data: msg.html, Charset: "UTF-8" };
  if (msg.text) body.Text = { Data: msg.text, Charset: "UTF-8" };

  try {
    const out = await client.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: to },
        ReplyToAddresses: msg.replyTo ? [].concat(msg.replyTo) : undefined,
        Content: { Simple: { Subject: { Data: msg.subject, Charset: "UTF-8" }, Body: body } },
      })
    );
    return { messageId: out.MessageId };
  } catch (err) {
    // Surface the real SES failure (unverified sender, sandbox recipient,
    // throttling, suppression-list hit) instead of a generic error.
    throw new Error(`SES send failed [${err.name}]: ${err.message}`);
  }
}
