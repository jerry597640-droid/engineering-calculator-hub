-- Staging schema: no public access; new tools and accounts default to denied.
-- Project: engineering-tools-access-staging
create schema ech_private;
revoke all on schema ech_private from public, anon, authenticated;

create table public.ech_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or length(display_name) between 1 and 160),
  role text not null default 'user' check (role in ('owner','admin','user')),
  status text not null default 'pending' check (status in ('pending','approved','disabled')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ech_tools (
  tool_id text primary key check (tool_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  name text not null check (length(name) between 1 and 200),
  enabled boolean not null default false,
  asset_prefix text unique,
  created_at timestamptz not null default now(),
  check (not enabled or asset_prefix is not null)
);
create table public.ech_tool_permissions (
  user_id uuid not null references public.ech_user_profiles(user_id) on delete cascade,
  tool_id text not null references public.ech_tools(tool_id) on delete restrict,
  allowed boolean not null default false,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tool_id),
  check (valid_until is null or valid_until > valid_from)
);
create index ech_tool_permissions_tool_id_idx on public.ech_tool_permissions(tool_id);
create table public.ech_admin_audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (length(action) between 1 and 120),
  target_user_id uuid,
  target_tool_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index ech_admin_audit_created_at_idx on public.ech_admin_audit(created_at desc);

alter table public.ech_user_profiles enable row level security;
alter table public.ech_tools enable row level security;
alter table public.ech_tool_permissions enable row level security;
alter table public.ech_admin_audit enable row level security;
revoke all on table public.ech_user_profiles, public.ech_tools, public.ech_tool_permissions, public.ech_admin_audit from public, anon, authenticated;
revoke all on sequence public.ech_admin_audit_id_seq from public, anon, authenticated;

-- Signed-in users may only inspect their own profile and own tool permissions.
create policy ech_profiles_read_self on public.ech_user_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy ech_permissions_read_self on public.ech_tool_permissions for select to authenticated using ((select auth.uid()) = user_id);
grant select on public.ech_user_profiles, public.ech_tool_permissions to authenticated;

-- Tool existence is visible only when the caller is active and individually authorized.
create policy ech_tools_read_authorized on public.ech_tools for select to authenticated
using (
  enabled and exists (
    select 1 from public.ech_tool_permissions g
    join public.ech_user_profiles p on p.user_id = g.user_id
    where g.tool_id = ech_tools.tool_id and g.user_id = (select auth.uid())
      and p.status = 'approved' and (p.expires_at is null or p.expires_at > now())
      and g.allowed and g.valid_from <= now() and (g.valid_until is null or g.valid_until > now())
  )
);
grant select on public.ech_tools to authenticated;

create function public.ech_has_tool_access(requested_tool_id text)
returns boolean language sql stable security invoker set search_path = ''
as $$ select exists (select 1 from public.ech_tools t where t.tool_id = requested_tool_id) $$;
revoke all on function public.ech_has_tool_access(text) from public, anon, authenticated;
grant execute on function public.ech_has_tool_access(text) to authenticated;

-- New signups always start pending, without tool permissions or a privileged role.
create function ech_private.create_pending_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.ech_user_profiles(user_id) values (new.id);
  return new;
end;
$$;
revoke all on function ech_private.create_pending_profile() from public, anon, authenticated;
create trigger ech_create_pending_profile after insert on auth.users
for each row execute function ech_private.create_pending_profile();

-- Limit execution of Supabase's existing event-trigger function to privileged owners.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Catalog copied from the existing hub; all tools remain disabled until migrated and verified.
insert into public.ech_tools(tool_id, name) values
  ('rebar', '鋼筋與鋼線網互換'),
  ('seismic', '地震力分析'),
  ('formwork', '模板支撐分析'),
  ('aluminum-formwork', '鋁模板設計檢核'),
  ('rc-slab-auto-design', 'RC 樓板配筋自動設計與分析工作平台'),
  ('rc-beam-auto-design', 'RC 梁配筋自動設計與分析工作平台'),
  ('rc-beam', 'RC 梁分析設計'),
  ('slab-analysis', '樓板分析設計'),
  ('wind', '建築風力分析'),
  ('scaffold', '施工鷹架分析設計'),
  ('steel', '鋼柱分析設計'),
  ('retaining-wall', '擋土牆分析設計'),
  ('steel-beam', '鋼梁分析設計'),
  ('welding', '焊接分析設計'),
  ('rebar-revision', '梁筋修正分析'),
  ('cfrp', 'CFRP 碳纖維補強'),
  ('steel-sheet-pile', '鋼板樁分析設計'),
  ('pile', '基樁分析設計'),
  ('ground-anchorage', '地錨設計分析'),
  ('isolated-footing', '獨立基礎分析設計'),
  ('combined-footing', '聯合基礎分析設計'),
  ('rebar-embedment-private', '植筋深度計算器'),
  ('rebar-development', '鋼筋搭接、伸展與錨定'),
  ('crane-outrigger', '吊車支腿反力'),
  ('unit-converter', '工程單位換算'),
  ('concrete-anchor', '混凝土錨栓設計與檢核'),
  ('rc-column', 'RC 柱配筋設計與檢核'),
  ('rc-column-biaxial', 'RC 柱配筋與雙軸向彎矩互制分析'),
  ('shear-friction', '剪力摩擦設計分析'),
  ('src-beam', 'SRC 鋼骨鋼筋梁分析設計'),
  ('rc-slab-shear', 'RC 樓版剪力檢核'),
  ('rc-wall', 'RC 牆與剪力牆設計檢核'),
  ('footing-design', '基腳設計檢核'),
  ('rc-corbel', 'RC 托架與梁托設計檢核'),
  ('src-beam-column', 'SRC 梁柱構材分析設計'),
  ('concrete-strength', '混凝土強度發展'),
  ('steel-sections', '台灣型鋼斷面資料庫'),
  ('slope-stability', '邊坡穩定分析工作台'),
  ('beam-analysis', '梁受力分析工作台'),
  ('beam-dynamics', '多跨梁・移動與動力分析'),
  ('steel-beam-holes', '鋼梁開孔彎矩與剪力'),
  ('pdf-toolbox', 'PDF 分割・合併・壓縮');

