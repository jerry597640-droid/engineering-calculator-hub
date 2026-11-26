-- Synthetic authorization checks; every fixture is rolled back.
begin;
insert into auth.users (id,email,aud,role) values
 ('00000000-0000-4000-8000-000000000001','ech-a@example.invalid','authenticated','authenticated'),
 ('00000000-0000-4000-8000-000000000002','ech-b@example.invalid','authenticated','authenticated');
do $$
begin
 if (select count(*) from public.ech_user_profiles where user_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002') and status='pending' and role='user') <> 2 then raise exception 'new-user defaults failed'; end if;
 if has_function_privilege('anon','public.ech_has_tool_access(text)','execute') then raise exception 'anonymous can execute authorization function'; end if;
 if has_table_privilege('authenticated','public.ech_user_profiles','update') then raise exception 'client can update own role'; end if;
end $$;
update public.ech_user_profiles set status='approved' where user_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
update public.ech_tools set enabled=true, asset_prefix='/tools/rc-beam/' where tool_id='rc-beam';
insert into public.ech_tool_permissions(user_id,tool_id,allowed) values('00000000-0000-4000-8000-000000000001','rc-beam',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$
begin
 if not public.ech_has_tool_access('rc-beam') then raise exception 'authorized tool denied'; end if;
 if public.ech_has_tool_access('rc-column') then raise exception 'ungranted tool allowed'; end if;
 if (select count(*) from public.ech_user_profiles) <> 1 then raise exception 'cross-user profile visibility'; end if;
 begin
   update public.ech_user_profiles set role='owner' where user_id=(select auth.uid());
   raise exception 'unauthorized self escalation succeeded';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin if public.ech_has_tool_access('rc-beam') then raise exception 'other user received access'; end if; end $$;
reset role;
update public.ech_user_profiles set status='disabled' where user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin if public.ech_has_tool_access('rc-beam') then raise exception 'disabled user received access'; end if; end $$;
reset role;
update public.ech_user_profiles set status='approved' where user_id='00000000-0000-4000-8000-000000000001';
update public.ech_tool_permissions set valid_from=now()-interval '2 days', valid_until=now()-interval '1 day' where user_id='00000000-0000-4000-8000-000000000001' and tool_id='rc-beam';
set local role authenticated;
do $$ begin if public.ech_has_tool_access('rc-beam') then raise exception 'expired grant received access'; end if; end $$;
select set_config('request.jwt.claims','{}',true);
do $$ begin if public.ech_has_tool_access('rc-beam') then raise exception 'missing identity received access'; end if; end $$;
reset role;
rollback;
select 'PASS: synthetic authorization fixtures rolled back' as result;


