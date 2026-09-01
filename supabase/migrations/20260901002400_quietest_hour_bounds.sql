-- "Best time today" was recommending 10 pm, which is closing time.
--
-- The first version bounded the search to a hardcoded 5–22, so the quietest
-- hour was often the last hour of the day — technically true (almost nobody
-- checks in at 21:5x) and useless advice, because the gym shuts.
--
-- Now the window comes from the gym's own weekly_hours for that weekday, and
-- the final hour before closing is excluded: telling someone to arrive at
-- 9 pm when the doors shut at 10 is not a useful suggestion either.

create or replace function public.quietest_hour(p_gym_id uuid, p_weekday integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_day_key  text;
  v_hours    jsonb;
  v_open_hr  integer;
  v_close_hr integer;
  v_result   jsonb;
begin
  v_day_key := (array['mon','tue','wed','thu','fri','sat','sun'])[p_weekday];
  if v_day_key is null then
    return null;
  end if;

  select g.weekly_hours -> v_day_key into v_hours
  from public.gyms g
  where g.id = p_gym_id;

  -- Closed today, or no schedule recorded: nothing honest to say.
  if v_hours is null or jsonb_typeof(v_hours) <> 'object' then
    return null;
  end if;

  v_open_hr  := split_part(v_hours ->> 'open', ':', 1)::int;
  -- Exclude the last hour: "come at 9" when closing is 10 is not advice.
  v_close_hr := split_part(v_hours ->> 'close', ':', 1)::int - 1;

  if v_close_hr <= v_open_hr then
    return null;
  end if;

  with hourly as (
    select
      extract(hour from (a.checked_in_at at time zone 'Asia/Kolkata'))::int as hr,
      count(*) as visits,
      count(distinct (a.checked_in_at at time zone 'Asia/Kolkata')::date) as days
    from public.attendance a
    where a.gym_id = p_gym_id
      and extract(isodow from (a.checked_in_at at time zone 'Asia/Kolkata'))::int = p_weekday
      and a.checked_in_at > now() - interval '120 days'
    group by 1
  ),
  ranked as (
    select hr, visits::numeric / greatest(days, 1) as avg_per_day
    from hourly
    where hr between v_open_hr and v_close_hr
      -- Enough history that the average means something.
      and days >= 2
  )
  select case
    when (select count(*) from ranked) < 3 then null
    else (
      select jsonb_build_object('hour', hr, 'avg_per_day', round(avg_per_day, 1))
      from ranked
      order by avg_per_day asc, hr asc
      limit 1
    )
  end
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.quietest_hour(uuid, integer) to authenticated;
