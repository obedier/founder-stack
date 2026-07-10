---
name: ses-email
version: 1.0.0
description: |
  Generate production-grade Amazon SES email-sending code for any web or mobile
  app. Writes a reusable backend sender (Node/AWS SDK v3, Next.js route, Lambda,
  or Python/boto3) with input validation, error handling, and bounce/suppression
  awareness — and enforces the golden rule that AWS credentials live ONLY on the
  backend, never in a browser or mobile bundle. Covers sandbox vs production,
  verified-sender requirements, and SMTP vs API. Triggers: "send email", "ses",
  "email service", "transactional email", "wire up email sending", "email
  verification / password reset email", "add email to my app".
origin: custom
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# /ses-email — SES email sending for web & mobile (backend-owned)

Generates the code to send transactional email through Amazon SES for whatever
stack the project uses. It is a **code generator + integration guide**, not a
runtime service: point it at a project, pick the target, and it writes an
adaptable, secure sender plus the config the project needs.

## THE GOLDEN RULE (non-negotiable)

**AWS credentials never leave the backend.** A browser app, React Native / iOS /
Android app, or any client the user can inspect must **never** contain AWS keys
or call SES directly — extracted keys = someone else sending mail on your account.

```
  Mobile / Web client ──HTTPS──▶ YOUR backend endpoint ──AWS SDK──▶ Amazon SES
   (no AWS creds)                (holds creds, validates,          (verified
                                  rate-limits, authorizes)          sender)
```

So "send email in a mobile app" always means: generate a **backend endpoint**
(Next.js route / Lambda / API server) that sends via SES, and have the app call
*that* endpoint with the user's own auth. The skill will refuse to emit
client-side SES code with embedded credentials.

## Before generating: know the SES state

Confirm these (the skill/agent checks with the AWS CLI — see `/aws-cli`):

1. **Region** — SES is per-region. Use where the verified identity lives.
2. **Verified sender** — SES only sends *from* a verified domain or email. The
   `From` address in generated code must be a verified identity (`SES_FROM`).
3. **Sandbox vs production** — in the sandbox (`ProductionAccessEnabled: false`)
   you can only send *to* verified addresses, 200/day @ 1/s. Emailing real users
   needs a one-time production-access request. Generated code works in both; the
   skill warns which mode applies.
4. **Durable credentials** — prefer a dedicated least-privilege IAM user (or SES
   SMTP credentials) over temporary/SSO keys, so the service doesn't break when a
   session token expires. Policy template: `templates/iam-send-policy.json`.

```bash
source ~/.keys.sh
uvx --from awscli aws sesv2 get-account --region us-east-1 --output json          # sandbox? quota?
uvx --from awscli aws sesv2 list-email-identities --region us-east-1 --output json # verified senders
```

## How to generate

1. **Detect the stack** — read the target project (package.json / framework /
   language) to pick the right template. Ask only if it's ambiguous.
2. **Copy the matching template** from `templates/` and adapt it to the project's
   conventions (its error-handling style, module system, path layout). Don't just
   dump the file — make it read like the surrounding code.
3. **Wire config via env** — add the needed vars to the project's `.env.example`
   (see `templates/env.example`): `AWS_REGION`, `SES_FROM`, and creds via the
   standard AWS SDK chain (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` or an
   instance/task role in deployed environments — never hardcode).
4. **For a client app**, generate the backend endpoint AND a thin client helper
   that POSTs to it (no AWS anything in the client). Authenticate the endpoint.
5. **Validate + handle errors** — validate `to`/`subject`/`body` at the boundary;
   surface SES errors (unverified sender, sandbox recipient, throttling,
   suppression-list hits) with clear messages; return the SES `MessageId`.

## Templates (in `templates/`)

| File | Use for |
|------|---------|
| `ses-node.mjs` | Reusable `sendEmail()` — AWS SDK v3 (`@aws-sdk/client-sesv2`). Node/Express/any JS backend. |
| `nextjs-route.ts` | Next.js App Router `POST /api/send-email` route (server-only). |
| `ses-python.py` | boto3 `send_email()` for FastAPI/Django/Flask/Lambda. |
| `client-fetch.ts` | Frontend/mobile helper that calls YOUR endpoint — the only client-side code, contains NO AWS creds. |
| `iam-send-policy.json` | Least-privilege IAM policy for a dedicated send-only user. |
| `env.example` | The env vars a project needs. |

Prefer **SES API (SDK)** over raw SMTP for app code — better errors, IAM auth, no
long-lived SMTP password to manage. Use SMTP only when a library requires it.

## Guardrails

- **Never emit AWS credentials into client/mobile/browser code.** If asked to
  "send directly from the app," generate a backend endpoint instead and explain
  why. This rule overrides convenience.
- **From must be a verified SES identity.** Don't invent a sender; use `SES_FROM`
  and flag if it isn't verified.
- **Respect sandbox limits.** If the account is in sandbox, say so and note that
  real-user sending needs production access + verified recipients for testing.
- **Least privilege for the sender.** Recommend a dedicated IAM user scoped to
  `ses:SendEmail`/`SendRawEmail` (template provided), not admin/SSO keys.
- **Handle bounces & complaints.** Keep SES suppression on; don't strip it. For
  volume, recommend a configuration set with an SNS/event destination.
- **Don't hardcode secrets or fabricate a "sent" result.** Read creds from env /
  role; return the real `MessageId` or the real error.
```
