# Locator Governance

## Purpose

Keep locators stable, centralized, and prioritized.

## Requirements

### Requirement: Selectors live in ui-map only
All selectors SHALL be defined in `libs/ui-map/src/lib/*.selectors.ts`.

### Requirement: Locator priority
Prefer stable attributes: `name` / `id` > `aria-label` / `role` > meaningful link text. Avoid nth-child and dynamic classes.
