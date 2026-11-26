-- All test identities and changes are transaction-scoped and rolled back.
begin;
insert into auth.users(id,email,aud,role) values
 ('00000000-0000-4000-8000-000000000101','ech-owner@example.invalid','authenticated','authenticated'),
 ('00000000-0000-4000-8000-000000000102','ech-admin@example.invalid','authenticated','authenticated'),
 ('00000000-0000-4000-8000-000000000103','ech-user@example.invalid','authenticated','authenticated'),
 ('00000000-0000-4000-8000-000000000104','ech-pending@example.invalid','authenticated','authenticated');
update public.ech_user_profiles set status='approved',role=case user_id
 when '00000000-0000-4000-8000-000000000101' then 'owner'
 when '00000000-0000-4000-8000-000000000102' then 'admin'
 else 'user' end
where user_id in ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000103');
insert into auth.sessions(id,user_id,aal) values
 ('00000000-0000-4000-8000-000000000201','00000000-0000-4000-8000-000000000101','aal2'),
 ('00000000-0000-4000-8000-000000000202','00000000-0000-4000-8000-000000000102','aal2'),
 ('00000000-0000-4000-8000-000000000203','00000000-0000-4000-8000-000000000103','aal2');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated","aal":"aal2","session_id":"00000000-0000-4000-8000-000000000201"}',true);
do $$ begin
 if (select count(*) from public.ech_admin_users(100,0) where user_id in ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000104')) <> 4 then raise exception 'owner list failed'; end if;
 perform public.ech_admin_set_status('00000000-0000-4000-8000-000000000104','approved',null);
 perform public.ech_admin_set_permission('00000000-0000-4000-8000-000000000104','rc-beam',true,null,null);
 if not exists(select 1 from public.ech_admin_permissions('00000000-0000-4000-8000-000000000104') where tool_id='rc-beam' and allowed) then raise exception 'owner grant failed'; end if;
 if (select count(*) from public.ech_admin_audit(100,0)) <> 2 then raise exception 'audit rows missing'; end if;
 begin perform public.ech_admin_set_role('00000000-0000-4000-8000-000000000101','user'); raise exception 'self-demotion allowed'; exception when invalid_parameter_value then null; end;
 begin perform * from public.ech_admin_users(101,0); raise exception 'pagination limit bypass'; exception when invalid_parameter_value then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated","aal":"aal2","session_id":"00000000-0000-4000-8000-000000000202"}',true);
do $$ begin
 perform public.ech_admin_set_status('00000000-0000-4000-8000-000000000104','disabled',null);
 begin perform public.ech_admin_set_role('00000000-0000-4000-8000-000000000104','admin'); raise exception 'admin role escalation allowed'; exception when insufficient_privilege then null; end;
 begin perform public.ech_admin_set_permission('00000000-0000-4000-8000-000000000101','rc-beam',true,null,null); raise exception 'admin changed owner grant'; exception when insufficient_privilege then null; end;
 begin perform * from public.ech_admin_audit(10,0); raise exception 'admin read owner audit'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000103","role":"authenticated","aal":"aal2","session_id":"00000000-0000-4000-8000-000000000203"}',true);
do $$ begin
 begin perform * from public.ech_admin_users(10,0); raise exception 'ordinary user saw all users'; exception when insufficient_privilege then null; end;
 begin perform public.ech_admin_set_permission('00000000-0000-4000-8000-000000000103','rc-beam',true,null,null); raise exception 'ordinary user granted access'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated","aal":"aal1","session_id":"00000000-0000-4000-8000-000000000201"}',true);
do $$ begin
 begin perform * from public.ech_admin_users(10,0); raise exception 'owner without MFA allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from auth.sessions where id='00000000-0000-4000-8000-000000000201';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated","aal":"aal2","session_id":"00000000-0000-4000-8000-000000000201"}',true);
do $$ begin
 begin perform * from public.ech_admin_users(10,0); raise exception 'revoked owner session allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: administrative fixtures rolled back' as result;

