# The Gatekeeper — Line by Line

Imagine your app is a clubhouse with a bouncer. You need a way to let people in, prove they are who they say they are, and keep the bad guys out. This codebase does all of that. Let us walk through the three most important parts.

---

## 1. Passwords: Hashing and Verifying

### What is hashing?

Hashing is like putting a letter through a shredder. You can turn "Hello" into shredded confetti, but you can NEVER turn the confetti back into "Hello." When you sign up, the app shreds your password and saves only the confetti. If a hacker steals the database, all they find is confetti — useless to them.

### Signing up — `src/actions/auth.ts`

When you fill in the signup form and press "Create Account," the page calls a function called `signupAction`. Here is what happens, step by step:

```ts
'use server'
import bcrypt from 'bcryptjs'
```

**Line 1:** `'use server'` means this code runs on the server, not in your browser. That is important because secret stuff like password hashing must never happen on the visitor's computer.

**Line 3:** `bcrypt` is the shredding machine. It is a special library that turns passwords into confetti very, very slowly on purpose — that slowness makes it hard for attackers to guess passwords.

```ts
const validation = SignUpSchema.safeParse(data)
```

**Line 16:** Before we do anything, we check that the data looks right. Is the name at least 2 letters? Is the email shaped like an email? Is the password at least 8 characters with one uppercase, one lowercase, and one number? If not, we send back an error immediately.

```ts
const existingUser = await prisma.user.findUnique({
  where: { email: email.toLowerCase() },
})
```

**Lines 28–30:** We ask the database: "Has someone already signed up with this email?" If yes, we say "An account with this email already exists." We also lowercase the email so `John@Example.com` and `john@example.com` count as the same person.

```ts
const saltRounds = 10
const hashedPassword = await bcrypt.hash(password, saltRounds)
```

**Lines 40–41:** This is the big moment. `bcrypt.hash(password, 10)` takes your plain-text password (like `"MyS3cret!"`) and runs it through the shredder 10 times. The result is a long gibberish string like `$2a$10$7z2...`. We save THAT string — never the original password.

The number `10` is called "salt rounds." Each round doubles the time it takes to hash. 10 rounds = about 50 milliseconds, which feels instant to you but would take a hacker years to brute-force.

```ts
const user = await prisma.user.create({
  data: {
    name,
    email: email.toLowerCase(),
    password: hashedPassword,  // <-- only the confetti!
  },
})
```

**Lines 44–50:** We save the user's name, email, and **hashed** password to the database. The original password is gone forever. If an attacker steals the database, they only get the confetti.

```ts
await createSession(user.id)
```

**Line 53:** Now that the user exists, we log them in right away by creating a session (see chapter 2).

### Logging in — `src/actions/auth.ts`

When you log in, the app needs to check: "Does the password you just typed match the confetti we saved?" It cannot un-shred the confetti, so it does something clever instead:

```ts
const user = await prisma.user.findUnique({
  where: { email: email.toLowerCase() },
})
```

**Lines 80–82:** First, find the user by email. If no user exists, return a generic "Invalid email or password" error (we do NOT say which one was wrong, because that would help hackers figure out which emails are registered).

```ts
const isPasswordValid = await bcrypt.compare(password, user.password)
```

**Line 93:** This is the clever part. `bcrypt.compare` takes:
1. The password you just typed (`"MyS3cret!"`)
2. The confetti from the database (`$2a$10$7z2...`)

It hashes your password using the same settings that were baked into the confetti, then checks if the new confetti matches the saved confetti. If they match, the password is correct. If they don't, it is wrong.

```ts
if (!isPasswordValid) {
  return { success: false, error: 'Invalid email or password.' }
}
```

**Lines 94–98:** Wrong password = same vague error. No hints for attackers.

```ts
await createSession(user.id)
```

**Line 102:** Password matched! Log the user in.

### Why not just save the password directly?

Imagine you use the same password for every website (please do not!). If one site saves your actual password and gets hacked, the attacker can log into all your other accounts. Hashing stops that. Even if this site gets hacked, the attacker only gets confetti, and confetti does not work as a password anywhere else.

---

## 2. Sessions: The Cookie Handshake

After you prove your password is correct, the app needs a way to remember you as you click between pages. It does this with a **session**.

### What is a session?

Think of a session like a numbered coat-check ticket. When you walk into the club, they give you a ticket with a random number on it. The bouncer keeps a list: "Ticket #4928 = Alice." Every time you come back to the coat check, you show your ticket, and they know it is you. When you leave, they tear up the ticket and cross your name off the list.

In code terms: the **session** is a row in the database that links a random token to your user ID. The **cookie** is the browser storing that token so it can show it on every page visit.

### Creating a session — `src/lib/session.ts`

```ts
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { prisma } from './prisma'

const SESSION_COOKIE_NAME = 'session_token'
const SESSION_EXPIRY_DAYS = 7
```

**Line 5:** The cookie will be called `session_token`. Think of this as the label on the coat-check ticket.

**Line 6:** Sessions expire after 7 days. After that, you need to log in again.

```ts
const token = crypto.randomBytes(32).toString('hex')
```

**Line 10:** We use Node.js's built-in `crypto` library to generate 32 random bytes and convert them to a hex string (64 characters long). This is like printing a completely random ticket number. It is so long and random that nobody could ever guess it.

```ts
const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
```

**Line 11:** Calculate the expiration date: right now + 7 days worth of milliseconds.

```ts
await prisma.session.create({
  data: { token, userId, expiresAt },
})
```

**Lines 14–19:** Save the session in the database:

| token | userId | expiresAt |
|-------|--------|-----------|
| `a1b2c3d4...` | `user_42` | 2026-06-15 20:00:00 |

```ts
const cookieStore = await cookies()
cookieStore.set(SESSION_COOKIE_NAME, token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  expires: expiresAt,
  path: '/',
})
```

**Lines 23–30:** Now we hand the ticket to the browser. We set a cookie named `session_token` with the random token as its value. The cookie has four important security settings:

| Setting | Value | What it means |
|---------|-------|---------------|
| `httpOnly: true` | The cookie is invisible to JavaScript | A hacker's script on your page cannot steal it |
| `secure: true` (prod) | Only sent over HTTPS | Nobody can spy on it over Wi-Fi |
| `sameSite: 'lax'` | Only sent on same-site navigation | A link from Facebook cannot forge a request |
| `expires` | Matches the session expiry | The browser auto-deletes the cookie when it expires |

### Reading a session — `src/lib/session.ts`

Every time a page needs to know who you are, it calls `getSession()`. This is the coat-check counter where you show your ticket.

```ts
const cookieStore = await cookies()
const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
```

**Lines 36–37:** Read the `session_token` cookie from the request. If there is no cookie, the user is not logged in — return `null`.

```ts
const dbSession = await prisma.session.findUnique({
  where: { token },
  include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
})
```

**Lines 44–56:** Look up the token in the database. If found, also grab the user's details (id, name, email, when they joined) because the page will need those. This is the bouncer checking their list: "Ticket #4928... yes, that belongs to Alice."

```ts
if (new Date() > dbSession.expiresAt) {
  await prisma.session.delete({ where: { token } }).catch(() => {})
  cookieStore.delete(SESSION_COOKIE_NAME)
  return null
}
```

**Lines 63–71:** Check if the ticket has expired. If today's date is past the `expiresAt` date, delete the session from the database, delete the cookie from the browser, and treat the user as logged out.

```ts
return {
  session: { id: dbSession.id, token: dbSession.token, expiresAt: dbSession.expiresAt },
  user: dbSession.user,
}
```

**Lines 74–81:** Everything checks out. Return the session info and the user info so the page can display "Welcome back, Alice!"

### Deleting a session — `src/lib/session.ts`

When you click "Sign Out," `deleteSession()` is called. This is you leaving the club — the bouncer tears up your ticket and crosses your name off the list.

```ts
const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
if (token) {
  await prisma.session.delete({ where: { token } }).catch(() => {})
}
cookieStore.delete(SESSION_COOKIE_NAME)
```

**Lines 86–96:** Read the token from the cookie, delete that session row from the database (ignore error if it was already deleted), and remove the cookie from the browser. Now you are anonymous again.

---

## 3. How the Protected Route Knows You Are Logged In

We have two layers of protection. Think of them as a **bouncer at the door** (the Proxy) and a **guard at the club entrance** (the Dashboard page itself).

### Layer 1: The Bouncer at the Door — `src/proxy.ts`

In Next.js 16, the thing that used to be called "middleware" is now called a **proxy**. It runs on EVERY request before the page loads. It is a bouncer standing outside the club, checking tickets before people even walk in.

```ts
export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup'],
}
```

**Lines 46–48:** The bouncer only cares about three types of visitors:
- Anyone trying to enter `/dashboard` or any page under it
- Anyone trying to enter the `/login` page
- Anyone trying to enter the `/signup` page

For everything else (the landing page, images, etc.), the bouncer waves them through without checking.

```ts
const sessionToken = request.cookies.get('session_token')?.value
```

**Line 6:** The bouncer checks: "Do you have a coat-check ticket?" It reads the `session_token` cookie.

```ts
if (sessionToken) {
  const validateUrl = new URL('/api/auth/validate-session', request.url)
  const res = await fetch(validateUrl, {
    headers: { cookie: `session_token=${sessionToken}` },
  })
  if (res.ok) {
    const data = await res.json()
    isAuthenticated = !!data.isValid
  }
}
```

**Lines 10–22:** If you DO have a ticket, the bouncer does not just take your word for it. They call the back office (an internal API at `/api/auth/validate-session`) and ask: "Is this ticket real?" The back office checks the database and says `{ isValid: true }` or `{ isValid: false }`. This is important because the proxy cannot talk to the database directly.

```ts
const isAuthRoute = pathname === '/login' || pathname === '/signup'
const isProtectedRoute = pathname.startsWith('/dashboard')

if (isProtectedRoute && !isAuthenticated) {
  return NextResponse.redirect(loginUrl)  // -> /login
}

if (isAuthRoute && isAuthenticated) {
  return NextResponse.redirect(dashboardUrl)  // -> /dashboard
}
```

**Lines 28–41:** The bouncer makes two decisions:
1. If you are trying to visit `/dashboard` but are NOT logged in → redirected to `/login`
2. If you are trying to visit `/login` or `/signup` but ARE already logged in → redirected to `/dashboard` (no need to see the login form again)

### The Back Office — `src/app/api/auth/validate-session/route.ts`

This is the API endpoint the proxy calls. It does the same thing as `getSession()` but in a slightly different way because the proxy sends the cookie as a raw HTTP header rather than using the `next/headers` API.

```ts
const cookieHeader = request.headers.get('cookie')
```

**Line 5:** Get the raw `Cookie` header (looks like `"session_token=a1b2c3...; other=stuff"`).

```ts
const cookies = cookieHeader.split(';').reduce((acc, curr) => {
  const parts = curr.trim().split('=')
  acc[parts[0]] = parts.slice(1).join('=')
  return acc
}, {})
token = cookies['session_token']
```

**Lines 9–17:** Parse the cookie string by hand. Split on `;`, then split each piece on `=`, and build a little dictionary. Then read `cookies['session_token']`.

```ts
const dbSession = await prisma.session.findUnique({ where: { token } })
```

**Line 24:** Look up the token in the database, just like `getSession()`.

```ts
if (!dbSession) {
  return NextResponse.json({ isValid: false }, { status: 401 })
}

if (new Date() > dbSession.expiresAt) {
  await prisma.session.delete({ where: { token } }).catch(() => {})
  return NextResponse.json({ isValid: false }, { status: 401 })
}

return NextResponse.json({ isValid: true, user: dbSession.user })
```

**Lines 37–52:** Three possible answers:
1. Token not in database → `{ isValid: false }` + HTTP 401
2. Token expired → delete it, `{ isValid: false }` + HTTP 401
3. Token valid → `{ isValid: true, user: { ... } }` + HTTP 200

The proxy receives `{ isValid: true }` and knows to let the user through.

### Layer 2: The Guard at the Club Entrance — `src/app/dashboard/page.tsx`

Even after the bouncer lets you in, the Dashboard page has its own guard that checks your ID again. This is defense-in-depth: if the Proxy somehow failed or was bypassed, the Dashboard page still protects itself.

```ts
export default async function DashboardPage() {
  const sessionData = await getSession()

  if (!sessionData) {
    redirect('/login')
  }
```

**Lines 6–13:** This is a Server Component — it runs on the server, not in the browser. It calls `getSession()` to look up the session from the database one more time. If the session is missing or expired, it immediately redirects to `/login`. The user never even sees the dashboard HTML.

Only after passing BOTH checks — the Proxy AND the Dashboard page — does the user see their welcome message:

```tsx
<h1>Welcome back, {user.name}</h1>
```

---

## Putting It All Together

Here is the full journey of a user from signup to dashboard:

```
[Signup Form]
     |
     v
signupAction()              -- validates input
     |
     ├── bcrypt.hash()      -- shreds the password
     ├── prisma.user.create()  -- saves confetti to DB
     └── createSession(user.id)
           ├── crypto.randomBytes() -- generates random token
           ├── prisma.session.create() -- saves token + userId + expiry
           └── cookieStore.set()  -- hands ticket to browser
     |
     v
redirect('/dashboard')
     |
     v
[PROXY]                     -- bouncer reads cookie, calls /api/auth/validate-session
     |
     ├── No cookie  ──> redirect to /login
     └── Valid token ──> let through
     |
     v
[Dashboard Page Server Component]
     |
     ├── getSession()       -- guard checks database again
     │     ├── No cookie / expired ──> redirect to /login
     │     └── Valid ──> render page
     └── "Welcome back, {user.name}!"
```

Every layer trusts the cookie a little less and checks the database a little harder, making it very hard for an attacker to sneak in.
