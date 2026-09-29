import { describe, expect, it } from "vitest";
import { addDays, formatMoney } from "./format";

/** `Intl` separa "$" del número con un espacio no separable. */
const money = (n: number | null | undefined) => formatMoney(n).replace(/ /g, " ");

describe("formatMoney", () => {
  it("muestra enteros sin decimales", () => {
    expect(money(150000)).toBe("$ 150.000");
  });

  it("muestra centavos cuando los hay", () => {
    expect(money(150000.5)).toBe("$ 150.000,50");
  });

  it("devuelve — para null y undefined", () => {
    expect(money(null)).toBe("—");
    expect(money(undefined)).toBe("—");
  });
});

describe("addDays", () => {
  it("resta un día cruzando de mes", () => {
    expect(addDays("2025-03-01", -1)).toBe("2025-02-28");
  });

  it("respeta el año bisiesto", () => {
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("cruza de año en ambos sentidos", () => {
    expect(addDays("2025-01-01", -1)).toBe("2024-12-31");
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01");
  });
});
