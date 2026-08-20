/**
 * F12 — the planner. One code path decides everything, so `--dry-run` cannot
 * disagree with the commit that follows it (propia lesson 4). No DB here: the
 * planner takes plain maps in and returns a plan out.
 */
import { describe, expect, it } from "vitest";
import { planImport, type ExistingListing, type PlanInput } from "@/lib/import/plan";
import { importIdentity } from "@/lib/import/identity";
import { bestCuota, type FinancingProgram } from "@/lib/cuota";

const brands = new Map([
  ["scania", { id: 3, slug: "scania", name: "Scania" }],
  ["hyundai", { id: 4, slug: "hyundai", name: "Hyundai" }],
]);
const cities = new Map([
  ["asuncion", { id: 11, slug: "asuncion" }],
  ["luque", { id: 12, slug: "luque" }],
]);
const programs: FinancingProgram[] = [
  {
    code: "demo",
    name: "Demo (PLACEHOLDER)",
    annualRate: 12,
    maxTermMonths: 60,
    maxAmountGs: null,
    minDownPct: 20,
    active: true,
  },
];
const now = new Date("2026-08-20T12:00:00Z");

const row = (over: Record<string, string> = {}) => ({
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
  descripcion: "Del CSV",
  fotos: "",
  ...over,
});

function input(over: Partial<PlanInput> = {}): PlanInput {
  return {
    records: [row()],
    sellerSlug: "camiones-py",
    sellerId: 5,
    publish: false,
    replacePhotos: false,
    brands,
    cities,
    existing: new Map<string, ExistingListing>(),
    programs,
    usdToPyg: 7300,
    now,
    ...over,
  };
}

function existingFor(rec: Record<string, string>, over: Partial<ExistingListing> = {}) {
  const identity = importIdentity({
    sellerSlug: "camiones-py",
    externalId: rec.chapa,
    brandSlug: "scania",
    model: rec.modelo,
    year: Number(rec.anio),
  });
  const listing: ExistingListing = {
    id: 77,
    publicId: "IABCDEFGHJ",
    status: "published",
    publishedAt: new Date("2026-01-05T10:00:00Z"),
    imageCount: 2,
    title: "Scania R500 2021",
    brandId: 3,
    model: "R500",
    year: 2021,
    km: 320000,
    condition: "usado",
    category: "tractocamion",
    priceUsd: "105000.00",
    priceGs: "766500000",
    // Same derivation the planner does — otherwise an untouched sheet would
    // look like a cuota change on every run.
    cuotaGs: String(bestCuota(766500000, programs)!.monthlyGs),
    transmission: "automatizada",
    fuel: "diesel",
    traction: "6x4",
    capacityKg: 26000,
    locationId: 11,
    description: "Escrito en el admin",
    externalId: identity.externalId,
    ...over,
  };
  return new Map([[identity.key, listing]]);
}

describe("planImport — creates", () => {
  it("plans a create for an unseen truck and derives ₲ from USD", () => {
    const plan = planImport(input());
    expect(plan.counts).toEqual({ create: 1, update: 0, skip: 0, error: 0 });
    const [r] = plan.rows;
    expect(r.action).toBe("create");
    expect(r.values.priceGs).toBe(String(105000 * 7300));
    expect(r.values.title).toBe("Scania R500 2021");
    expect(r.values.category).toBe("tractocamion");
    expect(r.values.externalId).toBe("ABC123");
  });

  it("only stamps publish state on creates, and only with --publish", () => {
    expect(planImport(input()).rows[0].values.status).toBe("draft");
    expect(planImport(input()).rows[0].values.publishedAt).toBeNull();
    const published = planImport(input({ publish: true })).rows[0];
    expect(published.values.status).toBe("published");
    expect(published.values.publishedAt).toBe(now);
  });

  it("accepts dealer number formats for km and price", () => {
    const r = planImport(input({ records: [row({ km: "320.000", precio_usd: "105.000" })] }))
      .rows[0];
    expect(r.values.km).toBe(320000);
    expect(r.values.priceUsd).toBe("105000.00");
  });

  it("carries the CSV description and category on a create (admin owns them after)", () => {
    expect(planImport(input()).rows[0].values.description).toBe("Del CSV");
  });
});

describe("planImport — the anchorless publish refusal (F2)", () => {
  const anchorless = [row({ chapa: "" })];

  it("refuses --publish when any row has no chapa/stock_id", () => {
    const plan = planImport(input({ records: anchorless, publish: true }));
    expect(plan.anchored).toBe(false);
    expect(plan.refusals).toHaveLength(1);
    expect(plan.refusals[0]).toContain("--publish");
  });

  it("allows the same rows as drafts", () => {
    const plan = planImport(input({ records: anchorless }));
    expect(plan.refusals).toEqual([]);
    expect(plan.counts.create).toBe(1);
    expect(plan.rows[0].values.status).toBe("draft");
  });

  it("does not refuse when every row is anchored", () => {
    expect(planImport(input({ publish: true })).refusals).toEqual([]);
  });
});

describe("planImport — updates", () => {
  it("merges a km + price update onto the existing listing", () => {
    const rec = row({ km: "345000", precio_usd: "99000" });
    const plan = planImport(input({ records: [rec], existing: existingFor(rec) }));
    const [r] = plan.rows;
    expect(r.action).toBe("update");
    expect(r.listingId).toBe(77);
    expect(r.changed).toContain("km");
    expect(r.changed).toContain("priceUsd");
    expect(r.values).not.toHaveProperty("status");
    expect(r.values).not.toHaveProperty("publishedAt");
    expect(r.values).not.toHaveProperty("description");
  });

  it("captures a previous_json snapshot of exactly what changes", () => {
    const rec = row({ km: "345000" });
    const [r] = planImport(input({ records: [rec], existing: existingFor(rec) })).rows;
    expect(r.previous).toEqual({ id: 77, publicId: "IABCDEFGHJ", km: 320000 });
  });

  it("a mileage-only change updates instead of duplicating (the F2 bug)", () => {
    const first = row({ km: "320000" });
    const later = row({ km: "345000" });
    const plan = planImport(input({ records: [later], existing: existingFor(first) }));
    expect(plan.counts).toEqual({ create: 0, update: 1, skip: 0, error: 0 });
  });

  it("skips a row that changes nothing", () => {
    const rec = row();
    const plan = planImport(input({ records: [rec], existing: existingFor(rec) }));
    expect(plan.counts.skip).toBe(1);
    expect(plan.rows[0].previous).toBeNull();
  });

  it("re-running WITHOUT --publish leaves published rows published (F3)", () => {
    const rec = row();
    const [r] = planImport(input({ records: [rec], existing: existingFor(rec) })).rows;
    expect(r.statusChange).toBeNull();
    expect(r.values.status).toBeUndefined();
  });

  it("re-running WITH --publish does not re-stamp published_at (F3)", () => {
    const rec = row({ km: "345000" });
    const [r] = planImport(
      input({ records: [rec], existing: existingFor(rec), publish: true }),
    ).rows;
    expect(r.values.publishedAt).toBeUndefined();
    expect(r.statusChange).toBeNull();
  });

  it("moves status only through the estado column", () => {
    const rec = row({ estado: "vendido" });
    const [r] = planImport(input({ records: [rec], existing: existingFor(rec) })).rows;
    expect(r.action).toBe("update");
    expect(r.statusChange).toEqual({
      status: "sold",
      publishedAt: new Date("2026-01-05T10:00:00Z"),
    });
  });
});

describe("planImport — photos are admin-owned", () => {
  const rec = row({ fotos: "a.webp|b.webp" });

  it("fills an empty gallery", () => {
    const [r] = planImport(
      input({ records: [rec], existing: existingFor(rec, { imageCount: 0 }) }),
    ).rows;
    expect(r.applyPhotos).toBe(true);
    expect(r.photos).toEqual(["a.webp", "b.webp"]);
  });

  it("leaves a curated gallery alone", () => {
    const [r] = planImport(
      input({ records: [rec], existing: existingFor(rec, { imageCount: 4 }) }),
    ).rows;
    expect(r.applyPhotos).toBe(false);
    expect(r.action).toBe("skip");
  });

  it("replaces it only with --replace-photos", () => {
    const [r] = planImport(
      input({
        records: [rec],
        existing: existingFor(rec, { imageCount: 4 }),
        replacePhotos: true,
      }),
    ).rows;
    expect(r.applyPhotos).toBe(true);
    expect(r.action).toBe("update");
  });
});

describe("planImport — row errors", () => {
  it("reports unknown taxonomy per row without aborting the rest", () => {
    const plan = planImport(
      input({
        records: [
          row({ marca: "Tesla" }),
          row({ chapa: "XYZ789", ciudad: "Encarnación" }),
          row({ chapa: "QRS456", categoria: "helicopteros" }),
          row({ chapa: "TUV111", anio: "1899" }),
          row({ chapa: "UVW222", precio_usd: "0" }),
          row({ chapa: "OK9999" }),
        ],
      }),
    );
    expect(plan.counts.error).toBe(5);
    expect(plan.counts.create).toBe(1);
    expect(plan.rows[0].error).toContain("marca desconocida");
    expect(plan.rows[1].error).toContain("ciudad desconocida");
    expect(plan.rows[2].error).toContain("categoria desconocida");
    expect(plan.rows[3].error).toContain("año inválido");
    expect(plan.rows[4].error).toContain("precio_usd inválido");
  });

  it("numbers rows from the CSV line, header included", () => {
    const plan = planImport(input({ records: [row(), row({ marca: "Tesla" })] }));
    expect(plan.rows.map((r) => r.rowNo)).toEqual([2, 3]);
  });
});

describe("planImport — dry-run / commit equivalence", () => {
  const records = [row(), row({ chapa: "XYZ789", modelo: "HD65", marca: "Hyundai" })];

  it("is deterministic: the same input plans identically every time", () => {
    expect(planImport(input({ records }))).toEqual(planImport(input({ records })));
  });

  it("plans the same rows whether or not the caller intends to write", () => {
    // The script builds ONE plan and then either prints it (--dry-run) or hands
    // it to commitImport(); nothing in the plan depends on which happens next.
    const dry = planImport(input({ records }));
    const wet = planImport(input({ records }));
    expect(dry.rows.map((r) => ({ a: r.action, v: r.values }))).toEqual(
      wet.rows.map((r) => ({ a: r.action, v: r.values })),
    );
    expect(dry.counts).toEqual(wet.counts);
  });

  it("plans updates identically on the second pass over the same sheet", () => {
    const rec = row({ km: "345000" });
    const a = planImport(input({ records: [rec], existing: existingFor(rec) }));
    const b = planImport(input({ records: [rec], existing: existingFor(rec) }));
    expect(a).toEqual(b);
  });
});

describe("planImport — duplicate rows inside one sheet", () => {
  it("errors the second row that repeats a chapa", () => {
    const plan = planImport(input({ records: [row(), row({ modelo: "FH540" })] }));
    expect(plan.counts).toEqual({ create: 1, update: 0, skip: 0, error: 1 });
    expect(plan.rows[1].error).toContain("ABC123");
    expect(plan.rows[1].error).toContain("fila 2");
  });

  it("errors an anchorless repeat and says what would fix it", () => {
    const plan = planImport(input({ records: [row({ chapa: "" }), row({ chapa: "" })] }));
    expect(plan.counts.error).toBe(1);
    expect(plan.rows[1].error).toContain("chapa/stock_id");
  });

  it("leaves genuinely distinct rows alone", () => {
    const plan = planImport(input({ records: [row(), row({ chapa: "XYZ789" })] }));
    expect(plan.counts.create).toBe(2);
  });
});
