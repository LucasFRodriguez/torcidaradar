-- Additive migration. No user/favorite identifiers are replaced.
alter table public.fixtures add column round text check (char_length(round)<=160);
create table public.sports_provider_state (
 provider text primary key check(provider='api-football'),day date not null,
 daily_used integer not null default 0 check(daily_used>=0),provider_used integer,
 provider_daily_limit integer,provider_remaining integer,provider_minute_limit integer,provider_minute_remaining integer,
 minute_observed_at timestamptz,plan text,active boolean,last_status_at timestamptz,last_status_request_at timestamptz,
 consecutive_failures integer not null default 0,blocked_until timestamptz,last_error text,
 updated_at timestamptz not null default now()
);
insert into public.sports_provider_state(provider,day,daily_used)
values('api-football',(now() at time zone 'UTC')::date,coalesce((select used from public.api_daily_budget where day=(now() at time zone 'UTC')::date),0));
create table public.sports_request_reservations (
 id uuid primary key default gen_random_uuid(),provider text not null references public.sports_provider_state(provider),
 owner uuid not null,endpoint text not null check(endpoint in ('status','leagues','teams','fixtures','standings')),
 priority text not null check(priority in ('high','medium')),reserved_at timestamptz not null default clock_timestamp(),settled_at timestamptz,outcome text
);
create index sports_reservations_window on public.sports_request_reservations(provider,reserved_at);
create table public.sports_sync_tasks (
 id uuid primary key default gen_random_uuid(),task_key text not null unique,kind text not null check(kind in ('discovery','teams','fixtures','standings')),
 league_id integer,season integer check(season between 2000 and 2100),priority integer not null check(priority between 1 and 3),
 next_run_at timestamptz not null default now(),last_success_at timestamptz,last_error text,
 state text not null default 'pending' check(state in ('pending','running')),owner uuid,lease_until timestamptz,
 completed_count integer not null default 0,failures integer not null default 0,
 check ((kind='discovery' and league_id is null) or (kind<>'discovery' and league_id>0 and season is not null))
);
create index sports_tasks_due on public.sports_sync_tasks(next_run_at,priority);
create table public.sports_competition_coverage (
 target text not null check(target in ('serie-a','serie-b','copa-brasil')),season integer not null,provider_id integer,
 provider_name text,available_seasons integer[] not null default '{}',standings_available boolean not null default false,
 state text not null check(state in ('advertised','available','unavailable','restricted','ambiguous')),
 last_checked_at timestamptz not null default now(),last_success_at timestamptz,last_error text,
 primary key(target,season)
);
-- Only minimal operational freshness is visible to authenticated users, no quota/plan/errors.
create table public.sports_data_freshness (
 season_id uuid not null references public.competition_seasons(id) on delete cascade,
 resource text not null check(resource in ('teams','fixtures','standings')),last_success_at timestamptz,
 state text not null default 'available' check(state in ('available','unavailable','unsupported')),last_attempt_at timestamptz not null default now(),
 primary key(season_id,resource)
);
alter table public.sports_provider_state enable row level security;
alter table public.sports_request_reservations enable row level security;
alter table public.sports_sync_tasks enable row level security;
alter table public.sports_competition_coverage enable row level security;
alter table public.sports_data_freshness enable row level security;
revoke all on public.sports_provider_state,public.sports_request_reservations,public.sports_sync_tasks,public.sports_competition_coverage,public.sports_data_freshness from public,anon,authenticated;
grant all on public.sports_provider_state,public.sports_request_reservations,public.sports_sync_tasks,public.sports_competition_coverage,public.sports_data_freshness to service_role;
grant select on public.sports_data_freshness to authenticated;
create policy freshness_read on public.sports_data_freshness for select to authenticated using ((select auth.uid()) is not null);
-- Retire the old quota entry point, retain history for audit and migration compatibility.
revoke execute on function public.reserve_api_request(uuid,integer) from service_role;

create function public.reserve_sports_request(p_owner uuid,p_endpoint text,p_priority text,p_config jsonb,p_cost integer default 1) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare s public.sports_provider_state; t timestamptz:=clock_timestamp(); d date; n integer; reservation uuid;
 daily integer:=(p_config->>'daily')::integer; per_minute integer:=(p_config->>'minute')::integer;
 cap integer:=(p_config->>'dailyLimit')::integer; min_cap integer:=(p_config->>'minuteLimit')::integer;
 reserve integer:=(p_config->>'operationalReserve')::integer; priority_reserve integer:=(p_config->>'priorityReserve')::integer;
begin
 if daily is null or per_minute is null or cap is null or min_cap is null or reserve is null or priority_reserve is null or
 daily not between 1 and 100 or per_minute not between 1 and 10 or cap not between 1 and 100 or min_cap not between 1 and 10 or
 reserve<0 or daily+reserve>cap or priority_reserve<0 or priority_reserve>=daily or p_cost not between 1 and 3 or
 p_endpoint not in ('status','leagues','teams','fixtures','standings') or p_priority not in ('high','medium') then raise exception 'invalid configuration';end if;
 perform 1 from public.job_leases where name='sports' and owner=p_owner and expires_at>t for update;
 if not found then return jsonb_build_object('allowed',false,'reason','lease_lost');end if;
 select * into s from public.sports_provider_state where provider='api-football' for update;
 d:=(t at time zone 'UTC')::date;
 if s.day<>d then
  update public.sports_provider_state set day=d,daily_used=0,provider_used=null,provider_remaining=null,provider_daily_limit=null,last_status_at=null,last_status_request_at=null,blocked_until=null,consecutive_failures=0 where provider=s.provider returning * into s;
 end if;
 if s.blocked_until>t then return jsonb_build_object('allowed',false,'reason','circuit_open','retry_after',ceil(extract(epoch from s.blocked_until-t)));end if;
 if p_endpoint='status' and s.last_status_request_at>t-interval '15 minutes' then return jsonb_build_object('allowed',false,'reason','status_recent');end if;
 if p_endpoint<>'status' and (s.last_status_at is null or s.last_status_at<t-interval '1 day' or s.plan is distinct from 'Free' or s.active is distinct from true) then return jsonb_build_object('allowed',false,'reason','status_required');end if;
 if p_endpoint<>'status' and (s.daily_used+p_cost>daily-case when p_priority='medium' then priority_reserve else 0 end or
 coalesce(s.provider_remaining,cap)-p_cost<reserve or coalesce(s.provider_daily_limit,cap)<daily+reserve) then return jsonb_build_object('allowed',false,'reason','budget');end if;
 select count(*) into n from public.sports_request_reservations where provider=s.provider and reserved_at>t-interval '60 seconds';
 if n>=least(per_minute,coalesce(s.provider_minute_limit,min_cap)) or
 (s.minute_observed_at>t-interval '60 seconds' and s.provider_minute_remaining<=0) then return jsonb_build_object('allowed',false,'reason','minute_budget','retry_after',60);end if;
 -- p_cost is the worst-case admission check. Only one actual attempt is charged.
 update public.sports_provider_state set daily_used=daily_used+case when p_endpoint='status' then 0 else 1 end,
 provider_remaining=case when p_endpoint<>'status' then provider_remaining-1 else provider_remaining end,
 provider_minute_remaining=case when minute_observed_at>t-interval '60 seconds' then greatest(provider_minute_remaining-1,0) else null end,
 last_status_request_at=case when p_endpoint='status' then t else last_status_request_at end,updated_at=t where provider=s.provider;
 insert into public.sports_request_reservations(provider,owner,endpoint,priority,reserved_at) values(s.provider,p_owner,p_endpoint,p_priority,t) returning id into reservation;
 update public.job_leases set expires_at=t+interval '10 minutes' where name='sports' and owner=p_owner;
 return jsonb_build_object('allowed',true,'reservation',reservation);
end;$$;

create function public.settle_sports_request(p_reservation uuid,p_observation jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.sports_request_reservations; s public.sports_provider_state; t timestamptz:=clock_timestamp(); code text:=p_observation->>'code';
 dl integer:=(p_observation->>'dailyLimit')::integer; dr integer:=(p_observation->>'dailyRemaining')::integer;
 ml integer:=(p_observation->>'minuteLimit')::integer; mr integer:=(p_observation->>'minuteRemaining')::integer;
 account jsonb:=p_observation->'account'; retry_seconds integer:=coalesce((p_observation->>'retryAfterSeconds')::integer,0); failures integer;
begin
 if code is null or code not in ('success','configuration','authentication','inactive_subscription','unsupported_plan','parameters','coverage','rate_limit','unavailable','timeout','network','invalid_data','pagination','budget','minute_budget','circuit_open','quota_unavailable','database','lease_lost','empty_unverified') or
 coalesce(dl,1)<1 or coalesce(dr,0)<0 or coalesce(ml,1)<1 or coalesce(mr,0)<0 or retry_seconds not between 0 and 86400 then raise exception 'invalid observation';end if;
 select * into r from public.sports_request_reservations where id=p_reservation for update;
 if not found then raise exception 'unknown reservation';end if;if r.settled_at is not null then return;end if;
 select * into s from public.sports_provider_state where provider=r.provider for update;
 -- Never reconcile a response from yesterday into today's quota.
 if (r.reserved_at at time zone 'UTC')::date=s.day then
  failures:=case when code='success' then 0 else s.consecutive_failures+1 end;
  update public.sports_provider_state set
   provider_daily_limit=coalesce(least(provider_daily_limit,dl),dl,provider_daily_limit),
   provider_remaining=coalesce(least(provider_remaining,dr),dr,provider_remaining),
   provider_minute_limit=coalesce(least(provider_minute_limit,ml),ml,provider_minute_limit),
   provider_minute_remaining=case when mr is null then provider_minute_remaining when minute_observed_at>t-interval '60 seconds' then least(coalesce(provider_minute_remaining,mr),mr) else mr end,
   minute_observed_at=case when mr is not null then t else minute_observed_at end,
   plan=coalesce(account->'subscription'->>'plan',plan),active=coalesce((account->'subscription'->>'active')::boolean,active),
   provider_used=case when account is not null then greatest(coalesce(provider_used,0),(account->'requests'->>'current')::integer) when dl is not null and dr is not null then greatest(coalesce(provider_used,0),greatest(dl-dr,0)) else provider_used end,
   last_status_at=case when r.endpoint='status' and code='success' then t else last_status_at end,
   consecutive_failures=failures,last_error=case when code='success' then null else code end,
   blocked_until=case when code in ('authentication','inactive_subscription','unsupported_plan') then t+interval '15 minutes'
    when code='rate_limit' then t+make_interval(secs=>greatest(retry_seconds,60))
    when failures>=3 then t+interval '5 minutes' else blocked_until end,updated_at=t
   where provider=r.provider;
  if account is not null then
   update public.sports_provider_state set provider_daily_limit=least(coalesce(provider_daily_limit,(account->'requests'->>'limit_day')::integer),(account->'requests'->>'limit_day')::integer),
    provider_remaining=least(coalesce(provider_remaining,2147483647),greatest((account->'requests'->>'limit_day')::integer-(account->'requests'->>'current')::integer,0)) where provider=r.provider;
  end if;
 end if;
 update public.sports_request_reservations set settled_at=t,outcome=code where id=r.id;
end;$$;

create function public.claim_sports_task(p_owner uuid,p_config jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare task public.sports_sync_tasks; s public.sports_provider_state; t timestamptz:=clock_timestamp(); available integer;
begin
 perform 1 from public.job_leases where name='sports' and owner=p_owner and expires_at>t for update;
 if not found then return null;end if;
 select * into s from public.sports_provider_state where provider='api-football' for update;
 if s.blocked_until>t or s.plan is distinct from 'Free' or s.active is distinct from true then return null;end if;
 available:=least((p_config->>'daily')::integer-s.daily_used,coalesce(s.provider_remaining,0)-(p_config->>'operationalReserve')::integer);
 select * into task from public.sports_sync_tasks where next_run_at<=t and season=(p_config->>'season')::integer and (state='pending' or lease_until<t)
 and (kind='discovery' or exists(select 1 from public.sports_competition_coverage coverage where coverage.provider_id=sports_sync_tasks.league_id and coverage.season=sports_sync_tasks.season and coverage.state in ('advertised','available')))
 and (kind in ('discovery','teams') or exists(select 1 from public.sports_sync_tasks dependency where dependency.league_id=sports_sync_tasks.league_id and dependency.season=sports_sync_tasks.season and dependency.kind='teams' and dependency.last_success_at is not null))
 and available>=3+case when priority>1 then (p_config->>'priorityReserve')::integer else 0 end
 order by priority,next_run_at,task_key for update skip locked limit 1;
 if not found then return null;end if;
 update public.sports_sync_tasks set state='running',owner=p_owner,lease_until=t+interval '10 minutes' where id=task.id returning * into task;
 return to_jsonb(task);
end;$$;

create function public.finish_sports_task(p_owner uuid,p_task uuid,p_error text,p_delay integer) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_delay not between 60 and 604800 then raise exception 'invalid delay';end if;
 update public.sports_sync_tasks set state='pending',owner=null,lease_until=null,next_run_at=clock_timestamp()+make_interval(secs=>p_delay),
 completed_count=completed_count+case when p_error is null then 1 else 0 end,failures=case when p_error is null then 0 else failures+1 end,
 last_error=p_error,last_success_at=case when p_error is null then clock_timestamp() else last_success_at end where id=p_task and owner=p_owner;
end;$$;

create or replace function public.replace_standings(p_season uuid,p_rows jsonb) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>1000 then raise exception 'empty or invalid standings';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where (r->>'season_id')::uuid is distinct from p_season) then raise exception 'invalid season';end if;
 delete from public.standings where season_id=p_season;
 insert into public.standings(season_id,team_id,group_name,rank,points,played,wins,draws,losses,updated_at)
 select season_id,team_id,group_name,rank,points,played,wins,draws,losses,updated_at from jsonb_populate_recordset(null::public.standings,p_rows);
end;$$;

-- A single transaction per completed resource; fence stale workers before any write.
create function public.commit_sports_resource(p_owner uuid,p_kind text,p_league integer,p_season integer,p_rows jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare sid uuid; c public.sports_competition_coverage; t timestamptz:=clock_timestamp(); item jsonb; tid uuid; home uuid; away uuid; results_changed boolean:=false;
begin
 perform 1 from public.job_leases where name='sports' and owner=p_owner and expires_at>t for update;
 if not found then raise exception 'lease lost';end if;
 if p_kind not in ('teams','fixtures','standings') or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 or jsonb_array_length(p_rows)>10000 then raise exception 'empty or invalid resource';end if;
 select * into c from public.sports_competition_coverage where provider_id=p_league and season=p_season and state in ('advertised','available') limit 1;
 if not found then raise exception 'unverified competition';end if;
 select cs.id into sid from public.competition_seasons cs join public.competitions co on co.id=cs.competition_id where co.provider='api-football' and co.provider_id=p_league and cs.year=p_season;
 if sid is null then raise exception 'missing season';end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  if p_kind='teams' then
   insert into public.teams(provider,provider_id,name,slug,country,updated_at) values('api-football',(item->>'provider_id')::integer,item->>'name',item->>'slug',item->>'country',t)
   on conflict(provider,provider_id) do update set name=excluded.name,slug=excluded.slug,country=excluded.country,updated_at=excluded.updated_at returning id into tid;
   insert into public.team_competitions(team_id,season_id,updated_at) values(tid,sid,t) on conflict(team_id,season_id) do update set updated_at=excluded.updated_at;
  elsif p_kind='fixtures' then
   if exists(select 1 from public.fixtures where provider='api-football' and provider_id=(item->>'provider_id')::integer and season_id<>sid) then raise exception 'fixture season mismatch';end if;
   if item->>'status' in ('FT','AET','PEN') and not exists(select 1 from public.fixtures f where f.provider='api-football' and f.provider_id=(item->>'provider_id')::integer and f.status=item->>'status' and f.home_score is not distinct from (item->>'home_score')::integer and f.away_score is not distinct from (item->>'away_score')::integer) then results_changed:=true;end if;
   select id into home from public.teams where provider='api-football' and provider_id=(item->>'home_id')::integer;
   select id into away from public.teams where provider='api-football' and provider_id=(item->>'away_id')::integer;
   if home is null or away is null then raise exception 'missing opponent';end if;
   insert into public.fixtures(provider,provider_id,season_id,home_team_id,away_team_id,kickoff_at,status,home_score,away_score,home_penalties,away_penalties,round,updated_at)
   values('api-football',(item->>'provider_id')::integer,sid,home,away,(item->>'kickoff_at')::timestamptz,item->>'status',(item->>'home_score')::integer,(item->>'away_score')::integer,(item->>'home_penalties')::integer,(item->>'away_penalties')::integer,item->>'round',t)
   on conflict(provider,provider_id) do update set kickoff_at=excluded.kickoff_at,status=excluded.status,home_score=excluded.home_score,away_score=excluded.away_score,home_penalties=excluded.home_penalties,away_penalties=excluded.away_penalties,round=excluded.round,home_team_id=excluded.home_team_id,away_team_id=excluded.away_team_id,updated_at=excluded.updated_at;
  end if;
 end loop;
 if results_changed then update public.sports_sync_tasks set next_run_at=least(next_run_at,t) where league_id=p_league and season=p_season and kind='standings';end if;
 if p_kind='standings' then
  delete from public.standings where season_id=sid;
  for item in select value from jsonb_array_elements(p_rows) loop
   select id into tid from public.teams where provider='api-football' and provider_id=(item->>'team_id')::integer;
   if tid is null then raise exception 'missing team';end if;
   insert into public.standings(season_id,team_id,group_name,rank,points,played,wins,draws,losses,updated_at)
   values(sid,tid,item->>'group_name',(item->>'rank')::integer,(item->>'points')::integer,(item->>'played')::integer,(item->>'wins')::integer,(item->>'draws')::integer,(item->>'losses')::integer,t);
  end loop;
 end if;
 insert into public.sports_data_freshness(season_id,resource,last_success_at) values(sid,p_kind,t)
 on conflict(season_id,resource) do update set last_success_at=t,state='available',last_attempt_at=t;
 update public.sports_competition_coverage set state=case when p_kind='fixtures' then 'available' else state end,last_success_at=t,last_error=null where provider_id=p_league and season=p_season;
end;$$;

-- Discovery commits catalogue + seasons + coverage + task creation together.
create function public.commit_sports_discovery(p_owner uuid,p_season integer,p_rows jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare item jsonb; cid uuid; sid uuid; lid integer; t timestamptz:=clock_timestamp(); kind text;
begin
 perform 1 from public.job_leases where name='sports' and owner=p_owner and expires_at>t for update;
 if not found then raise exception 'lease lost';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)<>3 then raise exception 'invalid discovery';end if;
 for item in select value from jsonb_array_elements(p_rows) loop
  lid:=(item->>'provider_id')::integer;
  insert into public.sports_competition_coverage(target,season,provider_id,provider_name,available_seasons,standings_available,state,last_checked_at)
  values(item->>'target',p_season,lid,item->>'name',array(select value::integer from jsonb_array_elements_text(item->'available_seasons')),coalesce((item->>'standings')::boolean,false),item->>'state',t)
  on conflict(target,season) do update set provider_id=excluded.provider_id,provider_name=excluded.provider_name,available_seasons=excluded.available_seasons,standings_available=excluded.standings_available,state=case when public.sports_competition_coverage.state='available' and excluded.state='advertised' then 'available' else excluded.state end,last_checked_at=t;
  if item->>'state'='advertised' then
   insert into public.competitions(provider,provider_id,name,type,country,updated_at) values('api-football',lid,item->>'name',item->>'type','Brazil',t)
   on conflict(provider,provider_id) do update set name=excluded.name,type=excluded.type,updated_at=t returning id into cid;
   insert into public.competition_seasons(competition_id,year,standings_available,updated_at) values(cid,p_season,(item->>'standings')::boolean,t)
   on conflict(competition_id,year) do update set standings_available=excluded.standings_available,updated_at=t returning id into sid;
   foreach kind in array array['teams','fixtures','standings'] loop
    if kind<>'standings' or (item->>'standings')::boolean then
     insert into public.sports_sync_tasks(task_key,kind,league_id,season,priority,next_run_at)
     values(lid||':'||p_season||':'||kind,kind,lid,p_season,case when kind='teams' then 2 else 1 end,t)
     on conflict(task_key) do nothing;
    end if;
   end loop;
  end if;
 end loop;
end;$$;

revoke all on function public.reserve_sports_request(uuid,text,text,jsonb,integer),public.settle_sports_request(uuid,jsonb),public.claim_sports_task(uuid,jsonb),public.finish_sports_task(uuid,uuid,text,integer),public.commit_sports_resource(uuid,text,integer,integer,jsonb),public.commit_sports_discovery(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_sports_request(uuid,text,text,jsonb,integer),public.settle_sports_request(uuid,jsonb),public.claim_sports_task(uuid,jsonb),public.finish_sports_task(uuid,uuid,text,integer),public.commit_sports_resource(uuid,text,integer,integer,jsonb),public.commit_sports_discovery(uuid,integer,jsonb) to service_role;

create function public.mark_sports_failure(p_owner uuid,p_league integer,p_season integer,p_resource text,p_state text) returns void
language plpgsql security invoker set search_path='' as $$
declare sid uuid;
begin
 perform 1 from public.job_leases where name='sports' and owner=p_owner and expires_at>clock_timestamp() for update;
 if not found then raise exception 'lease lost';end if;
 if p_state not in ('unavailable','unsupported') or (p_resource is not null and p_resource not in ('teams','fixtures','standings')) then raise exception 'invalid state';end if;
 if p_league is null then update public.sports_data_freshness set state=p_state,last_attempt_at=clock_timestamp();return;end if;
 select cs.id into sid from public.competition_seasons cs join public.competitions c on c.id=cs.competition_id where c.provider='api-football' and c.provider_id=p_league and cs.year=p_season;
 if sid is null then return;end if;
 insert into public.sports_data_freshness(season_id,resource,last_success_at,state) values(sid,p_resource,null,p_state)
 on conflict(season_id,resource) do update set state=excluded.state,last_attempt_at=clock_timestamp();
end;$$;
revoke all on function public.mark_sports_failure(uuid,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.mark_sports_failure(uuid,integer,integer,text,text) to service_role;

-- Existing valid rows retain their real, conservative update timestamps after migration.
insert into public.sports_data_freshness(season_id,resource,last_success_at)
select season_id,'fixtures',min(updated_at) from public.fixtures group by season_id on conflict do nothing;
insert into public.sports_data_freshness(season_id,resource,last_success_at)
select season_id,'standings',min(updated_at) from public.standings group by season_id on conflict do nothing;
