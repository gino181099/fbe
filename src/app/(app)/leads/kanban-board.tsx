"use client";

import Link from "next/link";
import { useActionState, useOptimistic, useState, useTransition } from "react";
import { CalendarClock, User } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  LEAD_PRIORITY_LABELS,
  type LeadPriority,
  OPPORTUNITY_STAGE_LABELS,
  OPPORTUNITY_STAGES,
  type OpportunityStage,
} from "@/lib/constants";
import { formatDate, formatMoney } from "@/lib/format";
import { isClosed, isOverdue, stageTotals } from "@/lib/leads";
import type { ActionResult } from "@/lib/permissions";
import { changeLeadStage } from "./actions";
import { CloseFields, targetStages } from "./stage-fields";

export type KanbanCard = {
  id: number;
  title: string;
  company: string;
  stage: OpportunityStage;
  expectedAmount: number | null;
  priority: string | null;
  owner: string | null;
  nextAction: string | null;
  nextActionDate: string | null;
  /** Ganarla pide el tipo de cliente (no tiene cliente o es potencial). */
  needsType: boolean;
};

const COLUMN_TOP: Record<OpportunityStage, string> = {
  nuevo: "border-t-amber-400",
  contacto: "border-t-sky-400",
  propuesta: "border-t-violet-400",
  ganado: "border-t-emerald-500",
  perdido: "border-t-muted-foreground/40",
};

/** Tablero por etapas: arrastrar una tarjeta (o usar "Mover a…") cambia la etapa. */
export function KanbanBoard({ cards, canEdit, date }: { cards: KanbanCard[]; canEdit: boolean; date: string }) {
  const [optimistic, setStage] = useOptimistic(cards, (state, m: { id: number; stage: OpportunityStage }) =>
    state.map((c) => (c.id === m.id ? { ...c, stage: m.stage } : c)),
  );
  const [, startTransition] = useTransition();
  const [closing, setClosing] = useState<{ card: KanbanCard; stage: OpportunityStage } | null>(null);
  const [over, setOver] = useState<OpportunityStage | null>(null);
  const totals = stageTotals(optimistic);

  function move(card: KanbanCard, stage: OpportunityStage) {
    if (card.stage === stage) return;
    if (!targetStages(card.stage).includes(stage)) {
      toast.error("Una oportunidad cerrada se reabre en Contacto o Propuesta.");
      return;
    }
    // Ganado/Perdido piden datos: se abre el diálogo y se mueve al confirmar.
    if (isClosed(stage)) return setClosing({ card, stage });
    startTransition(async () => {
      setStage({ id: card.id, stage });
      const fd = new FormData();
      fd.set("stage", stage);
      const res = await changeLeadStage(card.id, fd);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="grid min-w-[1100px] grid-cols-5 gap-3">
          {OPPORTUNITY_STAGES.map((stage) => (
            <section
              key={stage}
              aria-label={OPPORTUNITY_STAGE_LABELS[stage]}
              className={`flex min-h-64 flex-col gap-2 rounded-xl border border-t-4 bg-muted/30 p-2 transition-colors ${COLUMN_TOP[stage]} ${over === stage ? "bg-muted" : ""}`}
              onDragOver={(e) => {
                if (!canEdit) return;
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                setOver(null);
                const card = optimistic.find((c) => c.id === Number(e.dataTransfer.getData("text/plain")));
                if (card) move(card, stage);
              }}
            >
              <header className="flex items-baseline justify-between gap-2 px-1">
                <h2 className="text-sm font-semibold">
                  {OPPORTUNITY_STAGE_LABELS[stage]}{" "}
                  <span className="font-normal text-muted-foreground">({totals[stage].count})</span>
                </h2>
                {totals[stage].amount > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">{formatMoney(totals[stage].amount)}</span>
                )}
              </header>
              {optimistic
                .filter((c) => c.stage === stage)
                .map((card) => (
                  <Card key={card.id} card={card} canEdit={canEdit} date={date} onMove={(s) => move(card, s)} />
                ))}
            </section>
          ))}
        </div>
      </div>
      {closing && (
        <CloseDialog
          key={`${closing.card.id}-${closing.stage}`}
          card={closing.card}
          stage={closing.stage}
          onClose={() => setClosing(null)}
        />
      )}
    </>
  );
}

function Card({
  card,
  canEdit,
  date,
  onMove,
}: {
  card: KanbanCard;
  canEdit: boolean;
  date: string;
  onMove: (stage: OpportunityStage) => void;
}) {
  const overdue = isOverdue(card, date);
  return (
    <article
      draggable={canEdit}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", String(card.id))}
      className={`grid gap-1.5 rounded-lg border bg-card p-3 text-sm shadow-xs ${canEdit ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <Link href={`/leads/${card.id}`} className="font-medium leading-snug hover:underline">
        {card.title}
      </Link>
      {card.company !== card.title && <p className="text-xs text-muted-foreground">{card.company}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        {card.expectedAmount != null && (
          <span className="text-xs font-medium tabular-nums">{formatMoney(card.expectedAmount)}</span>
        )}
        {card.priority && (
          <Badge variant={card.priority === "alta" ? "default" : "outline"} className="text-[11px]">
            {LEAD_PRIORITY_LABELS[card.priority as LeadPriority] ?? card.priority}
          </Badge>
        )}
      </div>
      {(card.nextAction || card.nextActionDate) && (
        <p className={`flex items-start gap-1 text-xs ${overdue ? "font-medium text-destructive" : "text-muted-foreground"}`}>
          <CalendarClock className="mt-px size-3.5 shrink-0" />
          <span>
            {card.nextActionDate && formatDate(card.nextActionDate)}
            {card.nextAction && ` · ${card.nextAction}`}
          </span>
        </p>
      )}
      {card.owner && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <User className="size-3.5" /> {card.owner}
        </p>
      )}
      {canEdit && (
        <NativeSelect
          size="sm"
          aria-label="Mover a…"
          value=""
          onChange={(e) => onMove(e.target.value as OpportunityStage)}
          className="mt-1 w-full"
        >
          <NativeSelectOption value="" disabled>
            Mover a…
          </NativeSelectOption>
          {targetStages(card.stage).map((s) => (
            <NativeSelectOption key={s} value={s}>
              {OPPORTUNITY_STAGE_LABELS[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      )}
    </article>
  );
}

/** Confirmación al soltar en Ganado o Perdido (tipo de cliente o motivo). */
function CloseDialog({ card, stage, onClose }: { card: KanbanCard; stage: OpportunityStage; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(async (_prev, fd) => {
    fd.set("stage", stage);
    const res = await changeLeadStage(card.id, fd);
    if (res.ok) {
      toast.success(res.message ?? "Etapa actualizada");
      onClose();
    }
    return res;
  }, null);
  const won = stage === "ganado";
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{won ? "Marcar como ganada" : "Marcar como perdida"}</DialogTitle>
          <DialogDescription>{card.title}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-4">
          {won && !card.needsType ? (
            <p className="text-sm text-muted-foreground">El cliente ya existe en Contactos; queda registrada como ganada.</p>
          ) : (
            <CloseFields stage={stage} needsType={card.needsType} />
          )}
          {state && !state.ok && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
