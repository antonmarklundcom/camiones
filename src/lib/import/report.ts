/**
 * The end-of-run summary table. Pure string building so it can be asserted in
 * tests and reused by a future /admin import screen.
 */
import type { ImportPlan } from "@/lib/import/plan";
import type { CommitResult } from "@/lib/import/run";

const ACTION_LABEL = {
  create: "creado",
  update: "actualizado",
  skip: "sin cambios",
  error: "ERROR",
} as const;

export function formatPlanTable(plan: ImportPlan): string {
  const header = ["fila", "acción", "chapa/stock", "cambios", "detalle"];
  const body = plan.rows.map((r) => [
    String(r.rowNo),
    ACTION_LABEL[r.action],
    r.externalId ?? "—",
    r.changed.includes("*") ? "todo" : r.changed.join(", ") || "—",
    r.message ?? "",
  ]);
  return renderTable([header, ...body]);
}

export function formatSummary(
  plan: ImportPlan,
  result: CommitResult,
  opts: { file: string; sellerSlug: string; dryRun: boolean; publish: boolean },
): string {
  const mode = opts.dryRun ? "SIMULACRO (--dry-run, no se escribió nada)" : "APLICADO";
  const lines = [
    "",
    `import '${opts.file}' → vendedor '${opts.sellerSlug}'  ·  ${mode}`,
    `identidad: ${plan.anchored ? "anclada en chapa/stock_id" : "SIN ancla (marca/modelo/año)"}` +
      `  ·  --publish: ${opts.publish ? "sí" : "no"}`,
    "",
    formatPlanTable(plan),
    "",
    `  creados:      ${result.created}`,
    `  actualizados: ${result.updated}`,
    `  sin cambios:  ${result.skipped}`,
    `  con error:    ${result.errors.length}`,
  ];
  if (result.errors.length) {
    lines.push("");
    for (const e of result.errors) lines.push(`  ✗ fila ${e.rowNo}: ${e.message}`);
  }
  return lines.join("\n");
}

function renderTable(rows: string[][]): string {
  const widths = rows[0].map((_, c) =>
    Math.min(60, Math.max(...rows.map((r) => (r[c] ?? "").length))),
  );
  const line = (r: string[]) =>
    "  " + r.map((cell, c) => (cell ?? "").padEnd(widths[c])).join("  ").trimEnd();
  const sep = "  " + widths.map((w) => "─".repeat(w)).join("  ");
  return [line(rows[0]), sep, ...rows.slice(1).map(line)].join("\n");
}
