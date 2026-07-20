-- ============================================================
-- FinTrack — correção / upgrade do sistema de convites
-- Rode no SQL Editor do Supabase (projeto mycontas)
-- ============================================================

-- Colunas extras em invitations (não expira sozinho; dono remove)
alter table public.invitations
  add column if not exists label text null,
  add column if not exists active boolean not null default true,
  add column if not exists max_uses int null,
  add column if not exists use_count int not null default 0;

-- guest_access: metadados
alter table public.guest_access
  add column if not exists joined_at timestamptz not null default now(),
  add column if not exists guest_email text null,
  add column if not exists guest_name text null;

create index if not exists guest_access_owner_id_idx on public.guest_access (owner_id);

-- Helpers (recriar)
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

-- Resgata convite: vários convidados no mesmo código (reutilizável)
create or replace function public.redeem_invitation(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.invitations%rowtype;
  clean_code text;
  v_email text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  clean_code := trim(p_code);

  if clean_code is null or length(clean_code) < 4 then
    raise exception 'invalid invitation code';
  end if;

  select * into inv
  from public.invitations
  where code = clean_code
  for update;

  if not found then
    raise exception 'invalid invitation code';
  end if;

  if inv.active is false then
    raise exception 'invitation inactive';
  end if;

  if inv.max_uses is not null and inv.use_count >= inv.max_uses then
    raise exception 'invitation max uses reached';
  end if;

  -- não permitir que o dono "entre" como convidado de si mesmo
  if inv.owner_id = auth.uid() then
    raise exception 'cannot redeem own invitation';
  end if;

  select email, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email)
    into v_email, v_name
  from auth.users
  where id = auth.uid();

  insert into public.guest_access (guest_uid, code, owner_id, permission, guest_email, guest_name, joined_at)
  values (auth.uid(), inv.code, inv.owner_id, inv.permission, v_email, v_name, now())
  on conflict (guest_uid) do update
    set code = excluded.code,
        owner_id = excluded.owner_id,
        permission = excluded.permission,
        guest_email = excluded.guest_email,
        guest_name = excluded.guest_name,
        joined_at = now();

  update public.invitations
  set use_count = coalesce(use_count, 0) + 1
  where code = inv.code;

  return json_build_object(
    'code', inv.code,
    'ownerId', inv.owner_id,
    'permission', inv.permission,
    'createdAt', inv.created_at
  );
end;
$$;

grant execute on function public.redeem_invitation(text) to authenticated;
grant execute on function public.redeem_invitation(text) to anon;
grant execute on function public.redeem_invitation(text) to service_role;

-- Lista convidados do dono
create or replace function public.list_my_guests()
returns table (
  guest_uid uuid,
  permission text,
  code text,
  guest_email text,
  guest_name text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select g.guest_uid, g.permission, g.code, g.guest_email, g.guest_name, g.joined_at
  from public.guest_access g
  where g.owner_id = auth.uid()
  order by g.joined_at desc nulls last;
$$;

grant execute on function public.list_my_guests() to authenticated;

-- Dono remove acesso de um convidado
create or replace function public.revoke_guest(p_guest_uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from public.guest_access
  where guest_uid = p_guest_uid
    and owner_id = auth.uid();
end;
$$;

grant execute on function public.revoke_guest(uuid) to authenticated;

-- Políticas guest_access (garantir)
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

drop policy if exists "guest_access_update" on public.guest_access;
create policy "guest_access_update" on public.guest_access
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
