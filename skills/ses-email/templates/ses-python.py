"""
Reusable SES sender — boto3. BACKEND ONLY (FastAPI/Django/Flask/Lambda).
Never ship AWS credentials to a client; expose this behind an authenticated
endpoint that the web/mobile app calls.

Install: pip install boto3
Env: AWS_REGION, SES_FROM (a verified SES identity), AWS credentials via the
     standard chain (env vars locally; IAM role in Lambda/ECS/EC2).
     SES_FROM is per-app config; pass `from_addr` to override per call.
"""
import os
import re
import boto3
from botocore.exceptions import ClientError

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_client = boto3.client("sesv2", region_name=os.environ.get("AWS_REGION", "us-east-1"))


def send_email(to, subject, *, html=None, text=None, from_addr=None, reply_to=None):
    """Send a transactional email. Returns the SES MessageId, or raises ValueError
    on bad input / RuntimeError on an SES failure."""
    sender = from_addr or os.environ.get("SES_FROM")
    to_list = [to] if isinstance(to, str) else list(to)

    if not sender:
        raise ValueError("SES_FROM not set (must be a verified SES identity)")
    if not to_list or any(not _EMAIL_RE.match(a) for a in to_list):
        raise ValueError("Invalid 'to' address")
    if not (subject and subject.strip()):
        raise ValueError("Missing 'subject'")
    if not html and not text:
        raise ValueError("Provide 'html' or 'text' body")

    body = {}
    if html:
        body["Html"] = {"Data": html, "Charset": "UTF-8"}
    if text:
        body["Text"] = {"Data": text, "Charset": "UTF-8"}

    try:
        resp = _client.send_email(
            FromEmailAddress=sender,
            Destination={"ToAddresses": to_list},
            ReplyToAddresses=([reply_to] if isinstance(reply_to, str) else list(reply_to)) if reply_to else [],
            Content={"Simple": {"Subject": {"Data": subject, "Charset": "UTF-8"}, "Body": body}},
        )
        return resp["MessageId"]
    except ClientError as err:
        # Surface the real SES error (unverified sender, sandbox recipient, throttle).
        code = err.response.get("Error", {}).get("Code", "Unknown")
        msg = err.response.get("Error", {}).get("Message", str(err))
        raise RuntimeError(f"SES send failed [{code}]: {msg}") from err
