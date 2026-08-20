# Trabajos programados (`/api/cron`)

**F4.** Los cálculos derivados (precio en ₲, cuota cacheada) y el reintento de
leads necesitan correr solos. La decisión (PLAN.md, Decisions Log) es **una ruta
protegida golpeada por un pinger externo**, no un cron por slot de Hostinger:
los slots dan pocas entradas de cron, no muestran si corrieron, y no sobreviven
a un cambio de plan. Una URL con un secreto sí deja rastro en el log del pinger.

## El endpoint

```
GET|POST https://camiones.com.py/api/cron?job=all
Authorization: Bearer $CRON_SECRET
```

El secreto también se acepta como `?token=…` para pingers que no permiten
headers. `job` puede ser:

| `job` | Qué hace |
|---|---|
| `all` (por defecto) | Todo lo de abajo |
| `cuotas` | Recalcula `price_gs` (US$ × cotización vigente) y `cuota_gs` |
| `leads` | Barrido de reintento de leads — **hoy es un no-op**, ver abajo |
| `analytics` | Consolida `analytics_events` → `analytics_daily` y purga eventos crudos de más de 90 días |

Respuestas:

| Código | Significado |
|---|---|
| `200` | Corrió. El JSON trae qué cambió y una lista de `notes` con avisos. |
| `400` | `job` desconocido. |
| `401` | Secreto ausente o inválido. Cuerpo vacío a propósito. |
| `500` | El trabajo falló — que salte la alerta del pinger. |
| `503` | `CRON_SECRET` sin definir (o de menos de 16 caracteres). |

`503` es deliberado: un endpoint de trabajos sin protección en un host público
no es un default aceptable, así que sin secreto la ruta **no hace nada**.

## Configurar el pinger

1. Generá el secreto y cargalo en hPanel → Node.js → Environment variables:
   ```
   CRON_SECRET=$(openssl rand -base64 32)
   ```
   Reiniciá la app para que lo tome.
2. Verificá a mano (debería devolver `{"ok":true,...}`):
   ```
   curl -s -H "Authorization: Bearer $CRON_SECRET" \
     https://camiones.com.py/api/cron?job=all
   ```
   Sin el header tiene que dar `401`.
3. Apuntá un pinger gratuito (cron-job.org, UptimeRobot con método POST,
   Cloudflare Worker con Cron Trigger, GitHub *no* — cero minutos de Actions) a
   esa URL, **una vez por día** a las 06:00 -03. Configurá el header de
   autorización ahí y activá la alerta por fallo.

Una corrida diaria alcanza: la cotización la cargás a mano en
`/admin/cotizacion`, y esa pantalla ya recalcula todo en el momento. El cron es
la red de seguridad, no el camino principal.

Para las estadísticas sí es el camino principal: `/admin/analytics` lee sólo la
tabla consolidada, así que **sin el cron el panel se queda vacío**. Corré
`job=all` una vez por día y listo.

## Correrlo a mano

```
npm run cron:cuotas               # dinero (precios en ₲ + cuotas)
npm run analytics:rollup          # estadísticas, últimos 2 días
npm run analytics:rollup -- 30    # reconsolidar 30 días
```

Es un CLI finito sobre `recomputeMoney()` (`src/lib/jobs/money.ts`) — la misma
función que ejecuta la ruta, así que una corrida manual y una programada no
pueden divergir. `tsx` no carga `.env`: exportá `DATABASE_URL` primero.

## El barrido de leads todavía no hace nada

`sweepLeads()` devuelve un resultado vacío con un `skipped` explicando por qué:
la tabla `leads` (write-ahead log) es el hallazgo **F1**, que pertenece al
Batch 1 y todavía no aterrizó. Los leads siguen siendo fire-and-forget en
`src/lib/crm.ts`. La costura existe para que conectar F1 sea cambiar el cuerpo
de una función, sin tocar el contrato del cron, la ruta ni la autorización.
