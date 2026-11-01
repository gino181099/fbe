"use client";

import { Bell, BellRing } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { subscribePush, unsubscribePush } from "@/app/(app)/agenda/push-actions";

type State = "loading" | "unsupported" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function base64UrlToBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

/** Campana del menú: activa / desactiva el resumen diario de la agenda en este dispositivo. */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      queueMicrotask(() => setState("unsupported"));
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("unsupported"));
  }, []);

  function toggle() {
    if (state === "unsupported") {
      toast.info(
        isIos()
          ? "En iPhone primero instalá el ERP: en Safari tocá Compartir → \"Agregar a pantalla de inicio\" y abrilo desde ese ícono."
          : "Este navegador no permite notificaciones. Probá con Chrome.",
        { duration: 10000 },
      );
      return;
    }
    startTransition(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (state === "on") {
        const sub = await reg.pushManager.getSubscription();
        await sub?.unsubscribe();
        if (sub) await unsubscribePush(sub.endpoint);
        setState("off");
        toast.success("Notificaciones desactivadas en este dispositivo");
        return;
      }
      if ((await Notification.requestPermission()) !== "granted") {
        toast.error("Las notificaciones están bloqueadas: habilitalas para este sitio en la configuración del navegador.");
        return;
      }
      try {
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) });
        const result = await subscribePush(sub.toJSON());
        if (result.ok) toast.success(result.message);
        else toast.error(result.error);
        setState("on");
      } catch {
        toast.error("No se pudieron activar las notificaciones.");
      }
    });
  }

  const on = state === "on";
  const label = on ? "Notificaciones activadas (tocá para desactivar)" : "Activar notificaciones de la agenda";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={state === "loading" || pending}
      className={`rounded-md p-1.5 hover:bg-sidebar-accent disabled:opacity-50 ${on ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
      title={label}
      aria-label={label}
    >
      {on ? <BellRing className="size-4" /> : <Bell className="size-4" />}
    </button>
  );
}
