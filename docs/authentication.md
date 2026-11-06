# Authentication

Argon2id hashes passwords with 64 MiB memory, three iterations and one lane. Login uses the same generic error for unknown accounts and incorrect passwords, including a dummy verification. Registration errors do not expose database details, but registration is not claimed to provide complete account-enumeration resistance.

Access tokens are signed JWTs with issuer/audience, subject and session ID, lasting ten minutes. Refresh tokens contain a random session ID and 256-bit secret; only SHA-256 hashes of high-entropy refresh secrets are stored. Refresh rotation is transactional. Reuse of a rotated token revokes its family. Session expiry is absolute, seven days. Logout revokes the session/family; logout-all revokes all sessions. Protected requests check the backing session, so revoked sessions cannot continue using unexpired JWTs.

Tokens are HttpOnly, SameSite=Lax cookies. Production requires HTTPS and Secure cookie flags; access uses a host-only cookie and refresh is restricted to the auth path. Unsafe browser requests require the exact configured Origin and a custom request header. CORS permits only the configured web origin. No tokens are returned in JSON, stored in localStorage or logged. A PostgreSQL counter limits sensitive auth operations. Trust proxy must be explicitly configured for a known deployment.

Password reset, email verification, MFA and public-demo account lifecycle are not implemented in this phase. They must be considered before broader public registration. No security certification is claimed.

## Hosted demo mode

APP_MODE=demo closes registration and accepts only predefined fictional Admin/Manager/Member accounts, with 12-hour absolute sessions, three active sessions/account and 100 total rows including replay evidence. Authentication uses shared PostgreSQL budgets rather than trusting forwarded IP headers. The same-origin Next proxy preserves separate host-only Secure cookies and supplies a server-only credential to the public API. See [demo safeguards](demo-strategy.md) and [deployment](deployment.md).
