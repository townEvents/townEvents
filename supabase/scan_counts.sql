-- Counts for the "store click" (?sc=businessNNNN) links printed on flyers: how
-- many times each link was opened (visits) and how many newsletter signups
-- came from it (signups). One row per code, created the first time that code
-- is seen. Nothing about the visitor is stored - just the two counters.
--
-- No public access at all. The only way in is record_scan(), called by the
-- server-side routes (app/api/scan and app/api/subscribe) with the service
-- role key. Both the table and the function reject any code that isn't
-- business0001 through business9999.

create table public.scan_counts (
  code text primary key check (code ~ '^business[0-9]{4}$' and code <> 'business0000'),
  visits bigint not null default 0,
  signups bigint not null default 0,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

alter table public.scan_counts enable row level security;
revoke all on public.scan_counts from anon, authenticated;
grant select, insert, update, delete on public.scan_counts to service_role;

-- Adds 1 to a code's visits or signups, creating the row on first sight. Done
-- in a single statement so two people scanning at the same moment can't lose a
-- count.
create or replace function public.record_scan(p_code text, p_kind text)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_code is null or p_code !~ '^business[0-9]{4}$' or p_code = 'business0000' then
    raise exception 'invalid scan code';
  end if;

  if p_kind = 'visit' then
    insert into public.scan_counts (code, visits) values (p_code, 1)
    on conflict (code) do update set visits = scan_counts.visits + 1, last_seen = now();
  elsif p_kind = 'signup' then
    insert into public.scan_counts (code, signups) values (p_code, 1)
    on conflict (code) do update set signups = scan_counts.signups + 1, last_seen = now();
  else
    raise exception 'invalid scan kind';
  end if;
end;
$$;

revoke all on function public.record_scan(text, text) from public, anon, authenticated;
grant execute on function public.record_scan(text, text) to service_role;
