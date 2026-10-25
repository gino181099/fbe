"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

/** Botón luna/sol del menú. Muestra los dos íconos por CSS (clase `dark`) para no depender del tema en el render. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
      title="Cambiar modo claro / oscuro"
      aria-label="Cambiar modo claro / oscuro"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}
