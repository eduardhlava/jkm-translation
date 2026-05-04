-- Roles enum and table
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- Profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  email text not null,
  is_active boolean not null default true,
  target_languages text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- has_role security definer
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- updated_at trigger fn
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

-- Auto-create profile + default user role on new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email)
  values (new.id, new.email)
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Protect eduard@hlava.net: cannot be deactivated
create or replace function public.protect_super_admin_profile()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.email = 'eduard@hlava.net' and new.is_active = false then
    raise exception 'Hlavního administrátora nelze deaktivovat';
  end if;
  return new;
end;
$$;

create trigger protect_super_admin_profile_trg
before update on public.profiles
for each row execute function public.protect_super_admin_profile();

-- Protect eduard@hlava.net: cannot lose admin role
create or replace function public.protect_super_admin_role()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  _email text;
begin
  if tg_op = 'DELETE' and old.role = 'admin' then
    select email into _email from auth.users where id = old.user_id;
    if _email = 'eduard@hlava.net' then
      raise exception 'Hlavnímu administrátorovi nelze odebrat administrátorská práva';
    end if;
  end if;
  return old;
end;
$$;

create trigger protect_super_admin_role_trg
before delete on public.user_roles
for each row execute function public.protect_super_admin_role();

-- RLS: profiles
create policy "Users can view their own profile"
on public.profiles for select
to authenticated
using (auth.uid() = user_id);

create policy "Admins can view all profiles"
on public.profiles for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update profiles"
on public.profiles for update
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can insert profiles"
on public.profiles for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete profiles"
on public.profiles for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- RLS: user_roles
create policy "Users can view their own roles"
on public.user_roles for select
to authenticated
using (auth.uid() = user_id);

create policy "Admins can view all roles"
on public.user_roles for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can manage roles"
on public.user_roles for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));
