-- Synthetic identities and writes exist only inside this rolled-back transaction.
begin;
insert into auth.users(id,email,aud,role) values
 ('00000000-0000-4000-8000-000000000301','echbatch-owner@example.invalid','authenticated','authenticated'),
 ('00000000-0000-4000-8000-000000000302','echbatch-user@example.invalid','authenticated','authenticated');
update public.ech_user_profiles set status='approved',role=case user_id
 when '00000000-0000-4000-8000-000000000301' then 'owner' else 'user' end
where user_id in ('00000000-0000-4000-8000-000000000301','00000000-0000-4000-8000-000000000302');
insert into auth.sessions(id,user_id,aal) values
 ('00000000-0000-4000-8000-000000000311','00000000-0000-4000-8000-000000000301','aal2'),
 ('00000000-0000-4000-8000-000000000312','00000000-0000-4000-8000-000000000302','aal2');
insert into public.ech_tools(tool_id,name) values('ech-batch-new','Batch test new tool');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated","aal":"aal2","session_id":"00000000-0000-4000-8000-000000000311"}',true);
do $$
declare target constant uuid := '00000000-0000-4000-8000-000000000302';
begin
 if (select count(*) from public.ech_admin_search_users('ECHBATCH-',100,0) where user_id in
    ('00000000-0000-4000-8000-000000000301',target))<>2 then raise exception 'search failed'; end if;
 if (select count(*) from public.ech_admin_search_users('echbatch-%',100,0))<>0 then raise exception 'search wildcard bypass'; end if;
 if public.ech_admin_set_permissions(target,array['rc-beam','wind'],true,null)<>2 then raise exception 'batch count failed'; end if;
 if (select count(*) from public.ech_admin_permissions(target) where tool_id in ('rc-beam','wind') and allowed)<>2
 then raise exception 'batch grants failed'; end if;
 if exists(select 1 from public.ech_admin_permissions(target) where tool_id='ech-batch-new' and allowed)
 then raise exception 'new tool inherited permission'; end if;
 if (select count(*) from public.ech_admin_audit(100,0) where target_user_id=target and action='set_permission')<>2
 then raise exception 'individual audit rows missing'; end if;
 begin
   perform public.ech_admin_set_permissions(target,array['rc-beam','zz-missing-tool'],false,null);
   raise exception 'unknown tool accepted';
 exception when invalid_parameter_value then null; end;
 if not exists(select 1 from public.ech_admin_permissions(target) where tool_id='rc-beam' and allowed)
 then raise exception 'failed batch was not rolled back'; end if;
 begin
   perform public.ech_admin_set_permissions(target,array['wind','wind'],false,null);
   raise exception 'duplicate tool accepted';
 exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000302","role":"authenticated","aal":"aal2","session_id":"00000000-0000-4000-8000-000000000312"}',true);
do $$ begin
 begin perform * from public.ech_admin_search_users('echbatch',10,0);raise exception 'ordinary user searched accounts';
 exception when insufficient_privilege then null; end;
 begin perform public.ech_admin_set_permissions('00000000-0000-4000-8000-000000000302',array['rc-beam'],true,null);
 raise exception 'ordinary user changed permissions'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000301","role":"authenticated","aal":"aal1","session_id":"00000000-0000-4000-8000-000000000311"}',true);
do $$ begin
 begin perform * from public.ech_admin_search_users('echbatch',10,0);raise exception 'owner without MFA searched accounts';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: search and atomic batch fixtures rolled back' as result;
