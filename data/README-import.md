# Contrato del CSV de inventario

Archivo de ejemplo: `data/ejemplo-inventario.csv`. La fila 1 es el encabezado
(los nombres de columna se comparan en minúsculas, sin importar el orden).

```
npm run import:csv -- data/dealer-x.csv dealer-x --dry-run
npm run import:csv -- data/dealer-x.csv dealer-x --publish
```

**Corré siempre `--dry-run` primero.** El simulacro ejecuta exactamente el mismo
código de planificación que el import real (`src/lib/import/plan.ts`) y sólo
saltea las escrituras, así que la tabla que imprime es lo que vas a obtener.

## Columnas

| Columna | ¿Obligatoria? | Notas |
|---|---|---|
| `chapa` / `stock_id` / `id_stock` / `codigo` / `patente` | **muy recomendada** | El ancla de identidad. Es lo único que permite `--publish`. |
| `marca` | sí | Tiene que coincidir con una marca ya cargada (`npm run seed:brands`). |
| `modelo` | sí | Texto libre. |
| `anio` (o `año`) | sí | 1970–2035. |
| `km` | no | Vacío = 0. Acepta `320.000`, `320,000`, `320000`. |
| `precio_usd` | sí | US$ es la moneda primaria. Acepta `US$ 105.000`. |
| `precio_gs` | no | Si va vacío se calcula con `USD_TO_PYG`. |
| `condicion` | sí | `nuevo` / `usado`. |
| `categoria` | sí | Valor de la base (`camion`, `tractocamion`…) o el plural de la URL (`camiones`…). |
| `transmision` | no | `manual` (por defecto) / `automatica` / `automatizada`. |
| `combustible` | no | `diesel` (por defecto) / `nafta` / `electrico` / `hibrido`. |
| `traccion` | no | `4x2` (por defecto), `4x4`, `6x2`, `6x4`, `8x2`, `8x4`. |
| `capacidad_kg` | no | Entero. |
| `ciudad` | sí | Tiene que coincidir con una ciudad cargada (`npm run seed:locations`). |
| `estado` / `disponibilidad` | no | `disponible`, `vendido`, `reservado`, `pausado`, `retirado`. **Si va vacío, el import NO toca el estado del aviso.** |
| `descripcion` | no | Texto libre. |
| `fotos` | no | Claves de R2 separadas por `\|`. Vacío = no se toca la galería. |

## Por qué importa la chapa / stock_id (F2)

Sin ancla, la identidad del aviso se arma con `vendedor|marca|modelo|año`. Eso
alcanza para que una actualización de kilometraje o de precio **actualice** el
mismo aviso en vez de duplicarlo, pero no distingue dos camiones iguales del
mismo concesionario: se pisan entre sí. Por eso un import sin ancla corre igual,
pero **rechaza `--publish`** — los avisos quedan en borrador para que los
revises en `/admin`.

Con `chapa` o `stock_id` la identidad es `vendedor + ese código` y nada más la
mueve.

## Qué gana el import y qué gana el admin (F3)

- **El import siempre gana**: precio, km, año, marca, modelo, ciudad, specs y
  disponibilidad (`estado`).
- **El admin gana**: `descripcion`, `categoria` y las fotos — pero sólo una vez
  que una persona guardó el aviso en `/admin` (es decir, cuando
  `listings.updated_by` dejó de ser NULL). Antes de eso el CSV refresca todo.
- **El primer `published_at` no se re-escribe nunca.** Un re-import no puede
  volver a estampar "publicado hoy" ni bajar a borrador un aviso publicado.
- Un camión marcado `vendido` y después otra vez `disponible` vuelve a
  **borrador** (no directo a publicado), para que no aparezca como stock fresco
  con una fecha vieja.

## Registro y reversión (F12)

Cada corrida escribe una fila en `import_jobs` y una fila por línea del CSV en
`import_rows`, con `previous_json` = el aviso **antes** del cambio. Los
simulacros también quedan registrados (`mode = 'dry_run'`). Cada fila corre en
su propia transacción y la corrida termina con código de salida ≠ 0 si alguna
falló.

## Vendedores

El vendedor tiene que existir. Un slug mal tipeado **no** puede inventar un
vendedor publicado que se trague todo el inventario. Si de verdad querés que el
import lo cree, pasá `--create-seller`: se crea como **borrador**, sin teléfono,
y su página `/vendedor/[slug]` no se publica hasta que lo completes en `/admin`.
