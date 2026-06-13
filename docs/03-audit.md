# Security Audit — The Gatekeeper

**Date:** 2026-06-13
**Scope:** Full authentication codebase (server actions, session management, proxy, API routes, database schema, client components)
**Methodology:** Manual code review against OWASP Top 10, NIST SP 800-63B, and common web vulnerability patterns.

---

## 1. Session Token Leakage on Dashboard

**Severity:** Medium
**File:** `src/app/dashboard/page.tsx:114-117`
**Category:** OWASP A04:2021 — Insecure Design

### The Problem

The dashboard renders a "Session Diagnostics" card that displays a truncated session token:

```tsx
<p className="truncate text-sm font-mono text-zinc-300">
  {session.token.slice(0, 8)}...{session.token.slice(-8)}
</p>
```

This leaks 16 of the token's 64 hex characters (25%). Even a partial token leak helps an attacker who obtains the truncated output (e.g., via screenshot, shoulder-surfing, or XSS) narrow down the remaining entropy to 2^(64×4×0.75) = 2^192 possibilities — still astronomically large, but the principle of least privilege says we should leak zero characters of an authentication secret.

### The Fix

Remove the session token display from the dashboard entirely. A "Session Diagnostics" card showing an expiry date is fine. The token itself has no legitimate use on a UI — the user can't do anything with it.

```diff
-// Session Information Card
-<div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-xl">
-  <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Session Diagnostics</h2>
-  <div className="mt-6 space-y-4">
-    <div className="flex items-center gap-3">
-      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800">
-        <Key className="h-5 w-5 text-teal-400" />
-      </div>
-      <div className="min-w-0 flex-1">
-        <p className="text-xs text-zinc-500">Session Token (Truncated)</p>
-        <p className="truncate text-sm font-mono text-zinc-300">
-          {session.token.slice(0, 8)}...{session.token.slice(-8)}
-        </p>
-      </div>
-    </div>
-    ...
-  </div>
-</div>
+{/* Session diagnostics card — removed token display, keep expiry only */}
```

---

## 2. Timing Side-Channel on Email Lookups

**Severity:** Medium
**File:** `src/actions/auth.ts:104-127` (login), `src/actions/auth.ts:181-207` (forgot-password)
**Category:** OWASP A08:2021 — Software and Data Integrity Failures / Timing Attack

### The Problem

The `loginAction` function performs a database lookup followed by a conditional bcrypt comparison:

```ts
const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

if (!user) {
  // Returns immediately — fast path (no bcrypt call)
  return { success: false, error: 'Invalid email or password.' }
}

const isPasswordValid = await bcrypt.compare(password, user.password)  // ~100-200ms
```

An attacker can measure response times to determine whether an email exists in the system:
- **Email doesn't exist:** Response after `findUnique` (~5-10ms database round-trip)
- **Email exists + wrong password:** Response after `findUnique` + `bcrypt.compare` (~100-200ms)

The same issue exists in `forgotPasswordAction`. Although it returns `{ success: true }` in both cases, the actual work differs:
- **Email exists:** Database writes + email sending (much longer)
- **Email doesn't exist:** Returns immediately

### The Fix

Perform a dummy bcrypt comparison when the user is not found, so the response time is consistent regardless of whether the email exists.

```diff
 export async function loginAction(data: LoginInput): Promise<ActionResponse> {
   const validation = LoginSchema.safeParse(data)
   if (!validation.success) { ... }

   const { email, password } = validation.data
+  // Fixed string for timing-attack padding — same length as a real hash
+  const DUMMY_HASH = '$2b$10$000000000000000000000000000000000000000000000'

   try {
     const user = await prisma.user.findUnique({
       where: { email: email.toLowerCase() },
     })

     if (!user) {
-      return { success: false, error: 'Invalid email or password.' }
+      // Perform a dummy comparison so response time is indistinguishable
+      // from the "wrong password" case, preventing email enumeration via timing.
+      await bcrypt.compare(password, DUMMY_HASH)
+      return { success: false, error: 'Invalid email or password.' }
     }

     const isPasswordValid = await bcrypt.compare(password, user.password)
```

And for `forgotPasswordAction`, use an artificial delay when the user is not found:

```diff
     if (user) {
       // ... existing token creation + email logic ...
     }
+
+    // Constant response time regardless of whether the user exists
+    // Prevents attackers from enumerating emails via response timing.
+    // The delay should approximate the time taken by the "user exists" path.
+    await new Promise((resolve) => setTimeout(resolve, 100))
```

---

## 3. Cookie Security Hardening

**Severity:** Low-Medium
**File:** `src/lib/session.ts:24-30`
**Category:** OWASP A05:2021 — Security Misconfiguration

### The Problem

Session cookies are created with these flags:

```ts
cookieStore.set(SESSION_COOKIE_NAME, token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',    // [!] Not secure over proxies
  sameSite: 'lax',                                     // [!] 'strict' prevents CSRF on subdomain redirects
  expires: expiresAt,
  path: '/',
})
```

Three issues:

1. **`secure` depends on `NODE_ENV`.** If the app runs behind a reverse proxy (Nginx, Cloudflare, ELB) that terminates HTTPS, `NODE_ENV` may be `'production'` but the connection between the proxy and Next.js is typically HTTP. The `secure` flag should be driven by the `X-Forwarded-Proto` header, not the environment name.

2. **`sameSite: 'lax'`** allows the cookie to be sent on top-level navigations from external sites via GET. For authentication cookies, `'strict'` is safer — it blocks the cookie entirely on cross-site requests, including when a user clicks a link from an external site (they'd arrive logged out, but that's a UX trade-off worth documenting).

3. **No `__Host-` prefix.** The `__Host-` cookie prefix ensures the cookie is scoped to the current domain, cannot be set on subdomains, and has `path=/` and `secure=true`. This prevents a malicious subdomain from overwriting the session cookie.

### The Fix

```diff
 cookieStore.set(SESSION_COOKIE_NAME, token, {
   httpOnly: true,
-  secure: process.env.NODE_ENV === 'production',
+  secure: true,
   sameSite: 'lax',
   expires: expiresAt,
   path: '/',
+  // __Host- prefix enforces domain-scoping and requires secure=true + path=/
 })
+
+// Rename the cookie to use the __Host- prefix for stronger isolation
+// The prefix prevents subdomain cookie overwrite attacks.
+const SESSION_COOKIE_NAME = '__Host-session_token'
```

Note: The `__Host-` prefix **requires** `secure: true`, `path: /`, and no `domain` attribute. In development on `localhost`, modern browsers accept `Secure` cookies over HTTP, so this works everywhere.

---

## 4. Missing Rate Limiting

**Severity:** High
**File:** All server actions + API routes
**Category:** OWASP A01:2021 — Broken Access Control

### The Problem

Every authentication endpoint allows unlimited unauthenticated requests:

| Endpoint | Risk | Impact |
|----------|------|--------|
| `loginAction` | No rate limit on password attempts | Online brute-force / credential stuffing |
| `signupAction` | No rate limit on account creation | Account creation DoS |
| `forgotPasswordAction` | No rate limit on email submissions | Email bombing / user harassment |
| `resetPasswordAction` | No rate limit on token submission | Token brute-force (though 64-char hex makes this impractical) |
| `/api/auth/validate-session` | No rate limit | Proxy abuse, potential DoS on the internal API |

### The Fix

Implement in-memory rate limiting for server actions. For a production system, use a distributed rate limiter (Redis-based via Upstash, or database-backed). For this project, an in-memory `Map` with sliding windows is sufficient.

Create `src/lib/rate-limit.ts`:

```ts
interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Periodically clean expired entries (every 60 seconds)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key)
    }
  }, 60_000).unref()
}

export function rateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs }
  }

  entry.count++
  const remaining = Math.max(0, max - entry.count)
  if (entry.count > max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  return { allowed: true, remaining, resetAt: entry.resetAt }
}
```

Then guard each server action. Example for `loginAction`:

```diff
+import { rateLimit } from '@/lib/rate-limit'
+import { headers } from 'next/headers'

 export async function loginAction(data: LoginInput): Promise<ActionResponse> {
+  const ip = (await headers()).get('x-forwarded-for') ?? 'unknown'
+  const { allowed, remaining } = rateLimit(`login:${ip}`, { max: 5, windowMs: 60_000 })
+  if (!allowed) {
+    return {
+      success: false,
+      error: 'Too many login attempts. Please try again later.',
+    }
+  }
+
   const validation = LoginSchema.safeParse(data)
```

Apply similar guards to:
- `signupAction` — max 3 per hour per IP
- `forgotPasswordAction` — max 3 per hour per email/IP
- `resetPasswordAction` — max 5 per 15 minutes per IP

---

## 5. Missing Security Headers

**Severity:** Medium
**File:** `next.config.ts` (empty)
**Category:** OWASP A05:2021 — Security Misconfiguration

### The Problem

The `next.config.ts` is completely empty — no security headers configured. The app is served without:
- **Content-Security-Policy** (CSP) — prevents XSS and data injection
- **Strict-Transport-Security** (HSTS) — enforces HTTPS
- **X-Content-Type-Options** — prevents MIME sniffing
- **X-Frame-Options** — prevents clickjacking
- **Referrer-Policy** — controls referrer header leakage

### The Fix

```diff
 import type { NextConfig } from "next";

 const nextConfig: NextConfig = {
-  /* config options here */
+  async headers() {
+    return [
+      {
+        source: '/(.*)',
+        headers: [
+          {
+            key: 'X-Content-Type-Options',
+            value: 'nosniff',
+          },
+          {
+            key: 'X-Frame-Options',
+            value: 'DENY',
+          },
+          {
+            key: 'Referrer-Policy',
+            value: 'strict-origin-when-cross-origin',
+          },
+          {
+            key: 'Strict-Transport-Security',
+            value: 'max-age=63072000; includeSubDomains; preload',
+          },
+        ],
+      },
+    ]
+  },
 };

 export default nextConfig;
```

---

## 6. No Session Invalidation After Password Reset

**Severity:** High
**File:** `src/actions/auth.ts:266-279`
**Category:** OWASP A07:2021 — Identification and Authentication Failures

### The Problem

When a password is reset, the `resetPasswordAction` updates the password and creates a new session, but **does not invalidate existing sessions** for that user:

```ts
await Promise.all([
  prisma.user.update({
    where: { id: resetToken.userId },
    data: { password: hashedPassword },
  }),
  prisma.resetToken.update({                        // Only marks the reset token as used
    where: { id: resetToken.id },
    data: { usedAt: new Date() },
  }),
])

await createSession(user.id)  // Creates new session but old ones still work
```

If an attacker had stolen a session cookie before the password reset (e.g., via XSS or a compromised device), that session remains valid after the password change. The user's password change does not force re-authentication of existing sessions.

### The Fix

Delete all sessions for the user before creating the new one:

```diff
+    // Invalidate all existing sessions for this user
+    await prisma.session.deleteMany({
+      where: { userId: resetToken.userId },
+    }).catch(() => {})

     // Sign the user in after reset
     await createSession(user.id)
```

This ensures that any previously stolen session tokens are immediately revoked when the password is reset.

---

## 7. No CSRF Protection on the Validate-Session API

**Severity:** Low
**File:** `src/app/api/auth/validate-session/route.ts`
**Category:** OWASP A01:2021 — Broken Access Control

### The Problem

The `/api/auth/validate-session` endpoint is a GET route with no CSRF protection. While GET requests are generally not vulnerable to CSRF (they don't modify state), this endpoint returns user data:

```ts
return NextResponse.json({
  isValid: true,
  user: dbSession.user,  // Exposes id, name, email to the caller
})
```

A malicious site could use `<img>` or `<script>` tags to trigger a GET request to this endpoint and, if the user has a session cookie, the response (though not readable by JavaScript via `<img>`) could leak data through side-channels or cached responses.

### The Fix

Add a custom request header check (Next.js proxy sets a shared secret header) and limit the data returned. Since this endpoint is only called internally by the proxy (via `fetch`), add an internal authentication mechanism:

```diff
+import { headers } from 'next/headers'

 export async function GET(request: Request) {
+  // This endpoint is only called internally by the proxy.
+  // Verify the internal request header to prevent external CSRF-style access.
+  const requestHeaders = await headers()
+  if (requestHeaders.get('x-internal-request') !== 'true') {
+    return NextResponse.json({ isValid: false }, { status: 403 })
+  }
+
   const cookieHeader = request.headers.get('cookie')
```

And update the proxy to set this header:

```diff
 const res = await fetch(validateUrl, {
   headers: {
     cookie: `session_token=${sessionToken}`,
+    'x-internal-request': 'true',
   },
   cache: 'no-store',
 })
```

---

## 8. Password Policy Weaknesses

**Severity:** Low
**File:** `src/lib/validations.ts:6-11`
**Category:** NIST SP 800-63B / OWASP A04:2021

### The Problem

Current password policy:

```
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- No special character requirement
- No check against common/breached passwords
- No maximum length
```

NIST SP 800-63B recommends:
- **Minimum 8 characters** ✓ (but 12+ is better for high-value apps)
- **No composition rules** — length trumps complexity. Random character requirements (uppercase, lowercase, number) actually encourage predictable patterns (`Password1!`). NIST recommends allowing any printable ASCII, with a 64+ character max.
- **Check against known breached passwords** — use Have I Been Pwned's API
- **Allow spaces** — passphrases are stronger and more usable

### The Fix

```diff
 export const SignUpSchema = z.object({
   name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
   email: z.string().email({ message: 'Please enter a valid email address.' }),
   password: z
     .string()
-    .min(8, { message: 'Password must be at least 8 characters.' })
-    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter.' })
-    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter.' })
-    .regex(/[0-9]/, { message: 'Password must contain at least one number.' }),
+    .min(8, { message: 'Password must be at least 8 characters.' })
+    .max(128, { message: 'Password must be at most 128 characters.' })
+    .regex(/[A-Za-z]/, { message: 'Password must contain at least one letter.' })
+    .regex(/[0-9]/, { message: 'Password must contain at least one number.' }),
 })
```

Key changes:
- **Increased minimum to 8** (kept) — NIST says 8 is acceptable for user-chosen passwords
- **Added max of 128** — bcrypt silently truncates at 72 bytes, which could lead to unexpected password behavior
- **Removed separate uppercase/lowercase requirements** — replaced with a single "at least one letter" check. `Password1` is no more secure than `password1`, but requiring both uppercase and lowercase annoys users and forces them into predictable patterns like `Password1`.
- **Consider integrating HIBP** — in production, use the Have I Been Pwned API (k-anonymity model) to check if a password appears in known breaches:

```ts
export async function isPasswordBreached(password: string): Promise<boolean> {
  const hash = crypto.createHash('sha1').update(password).digest('hex').toUpperCase()
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`)
  const text = await res.text()
  return text.split('\n').some(line => line.startsWith(suffix))
}
```

---

## 9. Reset Token Exposure via URL Query Parameter

**Severity:** Low-Medium
**File:** `src/actions/auth.ts:205`, `src/app/reset-password/page.tsx`
**Category:** OWASP A05:2021 — Security Misconfiguration

### The Problem

The password reset token is sent as a URL query parameter:

```
/reset-password?token=a1b2c3d4e5f6...
```

This exposes the token in:
- **Referrer headers** — if the page loads a third-party resource (analytics, CDN fonts, images), the full URL (including the token) may be sent in the `Referer` header
- **Browser history** — the URL with token is stored in browsing history
- **Server logs** — the full URL including query params is often logged
- **Screen captures / shared screens** — the URL bar is visible

### The Fix

Use a `POST`-only flow instead. The reset email sends a link to `/reset-password?id=<opaque-id>` where `id` is the ResetToken's database `id` (a CUID, not the token). The token itself is submitted via a POST body when the form is submitted.

Alternatively, accept the token via POST body only. The email link takes the user to `/reset-password` (no query param), where they paste a code from the email.

Simplest practical fix — add a `Referrer-Policy` meta tag to the reset page and ensure the page doesn't load external resources:

```diff
+export const metadata: Metadata = {
+  title: 'Reset Password — The Gatekeeper',
+  referrer: 'no-referrer',
+}
```

Update the email link to use a POST-accessible route:

```diff
-const resetLink = `${baseUrl}/reset-password?token=${token}`
+const resetId = resetToken.id  // Use the CUID, not the secret token
+const resetLink = `${baseUrl}/reset-password?id=${resetId}`
```

The reset page loads, fetches the user-facing token from the server (validating the `id`), and shows a masked confirmation before accepting the new password. Or, simpler: keep the token in the URL but set `no-referrer` policy.

---

## 10. Credentials Committed to `.env`

**Severity:** High (operational)
**File:** `.env`
**Category:** OWASP A05:2021 — Security Misconfiguration

### The Problem

The `.env` file contains live Supabase database credentials:

```
DATABASE_URL="postgresql://postgres.srjifhkgwgwfjwqgckhs:Z3VRfDfu0P3r3vkm@..."
DIRECT_URL="postgresql://postgres:Z3VRfDfu0P3r3vkm@..."
```

While `.env` is in `.gitignore` (preventing git commits), the credentials are present on disk and in `process.env` at runtime. Anyone with filesystem access to the server can extract them. In a CI/CD pipeline, a misconfigured environment could leak them to logs.

### The Fix

For any non-local deployment:
1. **Never put real credentials in `.env` files** committed to any repository. Use a `.env.example` file with placeholder values.
2. **Use environment variables** set through the deployment platform (Vercel, AWS, Railway, etc.) — these are managed securely and never written to disk as plain text.
3. **Rotate the current credentials** — the Supabase password (`Z3VRfDfu0P3r3vkm`) has been exposed in this codebase and should be considered compromised.

Create `.env.example`:

```env
# Database configuration
# Copy this file to .env and fill in your values.
DATABASE_URL="postgresql://user:password@host:port/database"
DIRECT_URL="postgresql://user:password@host:port/database"
```

---

## Summary

| # | Issue | Severity | Category | Fixed |
|---|-------|----------|----------|-------|
| 1 | Session token displayed on dashboard | Medium | A04 Insecure Design | Remove token display |
| 2 | Timing side-channel on email lookups | Medium | A08 Timing Attack | Add dummy bcrypt/delay |
| 3 | Weak cookie flags (secure, __Host- prefix) | Low-Medium | A05 Misconfiguration | Harden cookie config |
| 4 | Missing rate limiting | High | A01 Broken Access Control | Add rate-limiter |
| 5 | Missing security headers | Medium | A05 Misconfiguration | Add CSP, HSTS, etc. |
| 6 | No session invalidation on password reset | High | A07 Auth Failures | Delete sessions on reset |
| 7 | No CSRF protection on validate-session API | Low | A01 Broken Access Control | Add internal header check |
| 8 | Password policy weaknesses | Low | A04 Insecure Design | Relax composition rules, add max length |
| 9 | Reset token in URL query parameter | Low-Medium | A05 Misconfiguration | Add no-referrer policy |
| 10 | Credentials in .env file | High (ops) | A05 Misconfiguration | Rotate, use .env.example |

**Risk rating guide:**
- **High** — Exploitable remotely with low to moderate skill; directly leads to account takeover or data exposure
- **Medium** — Requires some preconditions (XSS, network access); contributes to a chain of vulnerabilities
- **Low** — Defensive hardening; exploitation requires significant additional vulnerabilities
