# The Valley Bulletin — Deploy Guide

This is a real, working version of the prototype you tested — same look, same
features (browse/search/filter events, cancelled events shown crossed out,
email signup). It's wired to a real database instead of the temporary
storage the chat prototype used.

Follow these steps in order. None of it requires writing new code — just
copying, pasting, and clicking.

## 1. Set up the database (Supabase)

1. Go to your Supabase project (the one you already created).
2. In the left sidebar, click **SQL Editor** → **New query**.
3. Open `supabase/schema.sql` from this folder, copy all of it, paste it
   into the editor, and click **Run**.
   - This creates two tables (`events` and `subscribers`) with the right
     security rules, and drops in a few sample events so the site isn't
     empty on day one.
4. In the left sidebar, go to **Project Settings** → **Data API**.
   - Find the list of tables and make sure **`events`** and
     **`subscribers`** are both toggled ON (exposed to the API). Since you
     turned off "automatically expose new tables," you need to switch these
     two on by hand, once.
5. Still in **Project Settings** → **API**, copy two values:
   - **Project URL**
   - **anon public** key

## 2. Add your Supabase keys

1. In this project folder, copy `.env.local.example` to a new file named
   `.env.local`.
2. Paste in the Project URL and anon key you copied above.

(This file is just for testing on your own computer later — you'll enter
these same two values into Vercel in step 4.)

## 3. Push this project to GitHub

1. Go to github.com, click **New repository**, name it something like
   `valley-bulletin`, and create it (keep it private if you'd like — that's
   fine).
2. Upload this entire folder into that repository. The easiest way if
   you're not using the command line: on the repo page, click
   **"uploading an existing file"** and drag in everything from this
   folder (keep the folder structure — `app/`, `lib/`, `supabase/`, etc.).

## 4. Deploy on Vercel

1. Go to vercel.com, log in with your GitHub account.
2. Click **Add New** → **Project**, and pick the `valley-bulletin` repo
   you just created.
3. Before clicking Deploy, open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` → your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → your anon key
4. Click **Deploy**. After a minute or two, Vercel gives you a live URL
   like `valley-bulletin.vercel.app` — that's your real site.

## Managing events (for now)

There's no submission form or moderation screen in this version on purpose
— that got cut for the MVP. To add, edit, or cancel an event:

1. Go to your Supabase project → **Table Editor** → `events`.
2. Add a new row, or edit an existing one.
3. To cancel an event without deleting it, change its `status` from
   `approved` to `cancelled` — it'll show up on the site crossed out with
   a "CANCELLED" tag, exactly like in the prototype.

## What's intentionally not included yet

- **Custom domain** — you're launching on the free `*.vercel.app` address.
  Adding a real domain later is a few clicks in Vercel's settings, no code
  changes needed.
- **Sending the weekly email** — subscriber emails are being collected and
  saved in the `subscribers` table, but nothing sends them anything yet.
  That's a separate piece (an email service + a weekly scheduled job) to
  add whenever you're ready.
- **Public event submission + moderation** — visitors can't submit events
  themselves yet; that's the feature we set aside for this MVP.
- **AI scraping of nearby towns** — same story; that's a scheduled
  background job, a bigger separate piece of work.
