# Security policy

This app holds some of the most sensitive data people have: mood, mental health, drinking and drug use.
Please report vulnerabilities privately.

## Reporting
Use GitHub's **Report a vulnerability** button (Security tab → Advisories). Please include steps to reproduce.
You'll get a reply within 7 days. Please give 90 days before public disclosure, or less if a fix ships sooner.

## Scope
In scope: authentication and sessions, access to another person's data on the same server, the coach/chat tools,
the web page reader (SSRF), encryption at rest, the WhatsApp sidecar's internal API, injection of any kind.

Out of scope: attacks needing a compromised server or unlocked device, the security of the model endpoint you
connect to, denial of service on a self-hosted instance.

Known limitations are listed openly in [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md).

## Running it safely
- Put it behind HTTPS (a reverse proxy or `tailscale serve`) — never expose port 8080 directly
- Set `SETUP_CODE` if the server is reachable before you finish first-run setup
- Use 6+ digit PINs; keep `JWT_SECRET` and `DATA_KEY` secret, and back up `DATA_KEY`
- Prefer a local model for the coach; it's the only way your conversations never leave your network
