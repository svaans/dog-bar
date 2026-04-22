-- Asignación “estoy atendiendo esta mesa” (varios nombres por mesa permitidos).
create table if not exists public.dog_bar_staff_mesa (
  mesa int not null,
  staff_name text not null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (mesa, staff_name)
);

create index if not exists dog_bar_staff_mesa_updated_at_idx
  on public.dog_bar_staff_mesa (updated_at desc);

create index if not exists dog_bar_staff_mesa_joined_at_idx
  on public.dog_bar_staff_mesa (joined_at desc);

comment on table public.dog_bar_staff_mesa is 'Personal que indica estar atendiendo una mesa (heartbeat vía upsert).';
