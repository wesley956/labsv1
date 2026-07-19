"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function Message({ error, success }: { error: string; success?: boolean }) {
  if (!error) return null;
  return <div role="alert" style={{ marginBottom: 16, padding: 12, borderRadius: 12, background: success ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)" }}>{error}</div>;
}

export function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!isSupabaseConfigured) {
      setMessage("Conecte o projeto Supabase no arquivo .env.local para ativar o login.");
      return;
    }

    const form = new FormData(event.currentTarget);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || ""),
    });
    setLoading(false);

    if (error) {
      setMessage(error.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : error.message);
      return;
    }

    router.replace("/painel");
    router.refresh();
  }

  return <form onSubmit={submit}>
    <Message error={message} />
    <div className="field"><label htmlFor="email">E-mail</label><input className="input" id="email" name="email" type="email" autoComplete="email" required placeholder="seu@email.com" /></div>
    <div className="field"><label htmlFor="password">Senha</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required placeholder="Sua senha" /></div>
    <button className="button button-primary" style={{ width: "100%" }} disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
  </form>;
}

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);
    if (!isSupabaseConfigured) {
      setMessage("Conecte o projeto Supabase no arquivo .env.local para ativar o cadastro.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    if (password.length < 8) {
      setMessage("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: String(form.get("email") || "").trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
        data: {
          full_name: String(form.get("name") || "").trim(),
          phone: String(form.get("phone") || "").trim(),
        },
      },
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setMessage("Este e-mail já possui uma conta confirmada. Entre com sua senha na página de login.");
      return;
    }

    if (data.session) {
      router.replace("/onboarding");
      router.refresh();
      return;
    }

    setSuccess(true);
    setMessage("Conta criada. Confira seu e-mail para confirmar o cadastro.");
  }

  return <form onSubmit={submit}>
    <Message error={message} success={success} />
    <div className="field"><label htmlFor="name">Nome completo</label><input className="input" id="name" name="name" required autoComplete="name" placeholder="Seu nome" /></div>
    <div className="field"><label htmlFor="email">E-mail</label><input className="input" id="email" name="email" type="email" required autoComplete="email" placeholder="seu@email.com" /></div>
    <div className="field"><label htmlFor="phone">WhatsApp</label><input className="input" id="phone" name="phone" required autoComplete="tel" placeholder="(11) 99999-9999" /></div>
    <div className="field"><label htmlFor="password">Senha</label><input className="input" id="password" name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" /></div>
    <button className="button button-primary" style={{ width: "100%" }} disabled={loading || success}>{loading ? "Criando conta..." : success ? "Verifique seu e-mail" : "Criar conta e configurar agenda"}</button>
    <p style={{ marginTop: 14, textAlign: "center" }}>Já possui uma conta? <Link href="/login">Entrar</Link></p>
  </form>;
}
