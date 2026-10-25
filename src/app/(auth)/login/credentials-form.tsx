"use client";

import { useActionState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOGIN_USERS } from "@/lib/constants";
import { loginWithCredentials } from "../actions";

const LAST_USER_KEY = "frabel-ultimo-usuario";

export function CredentialsForm() {
  const [state, action, pending] = useActionState(loginWithCredentials, null);

  // Esta PC recuerda quién entró la última vez (se marca el radio directo en el DOM).
  useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_USER_KEY);
      const radio = last && document.querySelector<HTMLInputElement>(`input[name="username"][value="${last}"]`);
      if (radio) radio.checked = true;
    } catch {}
  }, []);

  function remember(value: string) {
    try {
      localStorage.setItem(LAST_USER_KEY, value);
    } catch {}
    document.getElementById("password")?.focus();
  }

  return (
    <form action={action} className="grid gap-4">
      <fieldset className="grid gap-2">
        <Label asChild>
          <legend>Usuario</legend>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {LOGIN_USERS.map((u) => (
            <label key={u.username} className="cursor-pointer">
              <input
                type="radio"
                name="username"
                value={u.username}
                className="peer sr-only"
                onChange={() => remember(u.username)}
              />
              <span className="flex h-11 items-center justify-center rounded-md border text-sm font-medium transition-colors hover:bg-accent peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                {u.name}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-2">
        <Label htmlFor="password">Clave</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
