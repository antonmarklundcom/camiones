# Contrato del CSV de inventario

Archivo de ejemplo: `ejemplo-inventario.csv`. El importador
(`npm run import:csv -- <archivo.csv> <seller-slug> [flags]`) lee la primera
fila como encabezado, sin distinguir mayúsculas.

## Columna de identidad (la más importante)

`chapa` — o cualquiera de `stock_id`, `patente`, `placa`. Es el número de chapa
de la unidad o el código de stock del concesionario.

- **Con esta columna**: cada camión se identifica por `vendedor + chapa`. Las
  actualizaciones mensuales de precio o kilometraje **actualizan** el aviso
  existente, nunca crean uno nuevo.
- **Sin esta columna**: el importador usa `marca + modelo + año` (el kilometraje
  queda deliberadamente fuera de la clave) y **rechaza `--publish`**. Dos
  unidades distintas del mismo modelo y año se fusionarían en un solo aviso, así
  que las filas quedan como borrador para que alguien las revise en `/admin`.

Se normaliza a mayúsculas sin espacios ni guiones: `abc 123`, `ABC-123` y
`ABC123` son la misma unidad.

## Columnas

| Columna | Obligatoria | Notas |
|---|---|---|
| `chapa` / `stock_id` | recomendada | ver arriba |
| `marca` | sí | debe existir en `brands` (ver `npm run seed:brands`) |
| `modelo` | sí | texto libre |
| `anio` | sí | 1970–2035 |
| `km` | no | acepta `320000`, `320.000`, `320,000`; vacío = 0 |
| `precio_usd` | sí | mayor a 0 — el USD es la moneda primaria |
| `precio_gs` | no | vacío = se calcula con `USD_TO_PYG` |
| `condicion` | sí | `nuevo` / `usado` |
| `categoria` | sí | valor de la BD (`camion`, `tractocamion`…) o plural de URL (`camiones`…) |
| `transmision` | no | `manual` / `automatica` / `automatizada` (por defecto `manual`) |
| `combustible` | no | `diesel` / `nafta` / `electrico` / `hibrido` (por defecto `diesel`) |
| `traccion` | no | `4x2` / `4x4` / `6x2` / `6x4` / `8x2` / `8x4` (por defecto `4x2`) |
| `capacidad_kg` | no | entero |
| `ciudad` | sí | debe existir en `locations` nivel `ciudad` |
| `estado` | no | `disponible` / `reservado` / `vendido` — ver "Disponibilidad" |
| `descripcion` | no | **el admin manda**: sólo se escribe al crear el aviso |
| `fotos` | no | claves de R2 separadas por `\|`; **el admin manda** (ver abajo) |

## Qué pisa el import y qué no

| Campo | Manda |
|---|---|
| precio, km, año, marca, modelo, specs, ciudad | el import (se sobrescriben en cada corrida) |
| `descripcion`, `categoria`, fotos, `destacado` | el admin (sólo se escriben al crear) |
| `status` / `published_at` | sólo al crear, o vía `estado` |

La primera fecha de publicación (`published_at`) **nunca** se pisa.

Las fotos sólo se cargan si el aviso todavía no tiene ninguna. Para reemplazar
una galería ya curada hace falta `--replace-photos` explícito.

## Disponibilidad (`estado`)

- `vendido` → el aviso pasa a **Vendido**.
- `reservado` → pasa a **Pausado**.
- `disponible` → sólo **despausa** un aviso pausado. Publicar un borrador o
  revivir un aviso vendido sigue siendo una decisión del admin.

## Flags

| Flag | Qué hace |
|---|---|
| `--dry-run` | planifica y deja el plan en `import_jobs`/`import_rows`, sin tocar `listings` |
| `--publish` | los avisos NUEVOS nacen publicados (requiere columna de identidad) |
| `--create-seller` | crea el vendedor como **borrador** si el slug no existe |
| `--replace-photos` | permite pisar una galería cargada desde el admin |

## Auditoría

Cada corrida (incluidas las de `--dry-run`) deja una fila en `import_jobs` y una
por fila de CSV en `import_rows`, con `previous_json` = el estado anterior de los
campos que cambiaron. Es la única forma de revertir una importación sin adivinar.

El proceso termina con código distinto de cero si **alguna** fila falló.
