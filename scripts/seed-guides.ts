/**
 * Seed a few starter guides so /guias renders with real, useful content from
 * day one. Idempotent: upserts by slug. Content is genuine orientation for the
 * Paraguayan market; every figure is explicitly referential (rates/prices vary).
 *
 *   npx tsx scripts/seed-guides.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { contentPages } from "../src/db/schema";
import { slugify } from "../src/lib/slug";

interface SeedGuide {
  title: string;
  excerpt: string;
  body: string;
}

const GUIDES: SeedGuide[] = [
  {
    title: "Cómo financiar un camión en Paraguay",
    excerpt:
      "Guía práctica para financiar tu camión en Paraguay: entrega inicial, plazos, tasas y qué mirar antes de firmar. Cifras referenciales.",
    body: `Comprar un camión de trabajo casi siempre pasa por alguna forma de financiación. Acá te explicamos, en criollo, cómo funciona y qué conviene revisar antes de firmar.

## La entrega inicial

La mayoría de los planes piden una **entrega inicial** (o "pie") de entre el 20% y el 40% del valor del camión. Cuanto más entregás al principio, menor es la cuota mensual y menos intereses pagás en total.

## El plazo

Los plazos habituales para vehículos comerciales van de **24 a 60 meses**. Un plazo más largo baja la cuota, pero aumenta lo que pagás de intereses. Elegí el plazo más corto que tu flujo de caja aguante.

## La tasa

La tasa depende de la financiera, del banco y de tu perfil crediticio. Trabajá siempre con la **cuota final** y el **costo total** del crédito, no solo con la tasa nominal.

> Las cuotas que ves en camiones.com.py son estimaciones para orientarte. La cuota real la confirma la financiera según tu caso.

## Antes de firmar

- Pedí el detalle de **todos** los gastos: gestoría, seguro, prenda, comisiones.
- Confirmá si el seguro es obligatorio y por cuánto tiempo.
- Revisá si hay **penalidad por cancelación anticipada**.
- Verificá que el camión no tenga deudas ni prenda anterior.

Cuando tengas el número claro, **consultá por WhatsApp** con el vendedor del aviso que te interese y pedí que te pase el plan formal por escrito.`,
  },
  {
    title: "Camiones usados: qué revisar antes de comprar",
    excerpt:
      "Checklist para comprar un camión usado en Paraguay: motor, chasis, documentación y kilometraje. Consejos prácticos para no llevarte sorpresas.",
    body: `Un usado bien elegido rinde años; uno mal revisado se come tu ganancia en el taller. Esta es la revisión mínima que recomendamos antes de cerrar.

## Documentación

- **Título y cédula verde** al día y a nombre del vendedor.
- Verificá que no tenga **prenda** ni deudas pendientes.
- Chequeá que el número de chasis y motor coincidan con los papeles.

## Motor y transmisión

- Arrancá en frío: escuchá ruidos raros y mirá el color del humo.
- Fugas de aceite o refrigerante debajo del motor.
- Probá todos los cambios en una vuelta de prueba.

## Chasis y carrocería

- Buscá **grietas, soldaduras y óxido** en el chasis (lo más caro de reparar).
- Revisá el estado de la caja, el enganche y la suspensión.

## Kilometraje y uso

Un kilometraje alto no siempre es malo si el mantenimiento fue prolijo. Pedí el **historial de service** y facturas de repuestos.

> Los kilómetros y el estado que figuran en cada aviso los declara el vendedor. Siempre conviene una revisión presencial con un mecánico de confianza.

Cuando tengas el camión que te cierra, **escribí por WhatsApp** desde el aviso y coordiná la revisión antes de señar.`,
  },
  {
    title: "Scania vs Volvo usados: cuál conviene para tu operación",
    excerpt:
      "Comparativa práctica entre Scania y Volvo usados en Paraguay: repuestos, consumo, red de servicio y reventa. Para elegir según tu ruta.",
    body: `Scania y Volvo son dos de las marcas más buscadas en tractocamiones usados en Paraguay. Las dos son excelentes; la mejor depende de tu operación.

## Red de servicio y repuestos

Antes de la marca, mirá **dónde vas a hacer el service**. Fijate qué representante tiene taller y stock de repuestos cerca de tu ruta habitual (Asunción, Ciudad del Este, Encarnación).

## Consumo y confort

Ambas marcas rinden muy bien en ruta. En general:

- **Scania** tiene fama de motores muy durables y buena reventa.
- **Volvo** suele destacar en confort de cabina y seguridad.

## Reventa

Las dos mantienen buen valor de reventa si están bien cuidadas y con papeles en orden. El historial de mantenimiento pesa más que la marca.

## Entonces, ¿cuál?

| Priorizás… | Mirá primero |
| --- | --- |
| Repuestos cerca de tu ruta | La que tenga taller más cerca |
| Durabilidad y reventa | Scania |
| Confort y seguridad de cabina | Volvo |

No hay una respuesta única. Definí tu ruta, tu presupuesto de mantenimiento y **consultá los avisos disponibles** de las dos marcas por WhatsApp antes de decidir.`,
  },
];

async function main() {
  const now = new Date();
  let n = 0;
  for (const g of GUIDES) {
    const slug = slugify(g.title);
    const values = {
      slug,
      kind: "guia" as const,
      title: g.title,
      excerpt: g.excerpt,
      body: g.body,
      source: "seed",
      status: "published" as const,
      publishedAt: now,
    };
    await db
      .insert(contentPages)
      .values(values)
      .onDuplicateKeyUpdate({
        set: { title: g.title, excerpt: g.excerpt, body: g.body, status: "published" },
      });
    const [row] = await db
      .select({ id: contentPages.id })
      .from(contentPages)
      .where(eq(contentPages.slug, slug))
      .limit(1);
    console.log(`  guía '${slug}' (id ${row.id})`);
    n++;
  }
  console.log(`seeded ${n} guides`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
