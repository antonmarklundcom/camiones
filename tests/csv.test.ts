import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("maps rows onto lowercased header keys", () => {
    const rows = parseCsv("Marca,Modelo\nScania,R450");
    expect(rows).toEqual([{ marca: "Scania", modelo: "R450" }]);
  });

  it("keeps commas inside quoted fields", () => {
    const rows = parseCsv('marca,descripcion\nVolvo,"Cabina alta, 6x4"');
    expect(rows[0].descripcion).toBe("Cabina alta, 6x4");
  });

  it("unescapes doubled quotes", () => {
    const rows = parseCsv('marca,nota\nScania,"Motor ""nuevo"" 2023"');
    expect(rows[0].nota).toBe('Motor "nuevo" 2023');
  });

  it("handles CRLF line endings from Excel exports", () => {
    const rows = parseCsv("marca,modelo\r\nScania,R450\r\nVolvo,FH");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ marca: "Volvo", modelo: "FH" });
  });

  it("preserves newlines inside quoted fields", () => {
    const rows = parseCsv('marca,descripcion\nScania,"linea 1\nlinea 2"');
    expect(rows).toHaveLength(1);
    expect(rows[0].descripcion).toBe("linea 1\nlinea 2");
  });

  it("trims surrounding whitespace from values and headers", () => {
    const rows = parseCsv("  Marca  , Modelo \n  Scania , R450 ");
    expect(rows[0]).toEqual({ marca: "Scania", modelo: "R450" });
  });

  it("fills missing trailing columns with empty strings", () => {
    const rows = parseCsv("marca,modelo,km\nScania,R450");
    expect(rows[0].km).toBe("");
  });

  it("ignores a trailing blank line", () => {
    expect(parseCsv("marca,modelo\nScania,R450\n")).toHaveLength(1);
  });

  it("returns an empty array for a header-only or empty file", () => {
    expect(parseCsv("marca,modelo")).toEqual([]);
    expect(parseCsv("")).toEqual([]);
  });
});
