import { describe, expect, it } from "vitest";
import { activityColor } from "./activity-bucket";
import { monthGrid, monthLabel, parseMonth, shiftMonth } from "./calendar";

describe("monthGrid", () => {
  it("octubre 2026: arranca el lunes 28/9 y termina el domingo 1/11", () => {
    const g = monthGrid("2026-10");
    expect(g[0][0]).toBe("2026-09-28");
    expect(g.at(-1)!.at(-1)).toBe("2026-11-01");
    expect(g).toHaveLength(5);
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
  it("mes que empieza en lunes no agrega días del anterior", () => {
    expect(monthGrid("2026-06")[0][0]).toBe("2026-06-01");
  });
  it("febrero de 4 semanas exactas (2027 empieza lunes)", () => {
    const g = monthGrid("2027-02");
    expect(g).toHaveLength(4);
    expect(g.at(-1)!.at(-1)).toBe("2027-02-28");
  });
  it("mes de 6 semanas", () => expect(monthGrid("2026-08")).toHaveLength(6));
});

describe("meses", () => {
  it("shiftMonth cruza de año", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("parseMonth y monthLabel", () => {
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("2026-10")).toBe("2026-10");
    expect(monthLabel("2026-10")).toBe("Octubre 2026");
  });
});

describe("activityColor (colores de Odoo)", () => {
  const today = "2026-10-25";
  it("rojo vencida, amarillo hoy, verde mañana o después, gris hecha", () => {
    expect(activityColor("2026-10-24", today)).toBe("red");
    expect(activityColor(today, today)).toBe("yellow");
    expect(activityColor("2026-10-26", today)).toBe("green");
    expect(activityColor("2026-12-01", today)).toBe("green");
    expect(activityColor("2026-10-24", today, true)).toBe("done");
  });
});
