/**
 * F24: category/brand/city/condition share ONE /venta segment namespace, so a
 * collision silently hides whichever facet loses the precedence order.
 */
import { describe, expect, it } from "vitest";
import {
  assertSegmentAvailable,
  builtInSegments,
  segmentConflict,
  type TakenSegment,
} from "@/lib/segment-namespace";

const taken: TakenSegment[] = [
  { slug: "scania", kind: "marca" },
  { slug: "asuncion", kind: "ciudad" },
];

describe("builtInSegments", () => {
  it("covers categories, conditions and reserved routes", () => {
    const m = builtInSegments();
    expect(m.get("camiones")).toBe("categoria");
    expect(m.get("usados")).toBe("condicion");
    expect(m.get("venta")).toBe("reservada");
  });
});

describe("segmentConflict", () => {
  it("returns null for a free slug", () => {
    expect(segmentConflict("kenworth", taken)).toBeNull();
  });

  it("catches a brand colliding with a city", () => {
    expect(segmentConflict("asuncion", taken)).toEqual({
      slug: "asuncion",
      kind: "ciudad",
    });
  });

  it("catches a collision with a category slug", () => {
    expect(segmentConflict("camiones", taken)?.kind).toBe("categoria");
  });

  it("catches a collision with a condition segment", () => {
    expect(segmentConflict("nuevos", taken)?.kind).toBe("condicion");
  });

  it("catches a reserved route word", () => {
    expect(segmentConflict("vendedor", taken)?.kind).toBe("reservada");
  });

  it("does not flag a row against itself (re-seed / edit)", () => {
    expect(
      segmentConflict("scania", taken, { slug: "scania", kind: "marca" }),
    ).toBeNull();
  });
});

describe("assertSegmentAvailable", () => {
  it("throws an es-PY message naming the other owner", () => {
    expect(() => assertSegmentAvailable("asuncion", taken)).toThrow(
      /ya lo usa una ciudad/,
    );
  });

  it("stays silent for a free slug", () => {
    expect(() => assertSegmentAvailable("kenworth", taken)).not.toThrow();
  });
});
