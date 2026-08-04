-- Run this in Supabase SQL Editor.

-- Track when a row was last changed, separate from when it was first
-- created, so the site can show a small "updated" note on events that
-- got new details filled in after their first appearance.
alter table events add column if not exists updated_at timestamptz not null default now();

create or replace function set_events_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists events_set_updated_at on events;
create trigger events_set_updated_at
  before update on events
  for each row
  execute function set_events_updated_at();
