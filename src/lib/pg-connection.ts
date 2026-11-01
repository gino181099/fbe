// Opciones de conexión de `pg` para una URL (Neon o localhost). Sin `server-only`: lo usan también los scripts.
import type { ClientConfig } from "pg";

export function pgConnection(url: string): Pick<ClientConfig, "connectionString" | "ssl"> {
  // Neon exige SSL; se quita `sslmode` de la URL para que pg no lo reinterprete (y no avise).
  const u = new URL(url);
  const remote = !["localhost", "127.0.0.1"].includes(u.hostname);
  u.searchParams.delete("sslmode");
  u.searchParams.delete("channel_binding");
  return { connectionString: u.toString(), ssl: remote ? true : undefined };
}
