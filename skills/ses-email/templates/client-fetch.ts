/**
 * Client-side email helper — web OR mobile (React, React Native, etc.).
 *
 * This is the ONLY email code that runs on the client, and it contains NO AWS
 * anything. It just POSTs to YOUR backend endpoint (the Next.js route / Lambda /
 * API server), which holds the SES credentials and does the actual sending.
 *
 * Sending SES directly from a client would embed AWS keys in a bundle anyone can
 * extract — never do that. Keep this boundary.
 */
export type SendEmailInput = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

/**
 * @param input   the message
 * @param opts.endpoint  your backend route (default "/api/send-email")
 * @param opts.authToken forwarded as `Authorization: Bearer <token>` if provided
 */
export async function sendEmail(
  input: SendEmailInput,
  opts: { endpoint?: string; authToken?: string } = {}
): Promise<{ messageId: string }> {
  const res = await fetch(opts.endpoint ?? "/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.authToken ? { Authorization: `Bearer ${opts.authToken}` } : {}),
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.error ?? `Email request failed (${res.status})`);
  }
  return res.json();
}
