import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("parseCsv", () => {
  it("parses a plain header + rows", () => {
    expect(parseCsv("marca,modelo\nScania,R450\nVolvo,FH")).toEqual([
      { marca: "Scania", modelo: "R450" },
      { marca: "Volvo", modelo: "FH" },
    ]);
  });

  it("lowercases and trims the header", () => {
    expect(parseCsv(" Marca , MODELO \nScania,R450")).toEqual([
      { marca: "Scania", modelo: "R450" },
    ]);
  });

  it("trims cell values", () => {
    expect(parseCsv("marca\n  Scania  ")[0].marca).toBe("Scania");
  });

  it("handles quoted fields containing commas", () => {
    expect(parseCsv('marca,desc\nScania,"Cabina alta, 6x4"')[0].desc).toBe(
      "Cabina alta, 6x4",
    );
  });

  it("handles escaped quotes", () => {
    expect(parseCsv('marca,desc\nScania,"El ""mejor"" del lote"')[0].desc).toBe(
      'El "mejor" del lote',
    );
  });

  it("handles CRLF line endings from Excel", () => {
    expect(parseCsv("marca,modelo\r\nScania,R450\r\n")).toEqual([
      { marca: "Scania", modelo: "R450" },
    ]);
  });

  it("ignores empty trailing lines", () => {
    expect(parseCsv("marca\nScania\n\n")).toHaveLength(1);
  });

  it("returns [] for a header-only or empty file", () => {
    expect(parseCsv("marca,modelo")).toEqual([]);
    expect(parseCsv("")).toEqual([]);
  });

  it("fills missing trailing cells with empty strings, never undefined", () => {
    const [row] = parseCsv("marca,modelo,km\nScania,R450");
    expect(row.km).toBe("");
  });
});
