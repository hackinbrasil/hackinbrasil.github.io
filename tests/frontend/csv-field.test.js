import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = fs.readFileSync(path.join(ROOT, "assets", "js", "form-utils.js"), "utf8");
const { csvField } = new Function("window", `${src}; return window.HIBForms;`)({});

describe("csvField", () => {
  it("always quotes plain values", () => {
    expect(csvField("Maria Silva")).toBe('"Maria Silva"');
    expect(csvField(null)).toBe('""');
  });

  it("quotes CSV-structural characters", () => {
    expect(csvField('Silva, "Zé"')).toBe('"Silva, ""Zé"""');
  });

  it.each(["=1+1", "+1", "-1", "@SUM(A1)", '=HYPERLINK("http://evil","x")', " =1+1", "\t=1+1", "\r=1+1"])(
    "neutralizes formula-leading value %j",
    (value) => {
      const out = csvField(value);
      expect(out).toMatch(/^"'/);
    }
  );

  it("does not alter formula characters in the middle", () => {
    expect(csvField("a=b")).toBe('"a=b"');
  });

  // Alternate-delimiter bypass: an unquoted "Alice;=1+1;X" is split by a
  // semicolon-delimited import (pt-BR Excel) and exposes "=1+1" as a cell.
  it.each(["Alice;=1+1;X", "Ana\t=1+1", "Ana|=1+1", "a,=1+1"])(
    "keeps delimiter-containing value %j inside one quoted cell",
    (value) => {
      const out = csvField(value);
      expect(out.startsWith('"') && out.endsWith('"')).toBe(true);
      expect(out.slice(1, -1)).toBe(value);
    }
  );
});
