# The Gatekeeper 🔒

A production-quality security portal built using **Next.js 16 (App Router)**, **TypeScript**, and **Tailwind CSS**. It securely handles user registration, credentials login, stateful database-backed session management, route protection, and sign-out functionality.

## Core Features

- 🏠 **Landing Page (`/`)**: A modern, responsive, and glassmorphic portal intro page.
- 📝 **Registration (`/signup`)**: Live validation errors with a multi-level password strength meter (Weak, Fair, Good, Strong) using React Hook Form and Zod.
- 🔑 **Login (`/login`)**: Secure form login using bcryptjs comparison and database-backed session assignment.
- 🛡️ **Protected Dashboard (`/dashboard`)**: Displays authenticated user details and active session diagnostics.
- 🔄 **Route Guarding**: Next.js 16 `proxy.ts` redirects unauthenticated traffic trying to access the dashboard and authenticated traffic trying to access auth forms.
- 🍪 **HTTP-only Cookies**: Cryptographically secure session tokens stored only in HTTP-only, secure, SameSite=Lax cookies.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, with the new `proxy.ts` routing interceptor)
- **Database ORM**: Prisma v6 (SQLite for local development, easily swappable to PostgreSQL)
- **Styling**: Tailwind CSS v4
- **Form Management**: React Hook Form
- **Validation Schema**: Zod
- **Hashing Security**: bcryptjs

---

## File Structure

```text
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── validate-session/
│   │           └── route.ts         # Secure internal API for proxy validation
│   ├── dashboard/
│   │   └── page.tsx                 # Protected user dashboard
│   ├── login/
│   │   └── page.tsx                 # Login UI form
│   ├── signup/
│   │   └── page.tsx                 # Registration UI form + strength meter
│   ├── layout.tsx                   # Font configurations & core document markup
│   ├── globals.css                  # Tailwind CSS rules & dark mode values
│   └── page.tsx                     # Portal landing page
│
├── actions/
│   └── auth.ts                      # Server Actions (SignUp, Login, Logout)
│
├── lib/
│   ├── prisma.ts                    # Global Prisma client instance manager
│   ├── session.ts                   # Session DB inserts, updates, and cookie helpers
│   └── validations.ts               # Shared Zod forms validation schemas
│
└── proxy.ts                         # Next.js 16 Proxy (formerly middleware.ts)
```

---

## Environment Variables Setup Guide

Create a `.env` file in the root directory (one has already been preconfigured for local development).

```env
# SQLite for local development (default)
DATABASE_URL="file:./dev.db"

# Swap with the following for production PostgreSQL (e.g. Supabase)
# DATABASE_URL="postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres?schema=public"
```

To switch to PostgreSQL, update the `DATABASE_URL` connection string in `.env` and change the `provider` in `prisma/schema.prisma` from `"sqlite"` to `"postgresql"`.

---

## Getting Started

### 1. Install Dependencies
Ensure you have Node.js installed, then run:
```bash
npm install
```

### 2. Prepare Database Tables
Run Prisma push to initialize the local SQLite database file (`prisma/dev.db`) and generate the Prisma client:
```bash
npx prisma db push
```

### 3. Run Development Server
Start the local server:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to experience **The Gatekeeper**.

### 4. Build for Production
To verify standard production compilation:
```bash
npm run build
```

---

## Security Implementation Details

1. **Stateful Session Storage**: Sessions are not token-based stateless JWTs that cannot be revoked. Instead, each session generates a secure random 32-byte token stored in the database with a 7-day TTL. On logout, the database entry is deleted, immediately revoking access.
2. **Next.js 16 Proxy Integration**: Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts`. Since database connection pools (like Prisma direct engines) cannot run inside the Edge sandbox runtime of `proxy.ts`, validation requests are made via an internal API call (`/api/auth/validate-session`) which runs under the standard Node.js runtime.
3. **Password Security**: Plaintext passwords never hit the database. All passwords are encrypted using `bcryptjs` with 10 salt rounds before database persistence.
4. **Client & Server Validation**: Input schemas are validated directly in client forms using React Hook Form + Zod for dynamic warnings, and re-validated on the server inside Server Actions to prevent API tampering.
