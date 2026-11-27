# Security Policy

## Supported Versions

Only the latest minor release line receives security fixes and dependency updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2.0 | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

If you discover a security vulnerability in **GastroMap**, please report it privately using GitHub Security Advisories:

- 👉 **[Report a vulnerability privately](https://github.com/alebupal/GastroMap/security/advisories/new)**

*(Reports are welcome in **English** or **Spanish**.)*

### What to Include

To help us investigate and resolve the issue quickly, please include:

- A clear description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions, proof-of-concept request/payload, or affected route/file.
- Your deployment environment (GastroMap version, Docker vs. local Node.js, reverse proxy configuration).
- Any suggested remediation or mitigation, if you have one.

### Response Timeline

- **Acknowledgement:** Within **72 hours** of receiving your report.
- **Triage & Assessment:** Within **7 days**, we will confirm severity and whether the issue is accepted.
- **Fix & Disclosure:** For accepted vulnerabilities, we aim to release a patched version and publish a coordinated advisory as soon as a fix is verified, crediting the reporter if desired.

## Security Architecture Highlights

GastroMap implements the following baseline controls:

- **Authentication & Sessions:** Passwords hashed with **Argon2id**; database-backed sessions using `HttpOnly`, `SameSite=Lax` cookies with automatic `Secure` flag behind HTTPS reverse proxies (`x-forwarded-proto: https` or `COOKIE_SECURE=true`).
- **Multi-Space Isolation:** Strict server-side ownership and group-membership checks on every Server Action so personal maps and friend groups never leak places, notes, comments, or member directories.
- **Anti-SSRF Protection:** Shortened Google Maps URL resolution validates official hostnames and blocks private/loopback/link-local IPs across every manual redirect hop.
- **Public Sharing Hardening:** Individual public place cards (`/p/[id]?s=<token>`) are protected with **HMAC-SHA256** signed tokens (`timingSafeEqual`) to prevent ID enumeration and never expose private notes, group comments, or member lists.
- **Encrypted Third-Party Keys:** Optional per-group and global Google Places API keys are encrypted at rest with **AES-256-GCM**.
- **HTTP Security Headers & Rate Limiting:** Strict `Content-Security-Policy` (including `object-src 'none'`), `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and in-memory rate limiting on auth and invite endpoints.

## Self-Hosting Security Recommendations

When deploying GastroMap in production:

1. **Always set a strong `SESSION_SECRET`** (at least 32 random bytes) and optionally `APP_SECRET` in your environment variables—never leave default placeholder values.
2. **Serve behind HTTPS** using a reverse proxy (Nginx Proxy Manager, Traefik, Caddy) that forwards `X-Forwarded-Proto: https`.
3. **Keep PostgreSQL private:** Do not expose port `5432` to the public internet; keep the database reachable only over the internal Docker network.
4. **Restrict registration if private:** If your instance is only for a closed group, switch to **Invite Only** in `/admin > System & Audit`.
5. **Keep updated:** Update to the latest Docker image / GitHub release (`v0.2.x`) to receive security and dependency patches.
