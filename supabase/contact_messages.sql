-- Messages sent through the public Contact form (app/api/contact). Each is
-- saved here first, then emailed to the site owner; `emailed` records whether
-- that email went out. Already applied to the production database; kept here
-- for reference.
--
-- No public access at all - only the server-side route writes to this table,
-- using the service role key. Email and message are required; name and phone
-- are optional.

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'handled')),
  email text not null check (char_length(email) between 3 and 254),
  message text not null check (char_length(message) between 1 and 2000),
  emailed boolean not null default false,
  -- Optional, only if the sender chose to give them.
  name text check (name is null or char_length(name) <= 100),
  phone text check (phone is null or char_length(phone) <= 30)
);

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;
grant select, insert, update, delete on public.contact_messages to service_role;
