import { describe, expect, it } from "vitest";
import { agendaDigest } from "./agenda-digest";

const today = "2026-11-02";

describe("agendaDigest", () => {
  it("sin pendientes vencidas ni de hoy no manda nada", () => {
    expect(agendaDigest([], today)).toBeNull();
    expect(agendaDigest([{ title: "Mañana", dueDate: "2026-11-03" }], today)).toBeNull();
  });

  it("cuenta vencidas y de hoy", () => {
    const d = agendaDigest(
      [
        { title: "Llamar a Huentata", dueDate: today },
        { title: "Service Sprinter", dueDate: "2026-10-30" },
        { title: "Cobrar City Tours", dueDate: "2026-11-01" },
      ],
      today,
    );
    expect(d).toEqual({
      title: "Agenda: 2 vencidas y 1 para hoy",
      body: "Service Sprinter · Cobrar City Tours · Llamar a Huentata",
    });
  });

  it("singular y solo hoy", () => {
    expect(agendaDigest([{ title: "Visita", dueDate: today }], today)?.title).toBe("Agenda: 1 para hoy");
    expect(agendaDigest([{ title: "Visita", dueDate: "2026-11-01" }], today)?.title).toBe("Agenda: 1 vencida");
  });

  it("muestra hasta 3 títulos y cuántos más hay", () => {
    const items = ["A", "B", "C", "D", "E"].map((title) => ({ title, dueDate: today }));
    expect(agendaDigest(items, today)?.body).toBe("A · B · C y 2 más");
  });
});
