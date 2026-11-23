# /repo-context — Pack repo context with Repomix (token-saving)

**Usage:**
- `/repo-context` — regenerate `repomix-output.md` (full include set from `repomix.config.json`)
- `/repo-context --compress` — structure-only pack (smaller; signatures/types, less body)
- `/repo-context --read` — if the pack exists, **read it** and answer from that; only regenerate if missing/stale

## Why
Agents that walk the tree with many Glob/Grep/Read calls burn tokens. Repomix builds one AI-friendly file so orientation is a single read.

**Automatic refresh:** `/from-jira` and `/auto-heal` always run `npm run context` (Step 0) before scaffolding or heal triage, so intake/pipeline fixes never use a stale pack or re-walk the repo. Use this command for ad-hoc regenerates outside those flows.

## Agent instructions

### Regenerate
```bash
npm run context
# or compressed:
npm run context:compress
```
Announce token/file summary from the CLI output.

### When answering from context
1. Prefer `repomix-output.md` over exploratory searches for “how is X structured?”.
2. For edits, still open the **real source file** path and patch there.
3. If the pack is clearly outdated vs. files you just changed, regenerate before the next orientation pass.

### Do not
- Commit `repomix-output.md` unless the team explicitly wants it shared (it is gitignored by default).
- Pack secrets (`cypress.env.json`, `.env` stay ignored).
