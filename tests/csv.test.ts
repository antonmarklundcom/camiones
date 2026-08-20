/**
 * The importer's front door. A parser bug here writes wrong prices/km into
 * real dealer inventory, so quoting rules get pinned down explicitly.
 */
import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("maps rows onto lowercased, trimmed headers", () => {
    expect(parseCsv("Title, Price_USD\nScania R450,52000\n")).toEqual([
      { title: "Scania R450", price_usd: "52000" },
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    const rows = parseCsv('title,desc\n"Volvo FH","Cabina alta, 6x4"\n');
    expect(rows[0].desc).toBe("Cabina alta, 6x4");
  });

  it('unescapes doubled quotes ("")', () => {
    const rows = parseCsv('title\n"Camión ""Toro"" 4x2"\n');
    expect(rows[0].title).toBe('Camión "Toro" 4x2');
  });

  // From the parallel Batch 0 suite: cell values are trimmed, not just headers.
  it("trims cell values", () => {
    expect(parseCsv("marca\n  Scania  ")[0].marca).toBe("Scania");
  });

  it("handles CRLF line endings (Excel exports)", () => {
    const rows = parseCsv("title,year\r\nActros,2019\r\n");
    expect(rows).toEqual([{ title: "Actros", year: "2019" }]);
  });

  it("ignores empty trailing lines", () => {
    expect(parseCsv("title\nActros\n\n")).toHaveLength(1);
  });

  it("fills missing trailing columns with empty strings", () => {
    const rows = parseCsv("title,km,note\nActros,120000\n");
    expect(rows[0]).toEqual({ title: "Actros", km: "120000", note: "" });
  });

  it("returns [] for a header-only or empty file", () => {
    expect(parseCsv("title,km\n")).toEqual([]);
    expect(parseCsv("")).toEqual([]);
  });

  it("parses a final row without a trailing newline", () => {
    expect(parseCsv("title\nActros")).toEqual([{ title: "Actros" }]);
  });
});
