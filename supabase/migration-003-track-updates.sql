-- Run this in Supabase SQL Editor.

-- Track when a row was last changed, separate from when it was first
-- created, so the site can show a small "updated" note on events that
-- got new details filled in after their first appearance.
alter table events add column if not exists updated_at timestamptz not null default now();

-- Adding the column above stamps every existing row with "right now" as
-- its updated_at, which would make every pre-existing event falsely show
-- as "updated today". Reset it to match created_at so only genuine future
-- changes count.
update events set updated_at = created_at;

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
