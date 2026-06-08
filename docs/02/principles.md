# Authentication Principles

---

## 1. Server-Side Validation

**Definition:** All user input is validated on the server before processing, even if it was already checked in the browser. Client-side checks are cosmetic; server-side checks are what actually protect you.

**Lines:**
- Signup: `src/actions/auth.ts:16–22` — `SignUpSchema.safeParse(data)` validates name, email, password shape before any DB work
- Login: `src/actions/auth.ts:68–74` — `LoginSchema.safeParse(data)` validates email and password format

---

## 2. Password Hashing with Salt

**Definition:** Passwords are never stored as plain text. They are run through a one-way hashing algorithm (bcrypt) that produces a fixed-length gibberish string. A "salt" (random data mixed into the hash) ensures that identical passwords produce different hashes.

**Lines:**
- `src/actions/auth.ts:40` — `const saltRounds = 10` sets the work factor (2^10 iterations)
- `src/actions/auth.ts:41` — `bcrypt.hash(password, saltRounds)` turns the plain password into a salted hash
- `src/actions/auth.ts:48` — the hash is stored in the database; the original password is never saved

---

## 3. Constant-Time Password Verification

**Definition:** When checking a password against its stored hash, the comparison must take the same amount of time regardless of whether it's a near-miss or a complete mismatch. This prevents attackers from measuring response timing to guess the password character by character.

**Lines:**
- `src/actions/auth.ts:93` — `bcrypt.compare(password, user.password)` performs a constant-time comparison

---

## 4. Cryptographically Secure Random Tokens

**Definition:** Session tokens must be generated using a cryptographically secure pseudo-random number generator (CSPRNG), not `Math.random()` or similar predictable functions. A 256-bit token has more possible values than there are atoms in the universe, making it infeasible to guess.

**Lines:**
- `src/lib/session.ts:10` — `crypto.randomBytes(32).toString('hex')` generates 32 cryptographically random bytes (64 hex characters)

---

## 5. Database-Backed Session Storage

**Definition:** The session itself lives in the database, not in the cookie. The cookie only holds an opaque random token. This means: (a) an attacker who steals the cookie cannot modify session data, and (b) sessions can be revoked instantly by deleting the database row.

**Lines:**
- `src/lib/session.ts:14–19` — `prisma.session.create({ data: { token, userId, expiresAt } })` stores the session server-side
- `prisma/schema.prisma:20–27` — the `Session` model defines the database schema (token, userId, expiresAt)

---

## 6. Session Expiry

**Definition:** Every session has a fixed lifetime. Once the expiry time passes, the session is treated as invalid and automatically cleaned up. This limits the window of opportunity if a session token is stolen.

**Lines:**
- `src/lib/session.ts:11` — expiration is calculated at creation: `now + 7 days`
- `src/lib/session.ts:63–71` — on every read, expired sessions are deleted and `null` is returned
- `src/app/api/auth/validate-session/route.ts:41–46` — the proxy's validation endpoint also checks and cleans up expired sessions

---

## 7. Defense in Depth

**Definition:** Security is layered. If one layer fails or is bypassed, another layer still protects the resource. No single point of failure can expose a protected page.

**Lines:**
- Layer 1 — Proxy (`src/proxy.ts:32–35`): redirects unauthenticated requests before they reach the dashboard route
- Layer 2 — Dashboard Server Component (`src/app/dashboard/page.tsx:8–13`): calls `getSession()` again server-side and redirects if missing, even if the proxy was somehow skipped

---

## 8. Generic Error Messages

**Definition:** Login errors intentionally do not reveal whether the email address exists or the password was wrong. This prevents attackers from using the login form to harvest valid email addresses.

**Lines:**
- `src/actions/auth.ts:85–89` — "Invalid email or password." when the email does not exist (same message as wrong password)
- `src/actions/auth.ts:94–98` — exactly the same "Invalid email or password." when the password does not match

---

## 9. Email Normalization

**Definition:** Email addresses are lowercased before being stored or compared. This prevents duplicates caused by casing differences (e.g., `User@Example.com` vs `user@example.com`) and ensures login works regardless of how the user types their email.

**Lines:**
- `src/actions/auth.ts:29` — `email: email.toLowerCase()` during the uniqueness check
- `src/actions/auth.ts:47` — `email: email.toLowerCase()` before saving to the database
- `src/actions/auth.ts:81` — `email: email.toLowerCase()` during login lookup

---

## 10. Password Strength Requirements

**Definition:** Users must create passwords that meet minimum complexity rules (length, character classes). This raises the bar against dictionary attacks and brute-force guessing.

**Lines:**
- `src/lib/validations.ts:6–11` — Zod schema enforces: minimum 8 characters, at least one uppercase letter, one lowercase letter, and one number

---

## 11. Secure Cookie Attributes

**Definition:** Session cookies are hardened with flags that restrict how and when the browser sends them. Each flag closes a specific attack vector.

**Lines:**

| Attribute | Line | What it blocks |
|-----------|------|----------------|
| `httpOnly: true` | `src/lib/session.ts:25` | XSS — JavaScript cannot read the cookie |
| `secure: true` (prod) | `src/lib/session.ts:26` | Network sniffing — cookie only sent over HTTPS |
| `sameSite: 'lax'` | `src/lib/session.ts:27` | CSRF — cookie withheld on cross-site POST requests |
| `expires` | `src/lib/session.ts:28` | Persistence — browser auto-deletes cookie after expiry |

---

## 12. Least-Privilege Database Queries

**Definition:** When fetching the user associated with a session, only the fields needed by the page are selected — never the entire user row (which includes the password hash).

**Lines:**
- `src/lib/session.ts:47–53` — `select: { id: true, name: true, email: true, createdAt: true }` omits `password` from the result
- `src/app/api/auth/validate-session/route.ts:27–32` — the proxy API endpoint also selects only `id`, `name`, `email`

---

## 13. Graceful Cleanup of Expired/Stale Sessions

**Definition:** When an expired, missing, or already-deleted session is encountered, the system cleans up silently without crashing or leaking stack traces.

**Lines:**
- `src/lib/session.ts:65–67` — `.catch(() => {})` swallows errors if the session row was already deleted by a concurrent request
- `src/app/api/auth/validate-session/route.ts:43–45` — same pattern in the validation endpoint

---

## 14. Route Matcher Scoping

**Definition:** The proxy runs only on routes that need it, not on every request. This reduces unnecessary work and avoids interfering with static assets, API endpoints, and the landing page.

**Lines:**
- `src/proxy.ts:46–48` — `matcher: ['/dashboard/:path*', '/login', '/signup']` restricts the proxy to exactly three route patterns

---

## 15. Server Action Isolation

**Definition:** Authentication logic runs exclusively in Server Actions (`'use server'`) and Server Components, never in the browser. This means secrets (bcrypt, crypto, database passwords) are never exposed to the client.

**Lines:**
- `src/actions/auth.ts:1` — `'use server'` directive on all auth functions
- `src/app/dashboard/page.tsx:6` — `DashboardPage` is a default Server Component (no `'use client'`)

---

## 16. Unique Email Constraint at Database Level

**Definition:** The database itself enforces that no two users can have the same email, providing a last line of defense against race conditions or application-level bugs.

**Lines:**
- `prisma/schema.prisma:13` — `email String @unique` on the `User` model

---

## 17. Cascade Deletion of Sessions on User Removal

**Definition:** When a user account is deleted, all of that user's sessions are automatically deleted by the database. This prevents orphaned sessions from accumulating.

**Lines:**
- `prisma/schema.prisma:24` — `onDelete: Cascade` on the `Session → User` relation
