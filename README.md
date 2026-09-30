# Kinsa

Staff compliance tracker for Australian NDIS providers. V1 covers worker profiles, document approval, expiry reminders, in-app training, evidence export and an audit log.

This product helps providers organise evidence. It does not guarantee an audit outcome.

## Stack

- Next.js 16 App Router
- Supabase (Sydney): Auth, Postgres with RLS, private Storage
- Resend for invite and reminder email (email content is stored in the US)
- Vercel Cron for daily reminder sweeps

## Setup

1. Copy `.env.example` to `.env.local`
2. Point it at the Sydney Supabase project and add `SUPABASE_SECRET_KEY` for cron
3. Add `RESEND_API_KEY` and a sending address when you want live email
4. `npm run dev`

## Deploy (Vercel)

1. Push `main` to GitHub and import the repo in Vercel (region `syd1` is set in `vercel.json`)
2. Set production env vars from `.env.example`. Use the real site URL for `NEXT_PUBLIC_APP_URL`
3. Set a strong `CRON_SECRET` and the Supabase secret key so `/api/cron/reminders` can run
4. In Supabase Auth → URL configuration:
   - Site URL: `https://app-kinsa.com.au`
   - Redirect URLs: `https://app-kinsa.com.au/**` and `http://localhost:3000/**` (for local dev)
5. Add `RESEND_API_KEY` / `RESEND_FROM_EMAIL` when email should go live

## Isolation

Apply and inspect `supabase/tests/isolation.sql`. An authenticated user from Org A must see 1 organisation, 1 document, and 0 rows for Org B’s file.
