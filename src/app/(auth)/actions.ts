"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

type LoginState = { error: string; username: string } | null;

export async function loginWithCredentials(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Usuario o contraseña incorrectos.", username: String(formData.get("username") ?? "") };
    }
    throw error; // signIn redirige lanzando un error especial de Next
  }
}

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
