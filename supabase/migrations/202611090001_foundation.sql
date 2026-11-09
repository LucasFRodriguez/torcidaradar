-- Apply to a dedicated Supabase project, never production without review.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check (char_length(display_name)<=60 and display_name !~ '[<>]'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 hide_scores boolean not null default false,
 timezone text not null default 'America/Sao_Paulo' check (timezone in ('America/Sao_Paulo','America/Manaus','America/Recife','UTC')),
 updated_at timestamptz not null default now()
);
create table public.teams (
 id uuid primary key default gen_random_uuid(), provider text not null default 'api-football' check(provider='api-football'),
 provider_id integer not null check(provider_id>0), name text not null check(char_length(name) between 1 and 120),
 slug text not null unique check(slug ~ '^[a-z0-9-]{1,160}$'),country text,updated_at timestamptz not null default now(),unique(provider,provider_id)
);
create table public.user_favorite_teams (
 user_id uuid not null references auth.users(id) on delete cascade,team_id uuid not null references public.teams(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(user_id,team_id)
);
create table public.competitions (
 id uuid primary key default gen_random_uuid(),provider text not null default 'api-football' check(provider='api-football'),provider_id integer not null check(provider_id>0),
 name text not null,type text not null check(type in ('League','Cup')),country text,updated_at timestamptz not null default now(),unique(provider,provider_id)
);
create table public.competition_seasons (
 id uuid primary key default gen_random_uuid(),competition_id uuid not null references public.competitions(id) on delete cascade,
 year integer not null check(year between 2000 and 2100),standings_available boolean not null default false,updated_at timestamptz not null default now(),unique(competition_id,year)
);
create table public.team_competitions (
 team_id uuid not null references public.teams(id) on delete cascade,season_id uuid not null references public.competition_seasons(id) on delete cascade,
 updated_at timestamptz not null default now(),primary key(team_id,season_id)
);
create table public.fixtures (
 id uuid primary key default gen_random_uuid(),provider text not null default 'api-football' check(provider='api-football'),provider_id integer not null check(provider_id>0),
 season_id uuid not null references public.competition_seasons(id),home_team_id uuid not null references public.teams(id),away_team_id uuid not null references public.teams(id),
 kickoff_at timestamptz,status text not null check(status in ('TBD','NS','1H','HT','2H','ET','BT','P','FT','AET','PEN','SUSP','INT','PST','CANC','ABD','AWD','WO','LIVE')),
 home_score integer check(home_score>=0),away_score integer check(away_score>=0),home_penalties integer check(home_penalties>=0),away_penalties integer check(away_penalties>=0),
 updated_at timestamptz not null default now(),unique(provider,provider_id),check(home_team_id<>away_team_id)
);
create index fixtures_kickoff on public.fixtures(kickoff_at);
create index fixtures_home_date on public.fixtures(home_team_id,kickoff_at);
create index fixtures_away_date on public.fixtures(away_team_id,kickoff_at);
create table public.standings (
 season_id uuid not null references public.competition_seasons(id) on delete cascade,team_id uuid not null references public.teams(id),
 group_name text not null default '',rank integer not null check(rank>0),points integer not null,played integer not null check(played>=0),wins integer not null check(wins>=0),draws integer not null check(draws>=0),losses integer not null check(losses>=0),
 updated_at timestamptz not null default now(),primary key(season_id,team_id,group_name)
);
create table public.sync_runs (
 id uuid primary key default gen_random_uuid(),resource text not null,started_at timestamptz not null default now(),finished_at timestamptz,
 status text not null check(status in ('running','success','failed')),metrics jsonb not null default '{}',sanitized_error text
);
create table public.account_deletion_requests (
 user_id uuid primary key references auth.users(id) on delete cascade,requested_at timestamptz not null default now(),
 status text not null default 'pending' check(status in ('pending','processing','completed'))
);
create table public.rate_limits (bucket text primary key check(char_length(bucket)<=160),window_start timestamptz not null,hits integer not null check(hits>0));
create table public.job_leases (name text primary key,owner uuid not null,expires_at timestamptz not null);
create table public.api_daily_budget (day date primary key,used integer not null check(used>=0));

-- Default-deny on every application table, including infrastructure.
alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_favorite_teams enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.teams enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_seasons enable row level security;
alter table public.team_competitions enable row level security;
alter table public.fixtures enable row level security;
alter table public.standings enable row level security;
alter table public.sync_runs enable row level security;
alter table public.rate_limits enable row level security;
alter table public.job_leases enable row level security;
alter table public.api_daily_budget enable row level security;

revoke all on public.profiles,public.user_preferences,public.user_favorite_teams,public.account_deletion_requests,public.teams,public.competitions,public.competition_seasons,public.team_competitions,public.fixtures,public.standings,public.sync_runs,public.rate_limits,public.job_leases,public.api_daily_budget from anon,authenticated;
grant select,insert,update,delete on public.profiles,public.user_preferences,public.user_favorite_teams to authenticated;
grant select,insert on public.account_deletion_requests to authenticated;
grant select on public.teams,public.competitions,public.competition_seasons,public.team_competitions,public.fixtures,public.standings to authenticated;
grant all on public.profiles,public.user_preferences,public.user_favorite_teams,public.account_deletion_requests,public.teams,public.competitions,public.competition_seasons,public.team_competitions,public.fixtures,public.standings,public.sync_runs,public.rate_limits,public.job_leases,public.api_daily_budget to service_role;
create policy profile_owner on public.profiles to authenticated using ((select auth.uid()) is not null and id=(select auth.uid())) with check ((select auth.uid()) is not null and id=(select auth.uid()));
create policy preferences_owner on public.user_preferences to authenticated using ((select auth.uid()) is not null and user_id=(select auth.uid())) with check ((select auth.uid()) is not null and user_id=(select auth.uid()));
create policy favorites_owner on public.user_favorite_teams to authenticated using ((select auth.uid()) is not null and user_id=(select auth.uid())) with check ((select auth.uid()) is not null and user_id=(select auth.uid()));
create policy deletion_read on public.account_deletion_requests for select to authenticated using ((select auth.uid()) is not null and user_id=(select auth.uid()));
create policy deletion_request on public.account_deletion_requests for insert to authenticated with check ((select auth.uid()) is not null and user_id=(select auth.uid()) and status='pending' and exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) m where m->>'method'='password' and (m->>'timestamp')::numeric >= extract(epoch from now())-300));
create policy sports_read on public.teams for select to authenticated using ((select auth.uid()) is not null);
create policy sports_read on public.competitions for select to authenticated using ((select auth.uid()) is not null);
create policy sports_read on public.competition_seasons for select to authenticated using ((select auth.uid()) is not null);
create policy sports_read on public.team_competitions for select to authenticated using ((select auth.uid()) is not null);
create policy sports_read on public.fixtures for select to authenticated using ((select auth.uid()) is not null);
create policy sports_read on public.standings for select to authenticated using ((select auth.uid()) is not null);

-- SECURITY INVOKER: executable only by service_role. No RLS bypass functions.
create function public.consume_rate_limit(p_bucket text,p_limit integer,p_seconds integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_limit<1 or p_limit>1000 or p_seconds<1 or p_seconds>86400 then raise exception 'invalid limit'; end if;
 insert into public.rate_limits(bucket,window_start,hits) values(p_bucket,now(),1)
 on conflict(bucket) do update set hits=case when public.rate_limits.window_start<=now()-make_interval(secs=>p_seconds) then 1 else public.rate_limits.hits+1 end,
 window_start=case when public.rate_limits.window_start<=now()-make_interval(secs=>p_seconds) then now() else public.rate_limits.window_start end returning hits into n;
 return n<=p_limit;
end;$$;
create function public.acquire_sync_lease(p_owner uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 insert into public.job_leases(name,owner,expires_at) values('sports',p_owner,now()+interval '10 minutes')
 on conflict(name) do update set owner=excluded.owner,expires_at=excluded.expires_at where public.job_leases.expires_at<now() or public.job_leases.owner=p_owner;
 get diagnostics n=row_count;return n=1;
end;$$;
create function public.reserve_api_request(p_owner uuid,p_budget integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 if p_budget<1 or p_budget>10000 then raise exception 'invalid budget'; end if;
 perform 1 from public.job_leases where name='sports' and owner=p_owner and expires_at>now() for update;
 if not found then return false; end if;
 update public.job_leases set expires_at=now()+interval '10 minutes' where name='sports' and owner=p_owner;
 insert into public.api_daily_budget(day,used) values((now() at time zone 'UTC')::date,1)
 on conflict(day) do update set used=public.api_daily_budget.used+1 where public.api_daily_budget.used<p_budget;
 get diagnostics n=row_count;return n=1;
end;$$;
revoke all on function public.consume_rate_limit(text,integer,integer),public.acquire_sync_lease(uuid),public.reserve_api_request(uuid,integer) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer),public.acquire_sync_lease(uuid),public.reserve_api_request(uuid,integer) to service_role;

create function public.touch_updated_at() returns trigger language plpgsql security invoker set search_path='' as $$begin new.updated_at=now();return new;end;$$;
create trigger profile_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger preferences_updated before update on public.user_preferences for each row execute function public.touch_updated_at();

revoke all on function public.touch_updated_at() from public,anon;
grant execute on function public.touch_updated_at() to authenticated,service_role;
