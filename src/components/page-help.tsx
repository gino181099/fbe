import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { HELP, type HelpKey } from "@/lib/help";

/** Botón (i) del encabezado: abre un panel con para qué sirve el módulo y qué significa cada cosa. */
export function PageHelp({ topic }: { topic: HelpKey }) {
  const help = HELP[topic];
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ayuda: ${help.title}`} title="¿Qué es esto?">
          <Info className="text-muted-foreground" />
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto data-[side=right]:sm:max-w-md">
        <SheetHeader className="pr-12">
          <SheetTitle className="text-lg">{help.title}</SheetTitle>
          <SheetDescription>{help.purpose}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 px-4 pb-6">
          <section className="grid gap-2">
            <h3 className="font-medium">Qué significa cada cosa</h3>
            <dl className="grid gap-3">
              {help.terms.map((t) => (
                <div key={t.term}>
                  <dt className="font-medium">{t.term}</dt>
                  <dd className="text-muted-foreground">{t.text}</dd>
                </div>
              ))}
            </dl>
          </section>
          {"tips" in help && help.tips && (
            <section className="grid gap-2">
              <h3 className="font-medium">A tener en cuenta</h3>
              <ul className="grid list-disc gap-1.5 pl-5 text-muted-foreground">
                {help.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
