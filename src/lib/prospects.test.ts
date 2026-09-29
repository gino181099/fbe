import { describe, expect, it } from "vitest";
import { canDeleteNote, formLeadStage, mapProspect, normalizeName, stageTransition } from "./prospects";

describe("mapProspect", () => {
  const base = {
    nombre: "  Nites Incoming ",
    segmento: "bodegas_turismo",
    rubro: "agencia receptiva",
    sitio_web: "https://nites.com/",
    ubicacion: "Mendoza",
    descripcion: "Receptivo",
    motivo_encaje: "Mueve grupos",
    angulo_venta: "Landing Bodegas",
    encaje: 5,
    puntaje: 15,
    prioridad: "alta",
    contacto: {
      emails: ["reservas@nites.travel", "grupos@nites.travel"],
      telefonos: ["+549261111", "0810999"],
      whatsapp: ["+549261111"],
      redes: { instagram: "https://instagram.com/nites", facebook: null },
    },
  };

  it("mapea los campos fijos y principales", () => {
    const r = mapProspect(base);
    expect(r).toMatchObject({
      name: "Nites Incoming",
      type: "potencial",
      status: "potencial",
      leadStage: "sin_contactar",
      email: "reservas@nites.travel",
      phone: "+549261111",
      address: "Mendoza",
      website: "https://nites.com/",
      segment: "bodegas_turismo",
      leadPriority: "alta",
    });
  });

  it("arma las notas con el resto de los datos", () => {
    const notes = mapProspect(base).notes!;
    expect(notes).toContain("Rubro: agencia receptiva");
    expect(notes).toContain("Otros emails: grupos@nites.travel");
    expect(notes).toContain("Otros teléfonos: 0810999");
    expect(notes).toContain("WhatsApp: +549261111");
    expect(notes).toContain("Redes: instagram: https://instagram.com/nites");
    expect(notes).not.toContain("facebook");
    expect(notes).toContain("Puntaje/Encaje: puntaje 15, encaje 5/5");
  });

  it("sin whatsapp usa el primer teléfono; dirección antes que ubicación; email inválido → null", () => {
    const r = mapProspect({
      nombre: "X",
      direccion: "25 de Mayo 1078",
      ubicacion: "Mendoza",
      prioridad: "urgente",
      notas: "Sin email público",
      contacto: { emails: ["no-es-mail"], telefonos: ["261-5555"] },
    });
    expect(r.phone).toBe("261-5555");
    expect(r.address).toBe("25 de Mayo 1078");
    expect(r.email).toBeNull();
    expect(r.leadPriority).toBeNull();
    expect(r.notes).toContain("Otros emails: no-es-mail");
    expect(r.notes).toContain("Notas del relevamiento: Sin email público");
  });

  it("sin contacto deja todo en null", () => {
    const r = mapProspect({ nombre: "Y" });
    expect(r.email).toBeNull();
    expect(r.phone).toBeNull();
    expect(r.notes).toBeNull();
  });
});

describe("normalizeName", () => {
  it("compara sin mayúsculas ni espacios de los bordes", () => {
    expect(normalizeName("  Impulsa Mendoza ")).toBe(normalizeName("impulsa mendoza"));
  });
});

describe("stageTransition", () => {
  it("contactado solo cambia la etapa", () => {
    expect(stageTransition("sin_contactar", "contactado")).toEqual({
      ok: true,
      status: "potencial",
      leadStage: "contactado",
      type: "potencial",
      noteText: "Etapa: Sin contactar → Contactado",
    });
  });

  it("perdido inactiva y conserva el tipo potencial", () => {
    expect(stageTransition("contactado", "perdido")).toMatchObject({ ok: true, status: "inactivo", type: "potencial" });
  });

  it("reabrir un perdido vuelve a potencial", () => {
    expect(stageTransition("perdido", "contactado")).toMatchObject({
      ok: true,
      status: "potencial",
      leadStage: "contactado",
      type: "potencial",
    });
  });

  it("ganado exige recurrente o especial", () => {
    expect(stageTransition("contactado", "ganado").ok).toBe(false);
    expect(stageTransition("contactado", "ganado", "potencial").ok).toBe(false);
    expect(stageTransition("contactado", "ganado", "especial")).toEqual({
      ok: true,
      status: "activo",
      leadStage: "ganado",
      type: "especial",
      noteText: "Etapa: Contactado → Ganado (Especial)",
    });
  });

  it("rechaza la misma etapa y salir de ganado", () => {
    expect(stageTransition("contactado", "contactado").ok).toBe(false);
    expect(stageTransition("ganado", "perdido").ok).toBe(false);
  });
});

describe("formLeadStage", () => {
  it("estado potencial exige tipo potencial", () => {
    expect(formLeadStage("especial", "potencial", null).ok).toBe(false);
    expect(formLeadStage("potencial", "potencial", null)).toEqual({ ok: true, leadStage: "sin_contactar" });
    expect(formLeadStage("potencial", "potencial", "contactado")).toEqual({ ok: true, leadStage: "contactado" });
  });

  it("un activo no puede ser potencial", () => {
    expect(formLeadStage("potencial", "activo", "contactado").ok).toBe(false);
  });

  it("potencial inactivo = perdido; salir del embudo = ganado; sin embudo queda igual", () => {
    expect(formLeadStage("potencial", "inactivo", "contactado")).toEqual({ ok: true, leadStage: "perdido" });
    expect(formLeadStage("especial", "activo", "contactado")).toEqual({ ok: true, leadStage: "ganado" });
    expect(formLeadStage("recurrente", "activo", null)).toEqual({ ok: true, leadStage: null });
  });

  it("un cliente con recorridos no puede pasar a potencial", () => {
    const r = formLeadStage("potencial", "potencial", null, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/No se puede pasar a Potencial/);
    expect(formLeadStage("potencial", "inactivo", "ganado", true).ok).toBe(false);
    expect(formLeadStage("especial", "activo", null, true)).toEqual({ ok: true, leadStage: null });
  });
});

describe("canDeleteNote", () => {
  it("solo el autor borra notas manuales", () => {
    expect(canDeleteNote({ auto: false, userId: "u1" }, "u1")).toBe(true);
    expect(canDeleteNote({ auto: false, userId: "u1" }, "u2")).toBe(false);
    expect(canDeleteNote({ auto: false, userId: null }, "u1")).toBe(false);
  });

  it("las automáticas no se borran nunca", () => {
    expect(canDeleteNote({ auto: true, userId: "u1" }, "u1")).toBe(false);
    expect(canDeleteNote({ auto: true, userId: null }, null)).toBe(false);
  });
});
