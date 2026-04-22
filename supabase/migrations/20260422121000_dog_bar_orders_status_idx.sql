-- Acelera el listado de pedidos activos (filtro por estado dentro de jsonb).
-- Opcional: si ya tenías datos, el índice se crea en segundo plano al ejecutar el SQL.

create index if not exists dog_bar_orders_payload_status_idx
  on public.dog_bar_orders ((payload->>'status'));
