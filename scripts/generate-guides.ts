/**
 * Batch-draft SEO guides with the Anthropic Message Batches API, then write the
 * results into content_pages as DRAFTS (source="anthropic-batch") for review in
 * /admin/guias before publishing. Batch jobs run out of the request path
 * (propia pattern) at 50% cost.
 *
 *   ANTHROPIC_API_KEY=... DATABASE_URL=... npx tsx scripts/generate-guides.ts [topics.json]
 *
 * `topics.json` (optional) is a JSON array of strings; without it a default set
 * of Paraguay truck-market topics is used. Nothing is ever auto-published —
 * every draft is reviewed by a human first (rates/prices must be checked).
 */
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { contentPages } from "../src/db/schema";
import { slugify } from "../src/lib/slug";

const MODEL = "claude-opus-4-8";

const DEFAULT_TOPICS = [
  "Qué revisar en el motor de un camión usado antes de comprar",
  "Diferencias entre tractocamión 6x2 y 6x4 para rutas en Paraguay",
  "Cómo elegir un camión para transporte de granos en Paraguay",
  "Mantenimiento básico de un camión diésel para alargar su vida útil",
  "Marcas chinas de camiones en Paraguay: qué esperar (JAC, Foton, Shacman)",
  "Volquetes para obra: capacidad, tracción y qué mirar antes de comprar",
];

const SYSTEM = [
  "Sos redactor de contenidos para camiones.com.py, un portal de camiones y",
  "vehículos de trabajo en Paraguay. Escribí en español paraguayo con voseo",
  "(usá 'consultá', 'encontrá', 'escribinos'). Tono claro, práctico y honesto,",
  "para compradores de camiones (transportistas, PyMEs, productores).",
  "REGLAS: no inventes precios, tasas ni cifras exactas; si mencionás valores,",
  "aclarales que son referenciales y que se confirman con el vendedor o la",
  "financiera. Usá Markdown: subtítulos con '##', listas con '-', negritas con",
  "'**'. No pongas un H1 (el título va aparte). Cerrá invitando a consultar por",
  "WhatsApp desde los avisos. Largo objetivo: 500-800 palabras.",
].join(" ");

const format = {
  type: "json_schema" as const,
  schema: {
    type: "object",
    properties: {
      excerpt: {
        type: "string",
        description: "Resumen de 1-2 frases (máx 300 caracteres), sirve de meta descripción.",
      },
      body: { type: "string", description: "Cuerpo de la guía en Markdown." },
    },
    required: ["excerpt", "body"],
    additionalProperties: false,
  },
};

interface Draft {
  excerpt: string;
  body: string;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Falta ANTHROPIC_API_KEY.");
    process.exit(1);
  }
  const fileArg = process.argv[2];
  const topics: string[] = fileArg
    ? JSON.parse(readFileSync(fileArg, "utf8"))
    : DEFAULT_TOPICS;
  if (!Array.isArray(topics) || topics.length === 0) {
    console.error("No hay temas para generar.");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  // custom_id maps back to the topic. Index-based to keep it ≤64 chars.
  const byId = new Map(topics.map((t, i) => [`guia-${i}`, t]));

  console.log(`Creando batch con ${topics.length} temas…`);
  const batch = await client.messages.batches.create({
    requests: topics.map((topic, i) => ({
      custom_id: `guia-${i}`,
      params: {
        model: MODEL,
        max_tokens: 4000,
        output_config: { format, effort: "medium" },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Escribí una guía útil sobre: "${topic}".`,
          },
        ],
      },
    })),
  });
  console.log(`Batch ${batch.id} — estado ${batch.processing_status}`);

  // Poll until ended (batches usually finish within the hour).
  let status = batch.processing_status;
  while (status !== "ended") {
    await new Promise((r) => setTimeout(r, 30_000));
    const cur = await client.messages.batches.retrieve(batch.id);
    status = cur.processing_status;
    console.log(
      `  … ${status} (ok ${cur.request_counts.succeeded}, err ${cur.request_counts.errored})`,
    );
  }

  // Write each succeeded result as a DRAFT.
  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  for await (const res of await client.messages.batches.results(batch.id)) {
    const topic = byId.get(res.custom_id);
    if (!topic) continue;
    if (res.result.type !== "succeeded") {
      errors.push(`${res.custom_id} (${topic}): ${res.result.type}`);
      continue;
    }
    const block = res.result.message.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      errors.push(`${res.custom_id}: sin texto`);
      continue;
    }
    let draft: Draft;
    try {
      draft = JSON.parse(block.text);
    } catch {
      errors.push(`${res.custom_id}: JSON inválido`);
      continue;
    }

    const slug = slugify(topic);
    const [existing] = await db
      .select({ id: contentPages.id })
      .from(contentPages)
      .where(eq(contentPages.slug, slug))
      .limit(1);
    const values = {
      slug,
      kind: "guia" as const,
      title: topic,
      excerpt: draft.excerpt.slice(0, 320),
      body: draft.body,
      source: "anthropic-batch",
      status: "draft" as const,
      publishedAt: null,
    };
    await db
      .insert(contentPages)
      .values(values)
      .onDuplicateKeyUpdate({
        set: { excerpt: values.excerpt, body: values.body, source: values.source },
      });
    existing ? updated++ : created++;
  }

  console.log(
    `\nlisto: ${created} borradores nuevos, ${updated} actualizados, ${errors.length} con error`,
  );
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log("Revisá y publicá desde /admin/guias.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
