import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Pencil } from "lucide-react";
import { OpportunityStageBadge } from "@/components/badges";
import { ConfirmButton } from "@/components/confirm-button";
import { FormDialog } from "@/components/form-dialog";
import { ActivitiesPanel } from "@/components/activities-panel";
import { AuditInfo } from "@/components/audit-info";
import { mergeNotes, NotesPanel } from "@/components/notes-panel";
import { PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { clientNotes, clients, leadNotes, leads, users } from "@/db/schema";
import { LEAD_PRIORITY_LABELS, type LeadPriority } from "@/lib/constants";
import { dayInAR, formatDate, formatMoney, today } from "@/lib/format";
import { getUserNames } from "@/lib/audit";
import { leadFormOptions, userName } from "@/lib/lead-options";
import { isClosed, isOverdue } from "@/lib/leads";
import { can, requirePermission } from "@/lib/permissions";
import { canDeleteNote } from "@/lib/prospects";
import { addLeadNote, changeLeadStage, deleteLead, deleteLeadNote, updateLead } from "../actions";
import { LeadFields } from "../lead-fields";
import { StageControl } from "../stage-fields";

// Compartido entre generateMetadata y la página: una sola consulta por request.
const getLead = cache(async (id: number) => {
  const [row] = await db
    .select({ lead: leads, owner: userName, clientName: clients.name, clientType: clients.type })
    .from(leads)
    .leftJoin(users, eq(users.id, leads.ownerId))
    .leftJoin(clients, eq(clients.id, leads.clientId))
    .where(eq(leads.id, id));
  return row;
});

export async function generateMetadata({ params }: PageProps<"/leads/[id]">): Promise<Metadata> {
  const id = Number((await params).id);
  const row = Number.isInteger(id) ? await getLead(id) : undefined;
  return { title: row?.lead.title ?? "Oportunidad" };
}

export default async function LeadPage({ params }: PageProps<"/leads/[id]">) {
  const user = await requirePermission("leads");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const [row, notes, options, contactNotes, names] = await Promise.all([
    getLead(id),
    db
      .select({
        id: leadNotes.id,
        date: leadNotes.date,
        text: leadNotes.text,
        auto: leadNotes.auto,
        userId: leadNotes.userId,
        author: userName,
      })
      .from(leadNotes)
      .leftJoin(users, eq(users.id, leadNotes.userId))
      .where(eq(leadNotes.leadId, id))
      .orderBy(desc(leadNotes.date), desc(leadNotes.id)),
    leadFormOptions(),
    // Notas del contacto vinculado (si hay), para ver toda la historia del cliente.
    db
      .select({
        id: clientNotes.id,
        date: clientNotes.date,
        text: clientNotes.text,
        auto: clientNotes.auto,
        author: userName,
      })
      .from(clientNotes)
      .innerJoin(leads, eq(leads.clientId, clientNotes.clientId))
      .leftJoin(users, eq(users.id, clientNotes.userId))
      .where(eq(leads.id, id)),
    getUserNames(),
  ]);
  if (!row) notFound();
  const { lead } = row;
  const canEdit = can(user, "leads", "edit");
  const canContacts = can(user, "contactos", "view");
  const date = today();
  const overdue = isOverdue(lead, date);
  const priority = lead.priority as LeadPriority | null;
  const allNotes = mergeNotes(
    notes.map((n) => ({
      key: `l${n.id}`,
      ...n,
      onDelete: canEdit && canDeleteNote(n, user.id) ? deleteLeadNote.bind(null, id, n.id) : undefined,
    })),
    contactNotes.map((n) => ({
      key: `c${n.id}`,
      ...n,
      source: { label: "Contacto", href: canContacts ? `/contactos/${lead.clientId}?tab=notas` : undefined },
    })),
  );
  // El cliente vinculado puede ser un potencial (no figura en las opciones): sumarlo para no desvincularlo al editar.
  const clientOptions =
    lead.clientId && row.clientName && !options.clientOptions.some((c) => c.id === lead.clientId)
      ? [{ id: lead.clientId, name: row.clientName }, ...options.clientOptions]
      : options.clientOptions;

  const info: [string, React.ReactNode][] = [
    ["Empresa", lead.company],
    ["Persona de contacto", lead.contactPerson],
    ["Teléfono", lead.phone],
    ["Email", lead.email],
    [
      "Sitio web",
      lead.website && (
        <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="hover:underline">
          {lead.website}
        </a>
      ),
    ],
    ["Dirección", lead.address],
    ["Segmento", lead.segment],
    ["Prioridad", priority && (LEAD_PRIORITY_LABELS[priority] ?? priority)],
    ["Responsable", row.owner],
    ["Cierre estimado", lead.expectedClose && formatDate(lead.expectedClose)],
    ["Fecha de cierre", lead.closedAt && formatDate(lead.closedAt)],
    ["Motivo de pérdida", lead.lostReason],
  ];

  return (
    <>
      <Button variant="ghost" size="sm" className="w-fit" asChild>
        <Link href="/leads">
          <ArrowLeft /> Leads
        </Link>
      </Button>
      <PageHeader help="leads"
        title={
          <span className="flex flex-wrap items-center gap-2">
            {lead.title} <OpportunityStageBadge stage={lead.stage} />
          </span>
        }
        description={
          row.clientName ? (
            <>
              Cliente:{" "}
              {canContacts ? (
                <Link href={`/contactos/${lead.clientId}`} className="underline">
                  {row.clientName}
                </Link>
              ) : (
                row.clientName
              )}
            </>
          ) : (
            "Prospecto nuevo"
          )
        }
        actions={
          canEdit && (
            <>
              <StageControl
                current={lead.stage}
                needsType={!row.clientType || row.clientType === "potencial"}
                action={changeLeadStage.bind(null, id)}
              />
              <FormDialog
                title="Editar oportunidad"
                action={updateLead.bind(null, id)}
                className="sm:max-w-2xl"
                trigger={
                  <Button variant="outline">
                    <Pencil /> Editar
                  </Button>
                }
              >
                <LeadFields
                  key={lead.updatedAt.getTime()}
                  lead={lead}
                  clientOptions={clientOptions}
                  userOptions={options.userOptions}
                />
                <AuditInfo row={lead} names={names} />
              </FormDialog>
              <ConfirmButton
                action={deleteLead.bind(null, id)}
                title="¿Eliminar oportunidad?"
                description="Se borra con su seguimiento. El cliente vinculado (si hay) no se toca."
              />
            </>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Monto estimado" value={formatMoney(lead.expectedAmount)} />
        <StatCard
          label="Próxima acción"
          value={
            <span className={`text-base ${overdue ? "text-destructive" : ""}`}>
              {lead.nextActionDate ? formatDate(lead.nextActionDate) : "—"}
            </span>
          }
          hint={isClosed(lead.stage) ? "Oportunidad cerrada" : (lead.nextAction ?? (overdue ? "Vencida" : undefined))}
        />
        <StatCard label="Creada" value={<span className="text-base">{formatDate(dayInAR(lead.createdAt))}</span>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="grid content-start gap-3">
          <h2 className="font-semibold">Datos</h2>
          <dl className="grid gap-2 rounded-xl border p-4 text-sm">
            {info
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="grid grid-cols-[10rem_1fr] gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
          </dl>
          {lead.notes && (
            <div className="whitespace-pre-wrap rounded-xl border p-4 text-sm text-muted-foreground">{lead.notes}</div>
          )}
          <AuditInfo row={lead} names={names} />
        </section>

        <section className="grid content-start gap-3">
          <h2 className="font-semibold">Actividades</h2>
          <ActivitiesPanel link={{ field: "leadId", id, label: lead.title }} currentUserId={user.id} />
          <h2 className="pt-4 font-semibold">Notas</h2>
          <NotesPanel notes={allNotes} addAction={canEdit ? addLeadNote.bind(null, id) : undefined} date={date} />
        </section>
      </div>
    </>
  );
}
