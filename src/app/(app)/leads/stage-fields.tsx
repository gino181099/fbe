"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Field } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { OPPORTUNITY_STAGE_LABELS, OPPORTUNITY_STAGES, type OpportunityStage } from "@/lib/constants";
import type { ActionResult } from "@/lib/permissions";

const CLOSED: OpportunityStage[] = ["ganado", "perdido"];

/** Etapas a las que se puede mover (desde un cierre solo se reabre a Contacto o Propuesta). */
export function targetStages(current: OpportunityStage) {
  return OPPORTUNITY_STAGES.filter((s) =>
    CLOSED.includes(current) ? s === "contacto" || s === "propuesta" : s !== current,
  );
}

/** Datos extra al cerrar: tipo de cliente (ganado) o motivo (perdido). */
export function CloseFields({ stage, needsType }: { stage: OpportunityStage; needsType: boolean }) {
  if (stage === "ganado" && needsType) {
    return (
      <Field
        label="¿Qué tipo de cliente es?"
        htmlFor="type"
        hint="Se crea (o activa) en Contactos. Recurrente: tiene tarifario por recorrido. Especial: servicios puntuales."
      >
        <NativeSelect id="type" name="type" defaultValue="" required className="w-full">
          <NativeSelectOption value="" disabled>
            Elegí el tipo…
          </NativeSelectOption>
          <NativeSelectOption value="recurrente">Recurrente</NativeSelectOption>
          <NativeSelectOption value="especial">Especial</NativeSelectOption>
        </NativeSelect>
      </Field>
    );
  }
  if (stage === "perdido") {
    return (
      <Field label="Motivo" htmlFor="lostReason" hint="Ej.: precio, eligió otra empresa, no respondió.">
        <Textarea id="lostReason" name="lostReason" rows={2} maxLength={500} required />
      </Field>
    );
  }
  return null;
}

/** Botón "Cambiar etapa" de la ficha de la oportunidad. */
export function StageControl({
  current,
  needsType,
  action,
}: {
  current: OpportunityStage;
  needsType: boolean;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  return (
    <FormDialog
      title="Cambiar etapa"
      description={`Etapa actual: ${OPPORTUNITY_STAGE_LABELS[current]}. El cambio queda registrado en el seguimiento.`}
      action={action}
      successMessage="Etapa actualizada"
      trigger={
        <Button variant="outline">
          <ArrowRightLeft /> Cambiar etapa
        </Button>
      }
    >
      <StageSelect current={current} needsType={needsType} />
    </FormDialog>
  );
}

function StageSelect({ current, needsType }: { current: OpportunityStage; needsType: boolean }) {
  const options = targetStages(current);
  const [stage, setStage] = useState<OpportunityStage>(options[0]);
  return (
    <div className="grid gap-4">
      <Field label="Nueva etapa" htmlFor="stage">
        <NativeSelect
          id="stage"
          name="stage"
          value={stage}
          onChange={(e) => setStage(e.target.value as OpportunityStage)}
          className="w-full"
        >
          {options.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {OPPORTUNITY_STAGE_LABELS[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <CloseFields stage={stage} needsType={needsType} />
    </div>
  );
}
