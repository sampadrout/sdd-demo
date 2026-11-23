#!/usr/bin/env bash
# Create Jira project "sdd-demo" (key SDD) and the Transfer Funds Story on
# https://sampadrout.atlassian.net — then print the issue key for the SDD demo.
#
# Required env:
#   JIRA_EMAIL       — Atlassian account email
#   JIRA_API_TOKEN   — https://id.atlassian.com/manage-profile/security/api-tokens
#
# Optional:
#   JIRA_BASE_URL     — default https://sampadrout.atlassian.net
#   JIRA_PROJECT_KEY  — default SDD
#   JIRA_PROJECT_NAME — default sdd-demo
set -euo pipefail

BASE_URL="${JIRA_BASE_URL:-https://sampadrout.atlassian.net}"
PROJECT_KEY="${JIRA_PROJECT_KEY:-SDD}"
PROJECT_NAME="${JIRA_PROJECT_NAME:-sdd-demo}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Load .env if present (does not override existing env)
if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

if [[ -z "${JIRA_EMAIL:-}" || -z "${JIRA_API_TOKEN:-}" ]]; then
  echo "Set JIRA_EMAIL and JIRA_API_TOKEN first (or put them in .env)." >&2
  echo "Create a token at: https://id.atlassian.com/manage-profile/security/api-tokens" >&2
  exit 1
fi

AUTH=(-u "${JIRA_EMAIL}:${JIRA_API_TOKEN}")
HDR=(-H "Accept: application/json" -H "Content-Type: application/json")

echo "Resolving accountId for ${JIRA_EMAIL}..."
ME=$(curl -sf "${AUTH[@]}" "${HDR[@]}" "${BASE_URL}/rest/api/3/myself")
ACCOUNT_ID=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["accountId"])' <<<"$ME")
echo "accountId=${ACCOUNT_ID}"

echo "Ensuring project ${PROJECT_KEY} (${PROJECT_NAME})..."
HTTP=$(curl -s -o /tmp/jira-project.json -w "%{http_code}" "${AUTH[@]}" "${HDR[@]}" \
  "${BASE_URL}/rest/api/3/project/${PROJECT_KEY}" || true)

if [[ "$HTTP" == "200" ]]; then
  echo "Project ${PROJECT_KEY} already exists."
else
  PAYLOAD=$(ACCOUNT_ID="$ACCOUNT_ID" PROJECT_KEY="$PROJECT_KEY" PROJECT_NAME="$PROJECT_NAME" python3 - <<'PY'
import json, os
print(json.dumps({
  "key": os.environ["PROJECT_KEY"],
  "name": os.environ["PROJECT_NAME"],
  "projectTypeKey": "software",
  "projectTemplateKey": "com.pyxis.greenhopper.jira:gh-simplified-agility-kanban",
  "leadAccountId": os.environ["ACCOUNT_ID"],
  "description": "Spec-Driven Development demo against ParaBank",
}))
PY
)
  HTTP=$(curl -s -o /tmp/jira-project-create.json -w "%{http_code}" "${AUTH[@]}" "${HDR[@]}" \
    -X POST "${BASE_URL}/rest/api/3/project" -d "$PAYLOAD")
  if [[ "$HTTP" != "201" && "$HTTP" != "200" ]]; then
    echo "Failed to create project (HTTP ${HTTP}):" >&2
    cat /tmp/jira-project-create.json >&2
    exit 1
  fi
  echo "Created project ${PROJECT_KEY}."
fi

echo "Resolving issue types for ${PROJECT_KEY}..."
# Prefer Story by id (Jira Cloud team-managed createmeta differs by site)
TYPES=$(curl -sf "${AUTH[@]}" "${HDR[@]}" \
  "${BASE_URL}/rest/api/3/issue/createmeta/${PROJECT_KEY}/issuetypes")
ISSUE_TYPE_ID=$(python3 - <<'PY'
import json, sys
data = json.load(sys.stdin)
types = data.get("issueTypes") or data.get("values") or []
prefer = ["Story", "Task", "Bug"]
by_name = {t["name"]: t["id"] for t in types}
for p in prefer:
  if p in by_name:
    print(by_name[p])
    break
else:
  print(types[0]["id"])
PY
<<<"$TYPES")
echo "Using issue type id: ${ISSUE_TYPE_ID}"

ISSUE_PAYLOAD=$(PROJECT_KEY="$PROJECT_KEY" ISSUE_TYPE_ID="$ISSUE_TYPE_ID" python3 - <<'PY'
import json, os
paras = [
  "As a ParaBank customer, I want to transfer money between my accounts so that I can move funds without visiting a branch.",
  "Application: https://parabank.parasoft.com/parabank",
  "Acceptance criteria:",
  "1. A registered customer can sign in with username and password and land on Accounts Overview (account table visible).",
  "2. An authenticated customer can open the Transfer Funds screen from the account menu.",
  "3. An authenticated customer can submit a transfer of an amount from one owned account to another.",
  "4. After a successful transfer, the customer sees a Transfer Complete! confirmation that includes the transferred amount.",
  "Automation notes: one sequential Cypress journey covering S-1 through S-4 (register → transfer → confirm).",
]
description = {
  "type": "doc",
  "version": 1,
  "content": [
    {"type": "paragraph", "content": [{"type": "text", "text": p}]}
    for p in paras
  ],
}
print(json.dumps({
  "fields": {
    "project": {"key": os.environ["PROJECT_KEY"]},
    "summary": "ParaBank: customer can transfer funds between accounts",
    "issuetype": {"id": os.environ["ISSUE_TYPE_ID"]},
    "description": description,
  }
}))
PY
)

echo "Creating issue..."
HTTP=$(curl -s -o /tmp/jira-issue.json -w "%{http_code}" "${AUTH[@]}" "${HDR[@]}" \
  -X POST "${BASE_URL}/rest/api/3/issue" -d "$ISSUE_PAYLOAD")
if [[ "$HTTP" != "201" ]]; then
  echo "Failed to create issue (HTTP ${HTTP}):" >&2
  cat /tmp/jira-issue.json >&2
  exit 1
fi

KEY=$(python3 -c 'import json; print(json.load(open("/tmp/jira-issue.json"))["key"])')
echo ""
echo "Created: ${KEY}"
echo "URL: ${BASE_URL}/browse/${KEY}"
echo "${KEY}" > "${ROOT}/.jira-demo-key"
echo "Wrote .jira-demo-key (gitignored)."
