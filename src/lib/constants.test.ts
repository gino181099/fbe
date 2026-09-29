import { describe, expect, it } from "vitest";
import { normalizePlate } from "./constants";

describe("normalizePlate", () => {
  it("pasa a mayúsculas y quita espacios y guiones", () => {
    expect(normalizePlate("ah 115 dl")).toBe("AH115DL");
    expect(normalizePlate(" zz-999-zz ")).toBe("ZZ999ZZ");
  });

  it("deja igual una patente ya normalizada", () => {
    expect(normalizePlate("AG632FM")).toBe("AG632FM");
  });
});
