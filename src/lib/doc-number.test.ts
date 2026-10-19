import { describe, expect, it } from "vitest";
import { formatDocNumber } from "./doc-number";

describe("formatDocNumber", () => {
  it("letra, punto de venta de 4 y número de 8 dígitos", () => {
    expect(formatDocNumber("X", 1, 1)).toBe("X 0001-00000001");
    expect(formatDocNumber("A", 12, 99)).toBe("A 0012-00000099");
    expect(formatDocNumber("B", 99999, 99999999)).toBe("B 99999-99999999");
  });

  it("muestra lo que haya", () => {
    expect(formatDocNumber("C", null, 7)).toBe("C 00000007");
    expect(formatDocNumber(null, 3, 7)).toBe("0003-00000007");
    expect(formatDocNumber("A", null, null)).toBe("A");
    expect(formatDocNumber(null, null, null)).toBe("");
    expect(formatDocNumber(undefined, undefined, undefined)).toBe("");
  });
});
