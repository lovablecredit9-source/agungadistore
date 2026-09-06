-- Role system for admin gating (SUPER_ADMIN)
create type if not exists public.app_role as enum ('super_admin', 'admin', 'moderator', 'user');

create table if not exists public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role public.app_role not null,
    unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy if not exists "Users can read own roles"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

create policy if not exists "Service role can manage roles"
on public.user_roles
for all
to service_role
using (true) with check (true);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

-- Grant the existing store admin SUPER_ADMIN access
insert into public.user_roles (user_id, role)
select id, 'super_admin'::public.app_role
from auth.users
where email = 'kelinganmantannnn@gmail.com'
on conflict (user_id, role) do nothing;
