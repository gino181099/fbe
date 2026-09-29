"use client";

import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { FormDialog } from "@/components/form-dialog";
import { Field } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { LEAD_STAGE_LABELS, LEAD_STAGES, type LeadStage } from "@/lib/constants";
import type { ActionResult } from "@/lib/permissions";

/** Botón "Cambiar etapa" de un potencial; al elegir "Ganado" pide el tipo de cliente. */
export function LeadStageControl({
  current,
  action,
}: {
  current: LeadStage;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  return (
    <FormDialog
      title="Cambiar etapa"
      description={`Etapa actual: ${LEAD_STAGE_LABELS[current]}. El cambio queda registrado en el seguimiento.`}
      action={action}
      successMessage="Etapa actualizada"
      trigger={
        <Button variant="outline">
          <ArrowRightLeft /> Cambiar etapa
        </Button>
      }
    >
      <StageFields current={current} />
    </FormDialog>
  );
}

function StageFields({ current }: { current: LeadStage }) {
  const options = LEAD_STAGES.filter((s) => s !== current);
  const [stage, setStage] = useState<LeadStage>(options[0]);
  return (
    <div className="grid gap-4">
      <Field label="Nueva etapa" htmlFor="leadStage">
        <NativeSelect
          id="leadStage"
          name="leadStage"
          value={stage}
          onChange={(e) => setStage(e.target.value as LeadStage)}
          className="w-full"
        >
          {options.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {LEAD_STAGE_LABELS[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {stage === "ganado" && (
        <Field
          label="¿Qué tipo de cliente es?"
          htmlFor="type"
          hint="Pasa a cliente activo. Recurrente: tiene tarifario por recorrido. Especial: servicios puntuales."
        >
          <NativeSelect id="type" name="type" defaultValue="" required className="w-full">
            <NativeSelectOption value="" disabled>
              Elegí el tipo…
            </NativeSelectOption>
            <NativeSelectOption value="recurrente">Recurrente</NativeSelectOption>
            <NativeSelectOption value="especial">Especial</NativeSelectOption>
          </NativeSelect>
        </Field>
      )}
    </div>
  );
}
