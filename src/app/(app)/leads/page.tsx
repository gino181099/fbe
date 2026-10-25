import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, gte, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { Columns3, List, Plus } from "lucide-react";
import { OpportunityStageBadge } from "@/components/badges";
import { FormDialog } from "@/components/form-dialog";
import { EmptyState, PageHeader, StatCard } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { OPPORTUNITY_STAGES, clients, leads, users } from "@/db/schema";
import { LEAD_PRIORITIES, LEAD_PRIORITY_LABELS, OPPORTUNITY_STAGE_LABELS, type LeadPriority } from "@/lib/constants";
import { addDays, formatDate, formatMoney, today } from "@/lib/format";
import { leadFormOptions, userName } from "@/lib/lead-options";
import { isOverdue, OPEN_STAGES } from "@/lib/leads";
import { can, requirePermission } from "@/lib/permissions";
import { createLead } from "./actions";
import { type KanbanCard, KanbanBoard } from "./kanban-board";
import { LeadFields } from "./lead-fields";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const user = await requirePermission("leads");
  const sp = await searchParams;
  const list = sp.vista === "lista";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const owner = typeof sp.responsable === "string" ? sp.responsable : "";
  const prioridad = LEAD_PRIORITIES.find((p) => p === sp.prioridad);
  const segmento = typeof sp.segmento === "string" ? sp.segmento : "";
  const etapa = OPPORTUNITY_STAGES.find((s) => s === sp.etapa);
  const date = today();

  const filters: SQL[] = [];
  if (q)
    filters.push(
      or(ilike(leads.title, `%${q}%`), ilike(leads.company, `%${q}%`), ilike(leads.contactPerson, `%${q}%`))!,
    );
  if (owner) filters.push(eq(leads.ownerId, owner));
  if (prioridad) filters.push(eq(leads.priority, prioridad));
  if (segmento) filters.push(eq(leads.segment, segmento));
  if (etapa) filters.push(eq(leads.stage, etapa));
  const filtered = filters.length > 0;
  // En el tablero, los cerrados solo de los últimos 90 días (salvo que se filtre).
  if (!list && !filtered) filters.push(or(inArray(leads.stage, [...OPEN_STAGES]), gte(leads.closedAt, addDays(date, -90)))!);

  const [rows, segments, options] = await Promise.all([
    db
      .select({
        id: leads.id,
        title: leads.title,
        company: leads.company,
        contactPerson: leads.contactPerson,
        stage: leads.stage,
        expectedAmount: leads.expectedAmount,
        expectedClose: leads.expectedClose,
        priority: leads.priority,
        nextAction: leads.nextAction,
        nextActionDate: leads.nextActionDate,
        owner: userName,
        clientType: clients.type,
      })
      .from(leads)
      .leftJoin(users, eq(users.id, leads.ownerId))
      .leftJoin(clients, eq(clients.id, leads.clientId))
      .where(and(...filters))
      .orderBy(sql`${leads.nextActionDate} asc nulls last`, desc(leads.updatedAt)),
    db
      .selectDistinct({ segment: leads.segment })
      .from(leads)
      .where(sql`${leads.segment} is not null`)
      .orderBy(asc(leads.segment)),
    leadFormOptions(),
  ]);
  const canEdit = can(user, "leads", "edit");

  const open = rows.filter((r) => OPEN_STAGES.includes(r.stage));
  const pipeline = open.reduce((s, r) => s + (r.expectedAmount ?? 0), 0);
  const overdue = open.filter((r) => isOverdue(r, date)).length;
  const cards: KanbanCard[] = rows.map((r) => ({ ...r, needsType: !r.clientType || r.clientType === "potencial" }));

  const params = new URLSearchParams(
    Object.entries({ q, responsable: owner, prioridad, segmento, etapa }).filter(([, v]) => v) as [string, string][],
  );
  const viewHref = (lista: boolean) => {
    const p = new URLSearchParams(params);
    if (lista) p.set("vista", "lista");
    const s = p.toString();
    return s ? `/leads?${s}` : "/leads";
  };

  return (
    <>
      <PageHeader help="leads"
        title="Leads"
        description="Oportunidades comerciales: prospectos nuevos y propuestas a clientes."
        actions={
          <>
            <div className="flex rounded-lg border p-0.5">
              <Button variant={list ? "ghost" : "secondary"} size="sm" asChild>
                <Link href={viewHref(false)}>
                  <Columns3 /> Tablero
                </Link>
              </Button>
              <Button variant={list ? "secondary" : "ghost"} size="sm" asChild>
                <Link href={viewHref(true)}>
                  <List /> Lista
                </Link>
              </Button>
            </div>
            {canEdit && (
              <FormDialog
                title="Nueva oportunidad"
                action={createLead}
                className="sm:max-w-2xl"
                trigger={
                  <Button>
                    <Plus /> Nueva oportunidad
                  </Button>
                }
              >
                <LeadFields {...options} defaultOwnerId={user.id} />
              </FormDialog>
            )}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Abiertas" value={open.length} />
        <StatCard label="Monto en juego" value={formatMoney(pipeline)} hint="Suma de montos estimados abiertos" />
        <StatCard label="Próximas acciones vencidas" value={overdue} />
      </div>

      <form className="flex flex-wrap items-end gap-2">
        {list && <input type="hidden" name="vista" value="lista" />}
        <Input name="q" defaultValue={q} placeholder="Buscar por título, empresa o contacto…" className="w-64" />
        <NativeSelect name="responsable" defaultValue={owner} aria-label="Responsable">
          <NativeSelectOption value="">Todos los responsables</NativeSelectOption>
          {options.userOptions.map((u) => (
            <NativeSelectOption key={u.id} value={u.id}>
              {u.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="prioridad" defaultValue={prioridad ?? ""} aria-label="Prioridad">
          <NativeSelectOption value="">Todas las prioridades</NativeSelectOption>
          {LEAD_PRIORITIES.map((p) => (
            <NativeSelectOption key={p} value={p}>
              {LEAD_PRIORITY_LABELS[p]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {segments.length > 0 && (
          <NativeSelect name="segmento" defaultValue={segmento} aria-label="Segmento">
            <NativeSelectOption value="">Todos los segmentos</NativeSelectOption>
            {segments.map((s) => (
              <NativeSelectOption key={s.segment} value={s.segment!}>
                {s.segment}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        {list && (
          <NativeSelect name="etapa" defaultValue={etapa ?? ""} aria-label="Etapa">
            <NativeSelectOption value="">Todas las etapas</NativeSelectOption>
            {OPPORTUNITY_STAGES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {OPPORTUNITY_STAGE_LABELS[s]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {filtered && (
          <Button variant="ghost" asChild>
            <Link href={list ? "/leads?vista=lista" : "/leads"}>Limpiar</Link>
          </Button>
        )}
      </form>

      {!list ? (
        <>
          <KanbanBoard cards={cards} canEdit={canEdit} date={date} />
          {!filtered && (
            <p className="text-xs text-muted-foreground">
              Ganadas y perdidas: últimos 90 días. Para ver todas usá la vista Lista.
            </p>
          )}
        </>
      ) : rows.length === 0 ? (
        <EmptyState>No hay oportunidades que coincidan.</EmptyState>
      ) : (
        <div className="surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Oportunidad</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Monto estimado</TableHead>
                <TableHead>Cierre est.</TableHead>
                <TableHead>Próxima acción</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Prioridad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/leads/${r.id}`} className="font-medium hover:underline">
                      {r.title}
                    </Link>
                    {r.company !== r.title && <p className="text-xs text-muted-foreground">{r.company}</p>}
                  </TableCell>
                  <TableCell>
                    <OpportunityStageBadge stage={r.stage} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.expectedAmount)}</TableCell>
                  <TableCell>{formatDate(r.expectedClose)}</TableCell>
                  <TableCell className={isOverdue(r, date) ? "font-medium text-destructive" : "text-muted-foreground"}>
                    {[r.nextActionDate && formatDate(r.nextActionDate), r.nextAction].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.owner ?? "—"}</TableCell>
                  <TableCell>{r.priority ? (LEAD_PRIORITY_LABELS[r.priority as LeadPriority] ?? r.priority) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
