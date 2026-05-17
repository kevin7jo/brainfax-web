# Brainfax Web (Next.js + Tailwind + Supabase)

This repository is a starter for the Brainfax frontend using Next.js App Router, Tailwind CSS and Supabase for auth + realtime.

## Setup (local)

1. Copy `.env.local.example` to `.env.local` and fill your Supabase credentials.

2. Install dependencies:

```bash
npm install
```

3. Run development server:

```bash
npm run dev
```

Open http://localhost:3000

## Supabase notes
- Configure a Google OAuth provider in Supabase Auth settings and set the redirect URL to `http://localhost:3000/dashboard`.
- Table: `public.lb_user_balance`
  - columns: `user_id` (uuid), `bfax_queue` (integer)

## Vercel deployment quick guide
1. Push this repo to GitHub.
2. On Vercel, create a new project and import the repository.
3. Set environment variables in Vercel dashboard (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploy — Vercel will use the `next build` command automatically.

For more details see the Vercel docs.
