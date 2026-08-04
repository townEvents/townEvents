-- Run this in Supabase SQL Editor (in addition to the original schema.sql,
-- which you've already run). This adds what's needed for AI-scraped events.

-- Track where an event came from, and allow a "pending" status for new
-- AI-found events awaiting a quick human glance before they go public.
alter table events add column if not exists source text not null default 'manual';
alter table events add column if not exists source_url text;

alter table events drop constraint if exists events_status_check;
alter table events add constraint events_status_check
  check (status in ('pending', 'approved', 'cancelled'));

-- Clean out the placeholder sample events from the original setup —
-- real towns are taking over from here.
delete from events where town in ('Millbrook', 'Fairview', 'Cedar Falls');
