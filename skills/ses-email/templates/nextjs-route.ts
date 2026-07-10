/**
 * Next.js App Router — POST /api/send-email  (server-only; runs on the backend).
 * The browser/mobile client calls THIS endpoint; AWS creds live here, never in
 * the client. Add your own auth (session/JWT/API key) before sending.
 *
 * Install: npm i @aws-sdk/client-sesv2
 * Env: AWS_REGION, SES_FROM (verified identity), AWS credentials via SDK chain.
 * Place at: app/api/send-email/route.ts
 */
import { NextResponse } from "next/server";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

export const runtime = "nodejs"; // SES SDK needs Node, not the Edge runtime.

const client = new SESv2Client({ region: process.env.AWS_REGION || "us-east-1" });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  // TODO: authenticate the caller (session/JWT) and authorize what they may send.
  let payload: { to?: string; subject?: string; html?: string; text?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { to, subject, html, text } = payload;
  const from = process.env.SES_FROM;

  if (!from) return NextResponse.json({ error: "Server misconfigured: SES_FROM unset" }, { status: 500 });
  if (!to || !EMAIL_RE.test(to)) return NextResponse.json({ error: "Invalid 'to'" }, { status: 400 });
  if (!subject?.trim()) return NextResponse.json({ error: "Missing 'subject'" }, { status: 400 });
  if (!html && !text) return NextResponse.json({ error: "Provide 'html' or 'text'" }, { status: 400 });

  try {
    const out = await client.send(
      new SendEmailCommand({
        FromEmailAddress: from,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: {
              ...(html ? { Html: { Data: html, Charset: "UTF-8" } } : {}),
              ...(text ? { Text: { Data: text, Charset: "UTF-8" } } : {}),
            },
          },
        },
      })
    );
    return NextResponse.json({ messageId: out.MessageId });
  } catch (err: any) {
    console.error("SES send failed", err?.name, err?.message);
    return NextResponse.json({ error: `Email failed: ${err?.name ?? "Error"}` }, { status: 502 });
  }
}
