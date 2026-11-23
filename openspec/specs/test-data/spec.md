# Test Data

## Purpose

Use synthetic, unique data. Avoid hardcoded shared demo accounts when registration is available.

## Requirements

### Requirement: Unique registration data
Registration journeys SHALL use Faker-generated unique usernames.

### Requirement: No secrets in source for real apps
Credentials for non-public apps SHALL come from env vars, never committed secrets.
