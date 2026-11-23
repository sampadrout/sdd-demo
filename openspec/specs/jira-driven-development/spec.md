# Ticket-Driven Development

## Purpose

Make the ticket (or demo AC doc) the source of business intent. ACs become `S-<n>` requirements;
requirements become tests.

## Requirements

### Requirement: Work originates from a ticket
Automation work SHALL originate from a ticket whose acceptance criteria define what must be verified.

### Requirement: Acceptance criteria map to S-requirements
Each automatable AC SHALL become a numbered requirement `S-1, S-2, ...`.

### Requirement: Bidirectional traceability tags
Every generated test SHALL carry `@jira` and `@spec` tags, and `it(...)` titles SHALL begin with `S-<n>`.
