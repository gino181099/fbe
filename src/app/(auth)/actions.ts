"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn, signOut } from "@/auth";

type LoginState = { error: string } | null;

export async function loginWithCredentials(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!formData.get("username")) return { error: "Elegí tu usuario." };
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return null;
  } catch (error) {
    const blocked = error instanceof CredentialsSignin && /^bloqueado:(\d+)$/.exec(error.code);
    if (blocked) {
      const m = Number(blocked[1]);
      return { error: `Demasiados intentos fallidos. Probá de nuevo en ${m} minuto${m === 1 ? "" : "s"}.` };
    }
    if (error instanceof AuthError) return { error: "Clave incorrecta." };
    throw error; // signIn redirige lanzando un error especial de Next
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
