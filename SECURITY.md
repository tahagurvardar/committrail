# Security policy

## Supported versions

Security fixes are provided for the latest `1.x` release. Pre-release history
is unsupported.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting for this repository. Do not open a
public issue with exploit details, secrets, or personal data. Include affected
version, reproduction, impact, and any suggested mitigation. The maintainer
will acknowledge a complete report as soon as practical and coordinate
disclosure after a fix is available.

## Current accepted risk

The production dependency audit is clean at v1.0.0. High-severity advisories in
the development-only ESLint/minimatch dependency chain are accepted temporarily
because the available automated remediation requires a breaking ESLint major
upgrade. This exception expires on 2026-10-31 and must be reviewed sooner if a
runtime path or non-breaking fix appears. CI fails on critical advisories and
reports the full audit visibly.
