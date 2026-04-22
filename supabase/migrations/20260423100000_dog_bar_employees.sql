create table if not exists public.dog_bar_employees (
  id uuid primary key default gen_random_uuid(),
  employee_number int not null unique check (employee_number >= 1 and employee_number <= 999),
  display_name text not null check (char_length(display_name) between 1 and 80),
  pin_hash text not null check (char_length(pin_hash) between 8 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists dog_bar_employees_active_idx
  on public.dog_bar_employees (active)
  where active = true;
