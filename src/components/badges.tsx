import { Badge } from "@/components/ui/badge";
import {
  CLIENT_TYPE_LABELS,
  type ClientType,
  LEAD_STAGE_LABELS,
  type LeadStage,
  OPPORTUNITY_STAGE_LABELS,
  type OpportunityStage,
} from "@/lib/constants";

export function ClientTypeBadge({ type }: { type: ClientType }) {
  const variant = type === "recurrente" ? "default" : type === "especial" ? "secondary" : "outline";
  return <Badge variant={variant}>{CLIENT_TYPE_LABELS[type]}</Badge>;
}

export function ClientStatusBadge({ status }: { status: "activo" | "potencial" | "inactivo" }) {
  const label = { activo: "Activo", potencial: "Potencial", inactivo: "Inactivo" }[status];
  return <Badge variant="outline">{label}</Badge>;
}

const STAGE_CLASSES: Record<LeadStage, string> = {
  sin_contactar: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  contactado: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
  ganado: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  perdido: "text-muted-foreground",
};

export function LeadStageBadge({ stage }: { stage: LeadStage }) {
  return (
    <Badge variant="outline" className={STAGE_CLASSES[stage]}>
      {LEAD_STAGE_LABELS[stage]}
    </Badge>
  );
}

const OPPORTUNITY_CLASSES: Record<OpportunityStage, string> = {
  nuevo: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  contacto: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
  propuesta: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200",
  ganado: STAGE_CLASSES.ganado,
  perdido: STAGE_CLASSES.perdido,
};

export function OpportunityStageBadge({ stage }: { stage: OpportunityStage }) {
  return (
    <Badge variant="outline" className={OPPORTUNITY_CLASSES[stage]}>
      {OPPORTUNITY_STAGE_LABELS[stage]}
    </Badge>
  );
}
