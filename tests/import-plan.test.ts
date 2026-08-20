/**
 * F2/F3/F12 — the shared plan/commit path.
 *
 * `buildPlan()` is the whole decision layer; `commitPlan()` only executes it.
 * That is why `--dry-run` is trustworthy, and it is what these tests pin down.
 */
import { describe, expect, it } from "vitest";
import { buildPlan, type PlanInput } from "@/lib/import/plan";
import type { ImportLookups } from "@/lib/import/contract";
import type { ExistingListing } from "@/lib/import/merge";
import type { FinancingProgram } from "@/lib/cuota";

const NOW = new Date("2026-08-20T12:00:00Z");

const lookups: ImportLookups = {
  brandBySlug: new Map([
    ["scania", { id: 3, slug: "scania", name: "Scania" }],
    ["volvo", { id: 4, slug: "volvo", name: "Volvo" }],
  ]),
  cityBySlug: new Map([["asuncion", { id: 9, slug: "asuncion" }]]),
};

/** A VERIFIED program — a "(PLACEHOLDER)" one is filtered out by cuota.ts. */
const programs: FinancingProgram[] = [
  {
    code: "demo",
    name: "Banco verificado",
    annualRate: 12,
    maxTermMonths: 60,
    maxAmountGs: null,
    minDownPct: 20,
    active: true,
    rateConvention: "nominal",
  },
];

const placeholderPrograms: FinancingProgram[] = [
  { ...programs[0], code: "fake", name: "Banco inventado (PLACEHOLDER)" },
];

function record(over: Record<string, string> = {}): Record<string, string> {
  return {
    chapa: "ABC123",
    marca: "Scania",
    modelo: "R500",
    anio: "2021",
    km: "320000",
    precio_usd: "105000",
    precio_gs: "",
    condicion: "usado",
    categoria: "tractocamiones",
    transmision: "automatizada",
    combustible: "diesel",
    traccion: "6x4",
    capacidad_kg: "26000",
    ciudad: "Asunción",
    estado: "",
    descripcion: "Tracto V8.",
    fotos: "",
    ...over,
  };
}

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    records: [record()],
    lookups,
    existingByKey: new Map(),
    sellerSlug: "camiones-py",
    sellerId: 2,
    sellerExists: true,
    programs,
    usdToPyg: 7300,
    publish: false,
    createSeller: false,
    now: NOW,
    ...over,
  };
}

const existing = (over: Partial<ExistingListing> = {}): ExistingListing => ({
  id: 11,
  publicId: "IABCDEFGHJ",
  slug: "scania-r500-2021-iabcdefghj",
  title: "Scania R500 2021",
  condition: "usado",
  category: "tractocamion",
  brandId: 3,
  model: "R500",
  year: 2021,
  km: 320000,
  priceUsd: "105000.00",
  priceGs: "766500000",
  transmission: "automatizada",
  fuel: "diesel",
  traction: "6x4",
  capacityKg: 26000,
  description: "Tracto V8.",
  locationId: 9,
  sellerId: 2,
  externalId: "ABC123",
  status: "published",
  publishedAt: new Date("2026-01-15T10:00:00Z"),
  updatedBy: null,
  ...over,
});

/** The plan for a record, with the row already keyed against `existingByKey`. */
function planWithExisting(rec: Record<string, string>, ex: ExistingListing) {
  const key = buildPlan(input({ records: [rec] })).rows[0].importKey!;
  return buildPlan(input({ records: [rec], existingByKey: new Map([[key, ex]]) }));
}

describe("dry-run / commit equivalence (F12)", () => {
  it("takes no dry-run input at all — the same call yields the same plan", () => {
    // The ONLY difference between `--dry-run` and a real run is whether
    // commitPlan() is allowed to write; the decisions come from here.
    const a = buildPlan(input());
    const b = buildPlan(input());
    expect(a).toEqual(b);
    expect(Object.keys(input())).not.toContain("dryRun");
  });

  it("plans the same actions whether or not rows already exist elsewhere", () => {
    const plan = buildPlan(input({ records: [record(), record({ chapa: "XYZ" })] }));
    expect(plan.counts).toEqual({ total: 2, create: 2, update: 0, skip: 0, error: 0 });
  });
});

describe("identity anchor gates --publish (F2)", () => {
  it("refuses --publish when a row has no chapa/stock_id", () => {
    const plan = buildPlan(input({ records: [record({ chapa: "" })], publish: true }));
    expect(plan.anchored).toBe(false);
    expect(plan.blockers).toHaveLength(1);
    expect(plan.blockers[0]).toContain("--publish rechazado");
    expect(plan.blockers[0]).toContain("stock_id");
  });

  it("allows --publish when every row is anchored", () => {
    const plan = buildPlan(input({ publish: true }));
    expect(plan.anchored).toBe(true);
    expect(plan.blockers).toEqual([]);
    expect(plan.rows[0].values.status).toBe("published");
    expect(plan.rows[0].values.publishedAt).toEqual(NOW);
  });

  it("refuses a mixed sheet — one anchorless row poisons the run", () => {
    const plan = buildPlan(
      input({ records: [record(), record({ chapa: "", modelo: "FH540" })], publish: true }),
    );
    expect(plan.blockers[0]).toContain("1 de 2 filas");
  });

  it("still runs (as drafts) without an anchor", () => {
    const plan = buildPlan(input({ records: [record({ chapa: "" })] }));
    expect(plan.blockers).toEqual([]);
    expect(plan.rows[0].action).toBe("create");
    expect(plan.rows[0].values.status).toBe("draft");
    expect(plan.rows[0].values.publishedAt).toBeNull();
  });

  it("flags two anchorless rows that collapse onto one identity", () => {
    const plan = buildPlan(input({ records: [record({ chapa: "" }), record({ chapa: "" })] }));
    expect(plan.rows[1].action).toBe("error");
    expect(plan.rows[1].message).toContain("colisiona con la fila 2");
  });

  it("flags a repeated chapa", () => {
    const plan = buildPlan(input({ records: [record(), record({ modelo: "FH540" })] }));
    expect(plan.rows[1].action).toBe("error");
    expect(plan.rows[1].message).toContain("repetida");
  });
});

describe("publish-state preservation (F3)", () => {
  it("a mileage update updates the SAME listing instead of creating one", () => {
    const plan = planWithExisting(record({ km: "341000" }), existing());
    expect(plan.counts).toEqual({ total: 1, create: 0, update: 1, skip: 0, error: 0 });
    expect(plan.rows[0].listingId).toBe(11);
    expect(plan.rows[0].changed).toContain("km");
  });

  it("never touches status or publishedAt on update without an `estado` column", () => {
    const plan = planWithExisting(record({ km: "341000", precio_usd: "99000" }), existing());
    expect(plan.rows[0].values).not.toHaveProperty("status");
    expect(plan.rows[0].values).not.toHaveProperty("publishedAt");
  });

  it("a re-run WITHOUT --publish no longer demotes a published listing", () => {
    const plan = planWithExisting(record(), existing({ status: "published" }));
    expect(plan.rows[0].action).toBe("skip");
    expect(plan.rows[0].values).toEqual({});
  });

  it("a re-run WITH --publish does not re-stamp the first published_at", () => {
    const key = buildPlan(input({ records: [record()] })).rows[0].importKey!;
    const plan = buildPlan(
      input({
        records: [record({ km: "341000" })],
        existingByKey: new Map([[key, existing()]]),
        publish: true,
      }),
    );
    expect(plan.rows[0].values).not.toHaveProperty("publishedAt");
  });

  it("recomputes the cached cuota only when the ₲ price moved", () => {
    const moved = planWithExisting(record({ precio_usd: "99000" }), existing());
    expect(moved.rows[0].changed).toContain("cuotaGs");
    expect(moved.rows[0].values.cuotaGs).toEqual(expect.any(String));

    const still = planWithExisting(record({ km: "341000" }), existing());
    expect(still.rows[0].changed).not.toContain("cuotaGs");
  });

  it("never caches a cuota derived from a PLACEHOLDER rate (F5)", () => {
    const key = buildPlan(input({ records: [record()] })).rows[0].importKey!;
    const plan = buildPlan(
      input({
        records: [record({ precio_usd: "99000" })],
        existingByKey: new Map([[key, existing()]]),
        programs: placeholderPrograms,
      }),
    );
    expect(plan.rows[0].values.cuotaGs).toBeNull();
  });
});

describe("availability column (import wins)", () => {
  it("published → vendido is applied and keeps published_at", () => {
    const plan = planWithExisting(record({ estado: "vendido" }), existing());
    expect(plan.rows[0].values.status).toBe("sold");
    expect(plan.rows[0].values).not.toHaveProperty("publishedAt");
  });

  it("vendido → disponible routes back through Borrador (F27), never straight to published", () => {
    const plan = planWithExisting(record({ estado: "disponible" }), existing({ status: "sold" }));
    expect(plan.rows[0].values.status).toBe("draft");
    expect(plan.rows[0].values.publishedAt).toBeNull();
    expect(plan.rows[0].message).toContain("Borrador");
  });

  it("rejects an unknown estado instead of guessing", () => {
    const plan = buildPlan(input({ records: [record({ estado: "quizás" })] }));
    expect(plan.rows[0].action).toBe("error");
    expect(plan.rows[0].message).toContain("estado desconocido");
  });
});

describe("seller safety (F12)", () => {
  it("blocks the whole run when the vendedor does not exist", () => {
    const plan = buildPlan(input({ sellerExists: false, sellerId: null }));
    expect(plan.blockers[0]).toContain("no existe");
    expect(plan.blockers[0]).toContain("--create-seller");
  });

  it("lets --create-seller through", () => {
    const plan = buildPlan(input({ sellerExists: false, sellerId: null, createSeller: true }));
    expect(plan.blockers).toEqual([]);
  });

  it("refuses to yank a listing that now belongs to another vendedor", () => {
    const plan = planWithExisting(record(), existing({ sellerId: 999 }));
    expect(plan.rows[0].action).toBe("error");
    expect(plan.rows[0].message).toContain("pertenece a otro vendedor");
  });
});

describe("row validation", () => {
  it("reports the CSV line number (header is line 1)", () => {
    const plan = buildPlan(input({ records: [record(), record({ marca: "Kenworth" })] }));
    expect(plan.rows[1]).toMatchObject({ rowNo: 3, action: "error" });
    expect(plan.rows[1].message).toContain("marca desconocida");
  });

  it("accepts spreadsheet number formats", () => {
    const plan = buildPlan(
      input({ records: [record({ km: "320.000", precio_usd: "US$ 105,000" })] }),
    );
    expect(plan.rows[0].values).toMatchObject({ km: 320000, priceUsd: "105000.00" });
  });

  it("derives ₲ from USD when precio_gs is blank", () => {
    const plan = buildPlan(input());
    expect(plan.rows[0].values.priceGs).toBe(String(105000 * 7300));
  });

  it("an empty fotos column leaves the gallery alone", () => {
    expect(planWithExisting(record({ km: "1" }), existing()).rows[0].photos).toBeNull();
  });
});
