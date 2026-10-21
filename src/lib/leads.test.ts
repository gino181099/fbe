import { describe, expect, it } from "vitest";
import { isOverdue, moveLead, stageTotals } from "./leads";

const date = "2026-10-20";

describe("moveLead", () => {
  it("mueve entre etapas abiertas con nota automática", () => {
    const r = moveLead("nuevo", "propuesta", { date, client: null });
    expect(r).toMatchObject({ ok: true, stage: "propuesta", closedAt: null, client: { action: "none" } });
    if (r.ok) expect(r.noteText).toBe("Etapa: Nuevo → Propuesta");
  });

  it("rechaza la misma etapa", () => {
    expect(moveLead("contacto", "contacto", { date, client: null }).ok).toBe(false);
  });

  it("ganado sin cliente exige tipo y crea el cliente", () => {
    expect(moveLead("propuesta", "ganado", { date, client: null }).ok).toBe(false);
    const r = moveLead("propuesta", "ganado", { date, client: null, type: "especial" });
    expect(r).toMatchObject({ ok: true, closedAt: date, client: { action: "create", type: "especial" } });
    if (r.ok) expect(r.noteText).toContain("(Especial)");
  });

  it("ganado con cliente potencial lo convierte", () => {
    const r = moveLead("contacto", "ganado", { date, client: { type: "potencial" }, type: "recurrente" });
    expect(r).toMatchObject({ ok: true, client: { action: "convert", type: "recurrente" } });
  });

  it("ganado con cliente existente no pide tipo ni toca el cliente", () => {
    const r = moveLead("propuesta", "ganado", { date, client: { type: "recurrente" } });
    expect(r).toMatchObject({ ok: true, closedAt: date, client: { action: "none" } });
  });

  it("perdido exige motivo e inactiva solo a un potencial", () => {
    expect(moveLead("nuevo", "perdido", { date, client: null, lostReason: "  " }).ok).toBe(false);
    const p = moveLead("nuevo", "perdido", { date, client: { type: "potencial" }, lostReason: "Precio" });
    expect(p).toMatchObject({ ok: true, lostReason: "Precio", closedAt: date, client: { action: "lose" } });
    const e = moveLead("nuevo", "perdido", { date, client: { type: "especial" }, lostReason: "Precio" });
    expect(e).toMatchObject({ ok: true, client: { action: "none" } });
  });

  it("reabrir: solo a contacto/propuesta, y limpia el cierre", () => {
    expect(moveLead("perdido", "ganado", { date, client: null, type: "especial" }).ok).toBe(false);
    expect(moveLead("ganado", "nuevo", { date, client: null }).ok).toBe(false);
    expect(moveLead("perdido", "propuesta", { date, client: null })).toMatchObject({
      ok: true,
      closedAt: null,
      lostReason: null,
    });
  });
});

describe("isOverdue", () => {
  it("vencida solo si está abierta y la fecha pasó", () => {
    expect(isOverdue({ stage: "contacto", nextActionDate: "2026-10-19" }, date)).toBe(true);
    expect(isOverdue({ stage: "contacto", nextActionDate: date }, date)).toBe(false);
    expect(isOverdue({ stage: "ganado", nextActionDate: "2026-01-01" }, date)).toBe(false);
    expect(isOverdue({ stage: "nuevo", nextActionDate: null }, date)).toBe(false);
  });
});

describe("stageTotals", () => {
  it("cuenta y suma montos por etapa (null = 0)", () => {
    const t = stageTotals([
      { stage: "nuevo", expectedAmount: 100 },
      { stage: "nuevo", expectedAmount: null },
      { stage: "propuesta", expectedAmount: 50.5 },
    ]);
    expect(t.nuevo).toEqual({ count: 2, amount: 100 });
    expect(t.propuesta).toEqual({ count: 1, amount: 50.5 });
    expect(t.ganado).toEqual({ count: 0, amount: 0 });
  });
});
