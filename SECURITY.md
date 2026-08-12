# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

The NST Events team takes security issues seriously. If you discover a security vulnerability in this project, please follow these steps:

1. **Do NOT open a public GitHub issue.**
2. Report the vulnerability privately via GitHub Private Vulnerability Reporting.
3. Include the following details in your report:
   - Type of issue (e.g. SQL injection, privilege escalation, CORS bypass, TOTP manipulation)
   - Step-by-step instructions to reproduce the vulnerability
   - Proof of Concept (PoC) code or requests if available
   - Impact assessment

## Vulnerability Handling SLA

- **Initial Response**: Within 24 hours
- **Triage & Severity Assessment**: Within 48 hours
- **Patch & Deployment**: High/Critical vulnerabilities within 7 days; Medium/Low within 30 days.

Thank you for helping keep NST Events secure!

## Database Authorization

NST-Events enforces strict least-privilege database roles:
- Application API executes as `nst_app`.
- Background processing executes as `nst_worker`.
- PostgreSQL Row-Level Security (RLS) is utilized as a defense-in-depth boundary against RBAC bypasses.
