/**
 * Dealer-inventory CSV importer (rebuilt in Phase 6 Batch 2 — audit F2/F3/F12/F28).
 *
 *   npm run import:csv -- <file.csv> <seller-slug> [--dry-run] [--publish] [--create-seller]
 *
 * Always run it with --dry-run first. The dry run executes the SAME planning
 * code as the real run (src/lib/import/plan.ts) and only skips the writes, so
 * the table it prints is what you will get.
 *
 * Safety rails this script exists to enforce:
 *  - the vendedor must already exist (--create-seller creates a DRAFT one);
 *  - --publish is refused unless every row carries a chapa / stock_id anchor;
 *  - an existing listing never has its status or first published_at rewritten
 *    unless the CSV explicitly states an `estado`;
 *  - every row runs in its own transaction and every run is journalled in
 *    import_jobs / import_rows (previous_json = the pre-change row);
 *  - a single failed row makes the process exit non-zero.
 *
 * Column contract: data/ejemplo-inventario.csv.
 * tsx does NOT auto-load .env — export DATABASE_URL in the shell first.
 */
import { readFileSync } from "node:fs";
import { parseCsv } from "../src/lib/csv";
import { slugify } from "../src/lib/slug";
import { buildPlan } from "../src/lib/import/plan";
import { formatSummary } from "../src/lib/import/report";
import {
  closeJob,
  commitPlan,
  createSellerDraft,
  findSeller,
  loadExisting,
  loadLookups,
  loadPrograms,
  openJob,
} from "../src/lib/import/run";

const USD_TO_PYG = Number(process.env.USD_TO_PYG ?? 7300);

const USAGE =
  "uso: npm run import:csv -- <file.csv> <seller-slug> [--dry-run] [--publish] [--create-seller]";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const publish = args.includes("--publish");
  const createSeller = args.includes("--create-seller");
  const positional = args.filter((a) => !a.startsWith("--"));
  const [file, sellerSlugArg] = positional;

  if (!file || !sellerSlugArg) {
    console.error(USAGE);
    return 1;
  }
  const sellerSlug = slugify(sellerSlugArg);
  const flags = args.filter((a) => a.startsWith("--")).join(" ");

  const records = parseCsv(readFileSync(file, "utf8"));
  if (!records.length) {
    console.error(`✗ '${file}' no tiene filas de datos (¿falta la fila de encabezados?).`);
    return 1;
  }

  const [lookups, programs] = await Promise.all([loadLookups(), loadPrograms()]);
  const seller = await findSeller(sellerSlug);

  // --- plan (no writes) -----------------------------------------------------
  // Planned once against a null seller so a missing vendedor becomes a blocker
  // instead of an exception, then re-planned with the real id if we create one.
  let plan = buildPlan({
    records,
    lookups,
    existingByKey: new Map(),
    sellerSlug,
    sellerId: seller?.id ?? null,
    sellerExists: seller !== null,
    programs,
    usdToPyg: USD_TO_PYG,
    publish,
    createSeller,
    now: new Date(),
  });

  if (plan.blockers.length) {
    const job = await openJob({
      sourceFile: file,
      sellerSlug,
      sellerId: seller?.id ?? null,
      mode: dryRun ? "dry_run" : "commit",
      flags,
    });
    await closeJob(job, plan, "blocked", plan.blockers.join(" | "));
    console.error("\n✗ Import rechazado antes de tocar nada:\n");
    for (const b of plan.blockers) console.error(`  • ${b}\n`);
    return 1;
  }

  let sellerRef = seller;
  if (!sellerRef) {
    if (dryRun) {
      console.log(
        `\nℹ --create-seller: en un import real se crearía el vendedor ` +
          `'${sellerSlug}' como BORRADOR (sin teléfono). Completalo en /admin/sellers.`,
      );
    } else {
      sellerRef = await createSellerDraft(sellerSlug);
      console.log(
        `\n⚠ Vendedor '${sellerSlug}' creado como BORRADOR (sin teléfono ni ciudad). ` +
          `Su página /vendedor/${sellerSlug} NO se publica hasta que lo completes en /admin.`,
      );
    }
  }

  // --- re-plan against the real DB state ------------------------------------
  const provisionalKeys = plan.rows
    .map((r) => r.importKey)
    .filter((k): k is string => k !== null);
  const existingByKey = await loadExisting(provisionalKeys);

  plan = buildPlan({
    records,
    lookups,
    existingByKey,
    sellerSlug,
    sellerId: sellerRef?.id ?? null,
    sellerExists: true,
    programs,
    usdToPyg: USD_TO_PYG,
    publish,
    createSeller,
    now: new Date(),
  });

  const job = await openJob({
    sourceFile: file,
    sellerSlug,
    sellerId: sellerRef?.id ?? null,
    mode: dryRun ? "dry_run" : "commit",
    flags,
  });

  const result = await commitPlan(plan, job, { dryRun });
  const status = result.errors.length
    ? result.created || result.updated
      ? "partial"
      : "failed"
    : "ok";
  await closeJob(job, plan, status, null);

  console.log(formatSummary(plan, result, { file, sellerSlug, dryRun, publish }));
  console.log(`\n  job #${job.id} — revisá import_rows (previous_json) para revertir.`);
  if (dryRun) {
    console.log("\n  Simulacro: no se escribió ningún aviso. Quitá --dry-run para aplicar.");
  }

  // F12: any errored row fails the run, even if others succeeded.
  return result.errors.length ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
