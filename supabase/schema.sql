-- Run this whole file in Supabase: Project > SQL Editor > New query > Run

-- ========== EVENTS ==========
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  date date not null,
  time text,
  town text not null,
  location text,
  category text not null default 'Other',
  status text not null default 'approved' check (status in ('approved', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table events enable row level security;

-- Anyone can read events (this is a public bulletin board)
create policy "Public can read events"
  on events for select
  using (true);

-- No insert/update/delete policy for anon on purpose:
-- for now, you add/edit/cancel events yourself from the Supabase Table Editor.

-- ========== SUBSCRIBERS ==========
create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table subscribers enable row level security;

-- Anyone can sign up (insert their own email)...
create policy "Anyone can subscribe"
  on subscribers for insert
  with check (true);

-- ...but no one (besides you, via the dashboard) can read the list back out.
-- Intentionally no select policy here — keeps the email list private.

-- ========== SAMPLE DATA (optional) ==========
-- Delete or edit these once you've got real events. Dates are relative to
-- when you run this, so they'll show up as "upcoming" right away.
insert into events (title, description, date, time, town, location, category, status)
values
  ('Saturday Farmers Market', 'Local produce, baked goods, and honey on the town green. Rain or shine.',
   current_date + 2, '8:00 AM – 1:00 PM', 'Millbrook', 'Town Green', 'Market', 'approved'),
  ('Planning Board Meeting', 'Public hearing on the proposed bike-lane extension along Route 9.',
   current_date + 4, '7:00 PM', 'Fairview', 'Fairview Town Hall', 'Meeting / Civic', 'approved'),
  ('Open Mic Night', 'Sign-ups start at 6:30. All instruments and poets welcome.',
   current_date + 1, '7:00 PM – 10:00 PM', 'Cedar Falls', 'The Grange Hall', 'Music', 'cancelled'),
  ('Storytime & Craft Hour', 'For ages 3–8. This week''s theme: pond critters.',
   current_date + 6, '10:30 AM', 'Millbrook', 'Millbrook Public Library', 'Kids & Family', 'approved');
