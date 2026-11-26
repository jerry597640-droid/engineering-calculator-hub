-- Staging: searchable account list and atomic individual tool grants.
-- Batch selection is a snapshot of explicit tool IDs, never a group rule.
create function ech_private.admin_search_users(search_text text,page_size integer,page_offset integer)
returns table(user_id uuid,email text,display_name text,role text,status text,expires_at timestamptz,created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
begin
  perform ech_private.assert_admin(false);
  if search_text is null or length(search_text)>254 or page_size is null or page_size<1 or page_size>100
     or page_offset is null or page_offset<0 or page_offset>100000
  then raise exception 'invalid search or pagination' using errcode='22023'; end if;
  return query select p.user_id,u.email::text,p.display_name,p.role,p.status,p.expires_at,p.created_at
    from public.ech_user_profiles p join auth.users u on u.id=p.user_id
    where pg_catalog.strpos(pg_catalog.lower(coalesce(u.email::text,'')),pg_catalog.lower(search_text))>0
       or pg_catalog.strpos(pg_catalog.lower(coalesce(p.display_name,'')),pg_catalog.lower(search_text))>0
    order by p.created_at desc,p.user_id limit page_size offset page_offset;
end $$;

create function ech_private.admin_set_permissions(target uuid,requested_tools text[],new_allowed boolean,new_valid_until timestamptz)
returns integer language plpgsql security definer set search_path = ''
as $$
declare tool text; item_count integer; unique_count integer;
begin
  perform ech_private.assert_admin(false);
  if target is null or requested_tools is null or new_allowed is null
     or coalesce(array_ndims(requested_tools),0)<>1
     or cardinality(requested_tools)<1 or cardinality(requested_tools)>100
  then raise exception 'invalid batch' using errcode='22023'; end if;
  select count(*),count(distinct x) into item_count,unique_count
    from unnest(requested_tools) as x;
  if item_count<>unique_count or exists(
      select 1 from unnest(requested_tools) as x
      where x is null or x !~ '^[a-z0-9][a-z0-9-]{0,79}$')
  then raise exception 'invalid batch' using errcode='22023'; end if;
  for tool in select x from unnest(requested_tools) as x order by x loop
    -- This existing function checks the target and actor, applies one explicit
    -- permission and writes its audit row. Any failure rolls back the batch.
    perform ech_private.admin_set_permission(target,tool,new_allowed,null,new_valid_until);
  end loop;
  return item_count;
end $$;

revoke all on function ech_private.admin_search_users(text,integer,integer),
  ech_private.admin_set_permissions(uuid,text[],boolean,timestamptz) from public,anon,authenticated;
grant execute on function ech_private.admin_search_users(text,integer,integer),
  ech_private.admin_set_permissions(uuid,text[],boolean,timestamptz) to authenticated;

create function public.ech_admin_search_users(search_text text,page_size integer default 50,page_offset integer default 0)
returns table(user_id uuid,email text,display_name text,role text,status text,expires_at timestamptz,created_at timestamptz)
language sql security invoker set search_path = ''
as $$ select * from ech_private.admin_search_users(search_text,page_size,page_offset) $$;
create function public.ech_admin_set_permissions(target uuid,requested_tools text[],new_allowed boolean,new_valid_until timestamptz)
returns integer language sql security invoker set search_path = ''
as $$ select ech_private.admin_set_permissions(target,requested_tools,new_allowed,new_valid_until) $$;
revoke all on function public.ech_admin_search_users(text,integer,integer),
  public.ech_admin_set_permissions(uuid,text[],boolean,timestamptz) from public,anon,authenticated;
grant execute on function public.ech_admin_search_users(text,integer,integer),
  public.ech_admin_set_permissions(uuid,text[],boolean,timestamptz) to authenticated;
