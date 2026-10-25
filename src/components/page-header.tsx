import type { ReactNode } from "react";
import { PageHelp } from "@/components/page-help";
import type { HelpKey } from "@/lib/help";

export function PageHeader({
  title,
  description,
  actions,
  help,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Ayuda del módulo (botón (i) al lado del título); textos en `src/lib/help.ts`. */
  help?: HelpKey;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="grid gap-1">
        <div className="flex items-center gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {help && <PageHelp topic={help} />}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Campo de formulario: etiqueta + control. */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="surface min-w-0 p-4">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {/* Montos grandes: achica la letra antes que desbordar la tarjeta. */}
      <p className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums [overflow-wrap:anywhere] xl:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">{children}</div>;
}
