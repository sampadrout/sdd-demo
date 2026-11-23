# /from-jira — Scaffold an OpenSpec change from a Jira ticket

**Usage:** `/from-jira <TICKET-KEY>`
**Example:** `/from-jira SDD-1`

Intake step of the SDD workflow (see `.cursor/rules/spec-driven.mdc`).

## Steps

1. Fetch the ticket via Atlassian MCP `getJiraIssue` (`issueIdOrKey`, `responseContentFormat: markdown`).
2. Map each automatable AC to an `S-<n>` requirement; flag non-automatable as `[MANUAL]`.
3. Classify as **journey** (one `it` spanning S-range) vs **facets** (separate `it`s).
4. Scaffold `openspec new change "<kebab-name>"` and fill proposal / design / specs / tasks.
5. Remind: discover selectors → `/opsx:apply` → run → `/opsx:archive`.

Jira ACs are usually prose — translate into WHEN/THEN in the OpenSpec delta; do not require Gherkin on the ticket.
