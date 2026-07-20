-- ============================================================
-- FinTrack — schema Supabase (PostgreSQL + Auth + RLS)
-- Cole e execute no SQL Editor do Supabase (Dashboard → SQL).
-- ============================================================

-- Contas / dívidas recorrentes
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  due_day int not null check (due_day between 1 and 31),
  warning_days int not null default 3 check (warning_days between 0 and 30),
  history jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  is_recurring boolean not null default true,
  email_reminder_enabled boolean not null default true,
  amount_estimate numeric null,
  inserted_at timestamptz not null default now()
);

create index if not exists bills_user_id_idx on public.bills (user_id);

-- Metas de gasto
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric not null default 0,
  current_amount numeric not null default 0,
  month int not null check (month between 1 and 12),
  year int not null,
  inserted_at timestamptz not null default now()
);

create index if not exists goals_user_id_idx on public.goals (user_id);

-- Convites (código de 6 dígitos)
create table if not exists public.invitations (
  code text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  permission text not null check (permission in ('view', 'edit')),
  created_at bigint not null
);

create index if not exists invitations_owner_id_idx on public.invitations (owner_id);

-- Acesso de convidado → dono da conta
create table if not exists public.guest_access (
  guest_uid uuid primary key references auth.users (id) on delete cascade,
  code text not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  permission text not null check (permission in ('view', 'edit'))
);

-- ------------------------------------------------------------
-- Helper: ids que o usuário pode acessar (próprio + guest)
-- ------------------------------------------------------------
create or replace function public.accessible_owner_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid()
  union
  select owner_id from public.guest_access where guest_uid = auth.uid();
$$;

create or replace function public.can_edit_owner(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = owner
    or exists (
      select 1 from public.guest_access g
      where g.guest_uid = auth.uid()
        and g.owner_id = owner
        and g.permission = 'edit'
    );
$$;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.bills enable row level security;
alter table public.goals enable row level security;
alter table public.invitations enable row level security;
alter table public.guest_access enable row level security;

-- Bills
drop policy if exists "bills_select" on public.bills;
create policy "bills_select" on public.bills
  for select to authenticated
  using (user_id in (select public.accessible_owner_ids()));

drop policy if exists "bills_insert" on public.bills;
create policy "bills_insert" on public.bills
  for insert to authenticated
  with check (public.can_edit_owner(user_id));

drop policy if exists "bills_update" on public.bills;
create policy "bills_update" on public.bills
  for update to authenticated
  using (public.can_edit_owner(user_id))
  with check (public.can_edit_owner(user_id));

drop policy if exists "bills_delete" on public.bills;
create policy "bills_delete" on public.bills
  for delete to authenticated
  using (public.can_edit_owner(user_id));

-- Goals
drop policy if exists "goals_select" on public.goals;
create policy "goals_select" on public.goals
  for select to authenticated
  using (user_id in (select public.accessible_owner_ids()));

drop policy if exists "goals_insert" on public.goals;
create policy "goals_insert" on public.goals
  for insert to authenticated
  with check (public.can_edit_owner(user_id));

drop policy if exists "goals_update" on public.goals;
create policy "goals_update" on public.goals
  for update to authenticated
  using (public.can_edit_owner(user_id))
  with check (public.can_edit_owner(user_id));

drop policy if exists "goals_delete" on public.goals;
create policy "goals_delete" on public.goals
  for delete to authenticated
  using (public.can_edit_owner(user_id));

-- Invitations: apenas o dono lista/cria/apaga
drop policy if exists "invitations_select_owner" on public.invitations;
create policy "invitations_select_owner" on public.invitations
  for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists "invitations_insert" on public.invitations;
create policy "invitations_insert" on public.invitations
  for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "invitations_delete" on public.invitations;
create policy "invitations_delete" on public.invitations
  for delete to authenticated
  using (owner_id = auth.uid());

-- Guest access
drop policy if exists "guest_access_select" on public.guest_access;
create policy "guest_access_select" on public.guest_access
  for select to authenticated
  using (guest_uid = auth.uid() or owner_id = auth.uid());

drop policy if exists "guest_access_insert" on public.guest_access;
create policy "guest_access_insert" on public.guest_access
  for insert to authenticated
  with check (guest_uid = auth.uid());

drop policy if exists "guest_access_delete" on public.guest_access;
create policy "guest_access_delete" on public.guest_access
  for delete to authenticated
  using (guest_uid = auth.uid() or owner_id = auth.uid());

-- Resgata convite sem expor a tabela inteira (security definer)
create or replace function public.redeem_invitation(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into inv from public.invitations where code = p_code;
  if not found then
    raise exception 'invalid invitation code';
  end if;

  insert into public.guest_access (guest_uid, code, owner_id, permission)
  values (auth.uid(), inv.code, inv.owner_id, inv.permission)
  on conflict (guest_uid) do update
    set code = excluded.code,
        owner_id = excluded.owner_id,
        permission = excluded.permission;

  return json_build_object(
    'code', inv.code,
    'ownerId', inv.owner_id,
    'permission', inv.permission,
    'createdAt', inv.created_at
  );
end;
$$;

grant execute on function public.redeem_invitation(text) to authenticated;

-- Realtime (opcional — Database → Replication)
-- alter publication supabase_realtime add table public.bills;
-- alter publication supabase_realtime add table public.goals;
