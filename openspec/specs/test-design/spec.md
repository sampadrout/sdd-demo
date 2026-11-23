# Test Design

## Purpose

Keep tests independent, outcome-focused, and requirement-anchored.

## Requirements

### Requirement: Test independence
Each test SHALL pass when run alone.

### Requirement: Business outcome assertions
Assert status/text/value outcomes, not incidental styling.

### Requirement: Journey vs facet structure
Sequential journeys SHALL be one `it()` spanning `S-<n>` range. Independent facets SHALL be separate `it()`s with shared `beforeEach`.
