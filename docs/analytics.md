# Analítica propia

Decisión bloqueada (PLAN.md, Decisions Log): **nada de analítica de terceros**
al lanzar. Ni Google, ni Plausible, ni un `<script>` externo. Además de la
razón de privacidad, es la decisión barata: cero bytes extra de JavaScript en
un Android con datos prepagos.

## Qué se mide

Tres eventos, en `analytics_events`:

| Evento | Dónde se dispara |
|---|---|
| `page_view` | `/camion/[slug]` y `/vendedor/[slug]` |
| `wa_click` | `/wa/[publicId]`, el salto que registra el clic y después redirige a `wa.me` |
| `lead` | Formulario de consulta enviado con éxito |

**`/venta` no se mide a propósito.** Registrar cada scroll de una grilla es la
mitad cara y de poco valor del pageview tracking sobre MySQL compartido; lo que
decide algo es qué aviso se mira y desde qué aviso escriben.

**El clic a WhatsApp es la métrica de conversión real**, no las visitas. El
panel ordena los avisos por clics justamente por eso: un aviso con 40 visitas y
0 clics tiene un problema de precio o de fotos, no de tráfico. Y "X contactos
este mes" es todo el argumento de venta frente a un concesionario.

## Qué NO se guarda

Sin cookies, sin identificador de usuario, sin IP almacenada. `visitor_hash` es
un hash de IP + user-agent con **sal que rota todos los días**: sirve para que
diez refrescos de la misma persona cuenten como una sola visita y para nada
más — no es comparable de un día al otro y no identifica a nadie. Del referrer
se guarda sólo el **host** (`google.com`), nunca la URL completa. Un filtro
barato de user-agent descarta los bots obvios.

## Por qué es barato

- `recordEvent()` no bloquea la respuesta: empuja a un buffer en memoria y
  vuelve.
- El buffer se vacía en **un solo INSERT multi-fila** al llegar a 25 eventos o
  a los 5 segundos. Un minuto movido cuesta un par de inserts, no cientos.
- Nada lee `analytics_events` por request. `/admin/analytics` lee
  `analytics_daily`, que llena el rollup nocturno.
- Los eventos crudos se purgan a los 90 días; la tabla diaria queda para
  siempre.

**Contrapartida, dicha en voz alta:** si el proceso se reinicia se pierden
hasta 25 eventos que estaban en el buffer. Para contar visitas es el canje
correcto. Para algo que no se puede perder — los leads, hallazgo F1 — la
respuesta es una fila write-ahead en su propia tabla, no este buffer. El evento
`lead` de acá es un **contador**, no el registro del lead.

## Consolidación

```
npm run analytics:rollup          # últimos 2 días
npm run analytics:rollup -- 30    # reconsolidar 30 días
```

O vía cron: `GET /api/cron?job=analytics` (ver `docs/cron.md`). Es idempotente
— reprocesar un día recalcula y sobrescribe las mismas filas. **Sin cron el
panel se queda vacío**, porque sólo lee la tabla consolidada.
