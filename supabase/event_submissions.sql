-- Public "Submit an event" form entries. Kept apart from the live `events`
-- table: nothing here appears on the site until it's reviewed and copied over
-- by hand. Already applied to the production database; kept here for reference.
--
-- No public access at all - only the server-side route (app/api/submit-event)
-- writes to this table, using the service role key.

create table public.event_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'accepted', 'rejected')),
  title text not null check (char_length(title) between 1 and 120),
  event_date date not null,
  location text not null check (char_length(location) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  url text not null check (char_length(url) <= 500 and url ~* '^https?://')
);

alter table public.event_submissions enable row level security;
revoke all on public.event_submissions from anon, authenticated;
grant select, insert, update, delete on public.event_submissions to service_role;
