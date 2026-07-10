---
name: aws-cli
version: 1.0.0
description: |
  Install, configure, and safely operate the AWS CLI (v2). Handles first-time
  setup (install per-platform, configure IAM/SSO credentials, profiles/regions)
  and day-to-day AWS operations with a safety-first posture: read-only by
  default, confirm before anything destructive or billable, never echo secrets.
  Triggers: "aws cli", "aws-cli", "run an aws command", "configure aws", "set up
  aws credentials", "aws sso login", "which aws account am I in", "list my s3
  buckets / ec2 instances", "aws profile / region".
origin: custom
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
---

# /aws-cli — install, configure & operate the AWS CLI (v2) safely

The AWS CLI reaches real cloud infrastructure with real billing and real blast
radius. This skill's job is to get you set up and then operate **safely**:
confirm who you are before you act, read before you write, and never touch a
destructive or billable command without explicit confirmation.

## Always start here: preflight

Before running any AWS command, establish three things — installed? which
identity? which region/profile? Never assume.

```bash
# 1. Is the CLI installed, and is it v2?
aws --version 2>/dev/null || echo "AWS CLI not installed — see Install below"

# 2. WHO am I acting as? (fails fast if creds are missing/expired)
aws sts get-caller-identity --output table

# 3. WHERE will commands land by default?
aws configure list          # shows profile, region, and cred source
echo "profile=${AWS_PROFILE:-default}  region=${AWS_REGION:-$AWS_DEFAULT_REGION}"
```

If `get-caller-identity` fails, credentials are missing or expired — go to
**Configure**. If it returns an account you didn't expect, **stop** and confirm
with the user before running anything (wrong-account writes are the #1 footgun).

## Install (only if preflight says it's missing)

AWS CLI **v2** is the supported version — never install/keep v1.

| Platform | Command |
|----------|---------|
| **macOS** | `curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "/tmp/AWSCLIV2.pkg" && sudo installer -pkg /tmp/AWSCLIV2.pkg -target /` (or `brew install awscli`) |
| **Linux (x86_64)** | `curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "/tmp/awscliv2.zip" && unzip -q /tmp/awscliv2.zip -d /tmp && sudo /tmp/aws/install --update` |
| **Linux (ARM)** | same as above with `awscli-exe-linux-aarch64.zip` |
| **Windows** | `msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi` |
| **Docker / CI** | `docker run --rm -it public.ecr.aws/aws-cli/aws-cli:latest <command>` (mount `~/.aws` to reuse creds) |
| **No install (browser)** | AWS CloudShell in the console — CLI pre-installed, creds inherited |

Verify after install: `aws --version` should report `aws-cli/2.x`.

## Configure (first-time credentials)

**Prefer least-privilege over root.** Never configure with root-account keys.
Create/receive an IAM user or (better) use IAM Identity Center (SSO). Pick the
method that fits how the user's org issues credentials:

**A. IAM Identity Center / SSO (recommended for humans):**
```bash
aws configure sso                 # walks through start URL, region, account, role
aws sso login --profile <name>    # refresh short-lived creds when they expire
```

**B. Long-lived IAM access keys (`aws configure`):**
```bash
aws configure                     # prompts: Access Key ID, Secret, region, output
aws configure --profile <name>    # store a named profile
```
This writes `~/.aws/credentials` (keys) and `~/.aws/config` (region/output).

**C. Environment variables (CI / ephemeral / assumed roles):**
```bash
export AWS_ACCESS_KEY_ID=...  AWS_SECRET_ACCESS_KEY=...  AWS_SESSION_TOKEN=...
export AWS_REGION=us-east-1
```

**Selecting context per command** (no reconfiguring):
```bash
aws s3 ls --profile prod --region eu-west-1
AWS_PROFILE=staging aws sts get-caller-identity
```

Default output format: prefer `--output json` for parsing, `--output table` for
human display, `--output text` for shell pipelines.

## Operating safely

1. **Confirm identity first.** Every session/new context: `aws sts
   get-caller-identity`. Re-confirm before any write if the account matters.
2. **Read before you write.** `list*` / `describe*` / `get*` are safe and cheap.
   Run those to understand state before any `create/put/update/delete/terminate`.
3. **Gate destructive & billable actions.** STOP and get explicit user
   confirmation before: `delete*`, `terminate*`, `rm`/`rb` (S3), `put*` that
   overwrites, scaling changes, anything that launches paid resources
   (`run-instances`, `create-cluster`, etc.). State exactly what will change and
   in which account/region.
4. **Dry-run when available.** Many EC2/mutating commands accept `--dry-run`;
   use it first. For S3, preview with `--dryrun` on `cp/sync/mv/rm`.
5. **Scope and paginate.** Use `--query` (JMESPath) and `--max-items` to avoid
   dumping huge result sets; use `--region` explicitly on anything global-ish.
6. **Never echo secrets.** Don't print access keys, secret keys, session tokens,
   or the contents of `~/.aws/credentials`. Don't commit them. Redact in output.
7. **Fail loud.** Surface AWS error messages verbatim (access denied, expired
   token, throttling) instead of guessing or silently retrying.

## Common patterns

```bash
# Identity & account
aws sts get-caller-identity
aws iam list-account-aliases --output text

# S3 (read)                         # S3 (write — CONFIRM FIRST)
aws s3 ls                           aws s3 cp file s3://bucket/key
aws s3 ls s3://bucket/ --recursive  aws s3 sync ./dir s3://bucket/ --dryrun

# EC2 (read)
aws ec2 describe-instances \
  --query 'Reservations[].Instances[].{Id:InstanceId,State:State.Name,Type:InstanceType}' \
  --output table

# Cost visibility (read — good habit before/after spend)
aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-02-01 \
  --granularity MONTHLY --metrics UnblendedCost --output table

# Filter with JMESPath instead of grep
aws ec2 describe-regions --query 'Regions[].RegionName' --output text
```

## Troubleshooting

- **`command not found: aws`** → not installed; go to Install.
- **`Unable to locate credentials`** → run Configure, or `aws sso login`.
- **`ExpiredToken` / `The security token ... is expired`** → refresh: `aws sso
  login --profile <name>`, or renew keys / re-export session token.
- **`AccessDenied`** → identity lacks the IAM permission; report which action/ARN
  was denied — don't work around it by escalating privileges silently.
- **Wrong account/region** → check `aws configure list` and `$AWS_PROFILE` /
  `$AWS_REGION`; pass `--profile` / `--region` explicitly.

## Guardrails

- **Least privilege, never root.** Don't configure or operate with root-account
  credentials. Prefer SSO / scoped IAM users.
- **Confirm before destructive or billable actions** — deletes, terminations,
  overwrites, and anything that launches paid resources. Name the account+region.
- **Never print or commit secrets.** Redact keys/tokens; keep `~/.aws/*` out of
  any output or repo.
- **Don't fabricate.** If a command fails or you lack permission, report the real
  AWS error — never invent resource state or pretend an action succeeded.
- **Right account, right region, every time.** Verify with `get-caller-identity`
  before acting when it matters.
```
