# Despliegue en Render (producción)

## 1. Crear el Web Service

1. **New +** → **Web Service** → conecta el repo de GitHub/GitLab.
2. **Runtime:** Node  
3. **Build command:** `npm ci && npm run build`  
4. **Start command:** `npm run start`  
5. **Instance type:** la que prefieras (Starter va bien para una demo).

Render asigna `PORT` automáticamente; Next.js lo usa en `npm start`.

## 2. Variables de entorno (obligatorias para una demo seria)

| Variable | Descripción |
|----------|-------------|
| `NODE_ENV` | `production` (Render suele ponerla sola). |
| `STAFF_ORDER_KEY` | **Obligatoria en producción:** clave larga y secreta. El personal y el admin de carta la pegan en el navegador. Sin ella, las rutas protegidas responden 401. |
| `NEXT_PUBLIC_APP_URL` | URL pública `https://tu-app.onrender.com` (sin barra final). Sirve para metadatos y QRs cuando no basta el host de la petición. |

Opcional: `RESTAURANT_TZ` (por defecto `Europe/Madrid`).

## 3. Dónde se guardan los pedidos

- **Sin configurar `ORDER_STORAGE`:** archivo `data/orders.json` en el disco del contenedor. **Se pierde al redeploy** salvo que montes un **Persistent Disk** en Render apuntando a la carpeta `data` del proyecto.
- **Recomendado en Render sin disco:** `ORDER_STORAGE=supabase` + `SUPABASE_URL` (o `NEXT_PUBLIC_SUPABASE_URL`) + `SUPABASE_SERVICE_ROLE_KEY`. Ejecuta el SQL de `supabase/migrations/` en el panel de Supabase.
- **SQLite:** `ORDER_STORAGE=sqlite` + disco persistente recomendado; opcional `SQLITE_PATH`.

## 4. Carta (`data/menu.json`)

La carpeta `data/` no va en git. La carta por defecto sale del código embebido; al **guardar desde el admin** se crea `data/menu.json` en el servidor (otra vez: **ephemeral** sin disco o sin Supabase solo para pedidos).

## 5. Tras el primer deploy

1. Abre la URL de Render.
2. Configura `NEXT_PUBLIC_APP_URL` si los QRs o enlaces no coinciden con el dominio.
3. Entra en **Personal**, pega `STAFF_ORDER_KEY` y comprueba pedidos.
4. Prueba **mesa 1** y un pedido de prueba.

## 6. `render.yaml`

En la raíz hay un blueprint de ejemplo; puedes **Import Blueprint** en Render o crear el servicio a mano con los mismos comandos.
