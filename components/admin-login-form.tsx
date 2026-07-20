"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    searchParams.get("error") === "unauthorized"
      ? "Esta conta não possui acesso ao painel administrativo."
      : "",
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(event.currentTarget);
    const supabase = createClient();
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || ""),
    });

    if (loginError || !data.user) {
      setLoading(false);
      setError(loginError?.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : loginError?.message || "Não foi possível entrar.");
      return;
    }

    const { data: allowed, error: permissionError } = await supabase.rpc("is_platform_admin", {
      p_require_write: false,
    });

    if (permissionError || !allowed) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Esta conta não possui acesso ao painel administrativo.");
      return;
    }

    router.replace("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="notice-box" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
      <div className="field">
        <label htmlFor="admin-email">E-mail administrativo</label>
        <input className="input" id="admin-email" name="email" type="email" autoComplete="email" required placeholder="admin@cruzlabs.com" />
      </div>
      <div className="field">
        <label htmlFor="admin-password">Senha</label>
        <input className="input" id="admin-password" name="password" type="password" autoComplete="current-password" required placeholder="Sua senha" />
      </div>
      <button className="button button-primary" style={{ width: "100%" }} disabled={loading}>
        {loading ? "Validando acesso..." : "Entrar no ADM"}
      </button>
    </form>
  );
}
