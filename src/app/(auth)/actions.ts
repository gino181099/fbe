"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";

type LoginState = { error: string } | null;

export async function loginWithCredentials(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", { password: formData.get("password"), redirectTo: "/" });
    return null;
  } catch (error) {
    if (error instanceof AuthError) return { error: "Clave incorrecta." };
    throw error; // signIn redirige lanzando un error especial de Next
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
