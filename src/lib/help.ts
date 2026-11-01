// Ayuda de cada módulo (botón (i) del encabezado). Textos para el usuario: corregirlos acá.

export type HelpTopic = {
  title: string;
  /** Para qué sirve el módulo (1–3 oraciones). */
  purpose: string;
  /** Qué significa cada cosa que se ve en pantalla. */
  terms: { term: string; text: string }[];
  /** Consejos o reglas a tener en cuenta. */
  tips?: string[];
};

const CORTE = "19/10/2026";

export const HELP = {
  inicio: {
    title: "Inicio",
    purpose:
      "Resumen del negocio: tus actividades pendientes, los números del mes y una serie mensual para comparar períodos (se puede filtrar por fechas y por cliente).",
    terms: [
      { term: "Tus actividades de hoy", text: "Lo que tenés asignado en la Agenda que vence hoy o ya venció (rojo = vencida, amarillo = hoy)." },
      { term: "Recorridos del mes", text: "Cantidad de recorridos cargados en Ventas con fecha de este mes." },
      { term: "Facturado", text: "Suma de los precios de los recorridos del período." },
      { term: "Cobrado", text: "Cobros del historial más recibos vigentes (no anulados), por su fecha." },
      { term: "Saldo total a cobrar", text: `Lo que deben todos los clientes en su cuenta corriente (desde el ${CORTE}).` },
      { term: "Costos directos", text: "Pago al chofer + gasoil + pagos adicionales de los recorridos." },
      { term: "Gastos generales", text: "Gastos cargados en Finanzas → Gastos (sin los pagos de combustible) más las cargas extras de gasoil." },
      { term: "Margen", text: "Facturado menos gastos (costos directos + gastos generales)." },
      { term: "Recorridos más vendidos", text: "Los recorridos que más se hicieron en el período, por cantidad." },
    ],
  },
  agenda: {
    title: "Agenda",
    purpose:
      "Lo que hay que hacer, para cuándo y de quién es. Cada actividad se asigna a una persona y puede quedar vinculada a un contacto, una oportunidad, un vehículo o un proveedor.",
    terms: [
      { term: "Colores", text: "Rojo = vencida · amarillo = vence hoy · verde = mañana o después · gris = hecha." },
      { term: "Asignada a", text: "Quién tiene que hacerla. Podés cargarle actividades a otra persona." },
      { term: "Vence", text: "El día en que tiene que estar hecha." },
      { term: "Tipo", text: "Tarea, llamada, reunión, seguimiento, pago o mantenimiento." },
      {
        term: "Notificaciones",
        text: "Tocá la campana del menú (abajo) para recibir todos los días a las 8:00 un resumen de tus actividades vencidas y de hoy. Se activa en cada dispositivo. En iPhone, antes hay que instalar el ERP: Safari → Compartir → \"Agregar a pantalla de inicio\", y abrirlo desde ese ícono.",
      },
      { term: "Vínculo", text: "La ficha con la que se relaciona; la actividad aparece también en esa ficha." },
      { term: "Número del menú", text: "Tus actividades pendientes que vencen hoy o antes." },
    ],
    tips: [
      "En el calendario podés arrastrar una actividad a otro día para reprogramarla (en computadora).",
      "Al marcarla como hecha podés programar la siguiente en el mismo paso.",
    ],
  },
  contactos: {
    title: "Contactos",
    purpose:
      "Los clientes de Frabel: agencias con tarifario y clientes de servicios puntuales. Desde la ficha se ven sus datos, tarifario, recorridos, saldo, notas y actividades.",
    terms: [
      { term: "Recurrente", text: "Cliente con tarifario (ej. agencias). Al guardar un tarifario, el cliente pasa a ser recurrente." },
      { term: "Especial", text: "Cliente de servicios puntuales: el precio se pone a mano en cada recorrido." },
      { term: "Estado", text: "Activo o inactivo. Los inactivos no aparecen para vincular actividades." },
      { term: "Saldo", text: `Lo que debe el cliente en su cuenta corriente (desde el ${CORTE}).` },
      { term: "Tarifa", text: "Precio de un recorrido para una capacidad (categoría de 8, 14 o 18 plazas). La categoría 8 cubre de 8 a 13 pasajeros." },
      { term: "Versión del tarifario", text: "Las tarifas se guardan con fecha \"vigente desde\". Al cargar una versión nueva, la anterior se cierra el día previo y queda en el historial." },
    ],
    tips: [
      "Para un aumento usá \"Nueva versión del tarifario\" (no edites las tarifas una por una): así se conserva el historial.",
      "Cada recorrido guarda su precio: cambiar el tarifario no modifica los recorridos ya cargados, salvo que elijas recalcular.",
      "Los prospectos se manejan en Leads, no acá.",
    ],
  },
  leads: {
    title: "Leads",
    purpose:
      "Oportunidades comerciales: empresas nuevas a las que se les quiere vender y propuestas a clientes existentes. Se siguen por etapas hasta ganarlas o perderlas.",
    terms: [
      { term: "Etapas", text: "Nuevo → Contacto → Propuesta → Ganado o Perdido. En el tablero se arrastra la tarjeta para cambiar de etapa." },
      { term: "Ganado", text: "Crea el cliente en Contactos (o lo vincula si ya existe uno con el mismo nombre)." },
      { term: "Perdido", text: "Pide el motivo, para saber por qué no se concretó." },
      { term: "Monto estimado", text: "Lo que se espera facturar si se gana." },
      { term: "Monto en juego", text: "Suma de los montos estimados de las oportunidades abiertas." },
      { term: "Cierre est.", text: "Fecha en que se espera cerrar la oportunidad." },
      { term: "Próxima acción", text: "Lo próximo que hay que hacer y para cuándo; si ya pasó la fecha cuenta como vencida." },
      { term: "Responsable / Prioridad", text: "Quién la sigue y qué tan importante es (alta, media, baja)." },
    ],
  },
  ventas: {
    title: "Ventas",
    purpose:
      "Los recorridos realizados: a qué cliente, qué recorrido, cuántos pasajeros, quién manejó, con qué vehículo, a qué precio y cuánto costó.",
    terms: [
      { term: "Pax", text: "Pasajeros que viajaron." },
      { term: "Cap.", text: "Capacidad o categoría tarifaria (8, 14 o 18 plazas). Define la tarifa; no es lo mismo que pasajeros (15 pax puede ir en 14 o en 18)." },
      { term: "Precio", text: "En clientes recurrentes se toma del tarifario (cliente + recorrido + capacidad); en especiales se escribe a mano. Queda guardado en el recorrido." },
      { term: "Vehículo", text: "La unidad que salió. Es solo un dato: no cambia la tarifa (por mantenimiento puede salir una más grande)." },
      { term: "Pago chofer / Gasoil / Adicionales", text: "Costos directos del recorrido. El gasoil indica además en qué estación se cargó." },
      { term: "Margen", text: "Facturado menos costos directos de los recorridos filtrados." },
      { term: "El cliente ya pagó / pago parcial", text: "Al cargar un recorrido nuevo, crea en el mismo paso un recibo por el total o por lo que pagó." },
    ],
    tips: [
      "Un recorrido que ya está en una factura, comprobante interno o recibo vigente no puede cambiar precio, cliente ni fecha: primero hay que anular ese comprobante.",
    ],
  },
  flota: {
    title: "Flota",
    purpose:
      "Vehículos y choferes, con lo que facturó y costó cada uno en el período. Desde la patente se abre la ficha del vehículo con sus actividades (mantenimiento, VTV, etc.) y gastos.",
    terms: [
      { term: "Plazas", text: "Asientos del vehículo. Es informativo: la tarifa la define la capacidad del recorrido." },
      { term: "Facturado", text: "Suma de los precios de los recorridos que hizo la unidad." },
      { term: "Gasoil / Choferes", text: "Gasoil y pagos a choferes de esos recorridos." },
      { term: "Gastos", text: "Gastos cargados para el vehículo (sin combustible) más los pagos adicionales de sus recorridos." },
      { term: "Margen", text: "Facturado − gasoil − choferes − gastos de la unidad." },
      { term: "Punto de color", text: "La próxima actividad pendiente del vehículo (rojo vencida, amarillo hoy, verde más adelante)." },
      { term: "Pago al chofer", text: "Lo que se le pagó a cada chofer por sus recorridos en el período." },
    ],
  },
  cuentas: {
    title: "Cuentas corrientes",
    purpose: `Lo que debe cada cliente. La cuenta corriente arranca el ${CORTE}: lo anterior solo cuenta si se cargó como saldo inicial.`,
    terms: [
      { term: "Facturado", text: "Recorridos desde el corte + notas de débito + saldo inicial." },
      { term: "Cobrado", text: "Recibos vigentes (y cobros del historial desde el corte)." },
      { term: "Ajustes", text: "Notas de crédito, bonificaciones y ajustes: bajan la deuda sin contar como cobrado." },
      { term: "Saldo", text: "Facturado − cobrado − ajustes. Positivo = el cliente debe." },
      { term: "Debe / Haber", text: "En el estado de cuenta: Debe suma a la deuda (recorridos, notas de débito), Haber la baja (recibos, notas de crédito)." },
      { term: "Pendiente", text: "Lo que falta pagar de cada recorrido. Los pagos sin asignar a un recorrido se aplican a lo más viejo." },
      { term: "Vence", text: "La fecha de vencimiento de la factura o comprobante interno que lo incluye; si no tiene, la fecha del recorrido + los días de pago del cliente." },
    ],
    tips: ["Las facturas y comprobantes internos no suman deuda: agrupan recorridos y les dan vencimiento."],
  },
  recibos: {
    title: "Recibos",
    purpose:
      "Los pagos de los clientes. Cada pago se registra con un recibo numerado (X 0001-…) que se puede imprimir o mandar en PDF.",
    terms: [
      { term: "Número", text: "Correlativo y automático. Nunca se reutiliza, ni siquiera si el recibo se anula." },
      { term: "Recorridos tildados", text: `Los recorridos que paga el recibo (solo desde el ${CORTE} y con saldo pendiente).` },
      { term: "A cuenta", text: "La parte del monto que no se asigna a un recorrido: se aplica a lo más viejo que deba el cliente." },
      { term: "Medio", text: "Transferencia, efectivo, cheque, Mercado Pago u otro." },
      { term: "Anulado", text: "Un recibo no se edita ni se borra: se anula con un motivo y deja de contar en el saldo." },
    ],
    tips: ["Si te equivocaste, anulá el recibo y cargá uno nuevo."],
  },
  comprobantes: {
    title: "Comprobantes",
    purpose:
      "Los documentos de la cuenta corriente de cada cliente. Las facturas se hacen en ARCA; acá se registran para saber qué recorridos cubren y cuándo vencen.",
    terms: [
      { term: "Factura", text: "Registro de la factura hecha en ARCA. Agrupa recorridos y da el vencimiento; no suma deuda (ya la suman los recorridos)." },
      { term: "Comprobante interno", text: "Como la factura pero sin factura fiscal (para clientes que no la piden)." },
      { term: "Nota de débito", text: "Suma deuda al cliente (ej. un cargo extra)." },
      { term: "Nota de crédito / Bonificación", text: "Bajan la deuda del cliente (devolución, descuento)." },
      { term: "Saldo inicial", text: `Lo que el cliente debía antes del ${CORTE}, para arrancar la cuenta corriente.` },
      { term: "Anulado", text: "No se edita ni se borra: se anula, deja de contar y libera sus recorridos. El número no se reutiliza." },
    ],
    tips: ["Un recorrido puede estar en una sola factura o comprobante interno vigente."],
  },
  cobros: {
    title: "Cobros (historial)",
    purpose:
      "Los cobros registrados antes de la cuenta corriente. Es solo para consulta: los pagos nuevos se cargan como recibos.",
    terms: [
      { term: "Cobro", text: "Plata que entró del cliente." },
      { term: "Ajuste", text: "Corrección que baja el saldo histórico sin contar como cobrado." },
    ],
  },
  gastos: {
    title: "Gastos",
    purpose:
      "Lo que paga la empresa (vehículos, personal, gastos generales) y el control de combustible por estación de servicio.",
    terms: [
      { term: "Alcance", text: "General (de la empresa) o Vehículo (de una unidad: suma en Flota)." },
      { term: "Categoría", text: "Vehículo, personal, generales o combustible. La subcategoría detalla (mantenimiento, sueldos, alquiler…)." },
      { term: "Combustible", text: "Pago a una estación del gasoil ya cargado en los recorridos. No se cuenta como gasto en los reportes, para no contarlo dos veces." },
      { term: "Contado / A pagar", text: "Contado = ya se pagó. A pagar = queda como deuda en la cuenta del proveedor." },
      { term: "Comprobante", text: "Factura A, B o C, recibo, ticket o sin comprobante." },
      { term: "Control de combustible", text: "Por estación: gasoil de los recorridos + cargas extras − pagos = saldo que se le debe." },
      { term: "Cargas extras", text: "Gasoil cargado fuera de un recorrido (no queda asociado a ninguno)." },
    ],
  },
  proveedores: {
    title: "Proveedores",
    purpose: "Los proveedores de la empresa y cuánto se les debe. Desde la ficha se ven sus movimientos y se registran los pagos.",
    terms: [
      { term: "Rubro", text: "A qué se dedica (combustible, mecánica, repuestos, seguros…)." },
      { term: "Factura", text: "Si el proveedor entrega factura o no." },
      { term: "Saldo", text: "Gastos \"a pagar\" + consumo de combustible (en estaciones) − pagos registrados. Positivo = se le debe." },
      { term: "Debe / Haber", text: "En la ficha: Debe = lo que se le compró a pagar; Haber = lo que se le pagó." },
    ],
  },
} satisfies Record<string, HelpTopic>;

export type HelpKey = keyof typeof HELP;
