-- Pedidos Meraki / dog-bar: un documento JSON por fila (misma forma que SQLite local).
-- Ejecuta esto en el SQL Editor de Supabase si no usas la CLI de migraciones.

create table if not exists public.dog_bar_orders (
  id text primary key,
  payload jsonb not null
);

comment on table public.dog_bar_orders is 'Pedidos de la app; payload = objeto Order completo.';
