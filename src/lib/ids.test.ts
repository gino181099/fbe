import { describe, expect, it } from "vitest";
import { parseId } from "./ids";

describe("parseId", () => {
  it("acepta enteros positivos en rango", () => {
    expect(parseId("1")).toBe(1);
    expect(parseId("2147483647")).toBe(2147483647);
  });
  it("rechaza lo que rompería la consulta", () => {
    for (const v of ["99999999999", "2147483648", "0", "-1", "1.5", "abc", "1e3", "", null, undefined]) {
      expect(parseId(v)).toBeNull();
    }
  });
});
