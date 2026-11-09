create function public.replace_standings(p_season uuid,p_rows jsonb) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>1000 then raise exception 'invalid standings';end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where (r->>'season_id')::uuid<>p_season) then raise exception 'invalid season';end if;
 delete from public.standings where season_id=p_season;
 insert into public.standings(season_id,team_id,group_name,rank,points,played,wins,draws,losses,updated_at)
 select season_id,team_id,group_name,rank,points,played,wins,draws,losses,updated_at from jsonb_populate_recordset(null::public.standings,p_rows);
end;$$;
revoke all on function public.replace_standings(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.replace_standings(uuid,jsonb) to service_role;
