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

function PasswordField({ id, name, label, autoComplete, placeholder, minLength }: { id: string; name: string; label: string; autoComplete: string; placeholder: string; minLength?: number }) {
  const [visible, setVisible] = useState(false);

  return <div className="field">
    <label htmlFor={id}>{label}</label>
    <div style={{ position: "relative" }}>
      <input className="input" id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength={minLength} placeholder={placeholder} style={{ paddingRight: 84 }} />
      <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", color: "var(--primary)", fontWeight: 700, cursor: "pointer" }}>
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  </div>;
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
    <PasswordField id="password" name="password" label="Senha" autoComplete="current-password" placeholder="Sua senha" />
    <div style={{ textAlign: "right", marginTop: -8, marginBottom: 16 }}><Link href="/esqueci-senha" style={{ color: "var(--primary)", fontWeight: 700 }}>Esqueci minha senha</Link></div>
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
      setMessage("Este e-mail já possui uma conta confirmada. Entre com sua senha ou use a opção Esqueci minha senha.");
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
    <div className="field"><label htmlFor="register-email">E-mail</label><input className="input" id="register-email" name="email" type="email" required autoComplete="email" placeholder="seu@email.com" /></div>
    <div className="field"><label htmlFor="phone">WhatsApp</label><input className="input" id="phone" name="phone" required autoComplete="tel" placeholder="(11) 99999-9999" /></div>
    <PasswordField id="register-password" name="password" label="Senha" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" minLength={8} />
    <button className="button button-primary" style={{ width: "100%" }} disabled={loading || success}>{loading ? "Criando conta..." : success ? "Verifique seu e-mail" : "Criar conta e configurar agenda"}</button>
    <p style={{ marginTop: 14, textAlign: "center" }}>Já possui uma conta? <Link href="/login">Entrar</Link></p>
  </form>;
}

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setSuccess(true);
    setMessage("Enviamos um link para redefinir sua senha. Confira também as pastas Spam e Promoções.");
  }

  return <form onSubmit={submit}>
    <Message error={message} success={success} />
    <div className="field"><label htmlFor="recovery-email">E-mail</label><input className="input" id="recovery-email" name="email" type="email" autoComplete="email" required placeholder="seu@email.com" /></div>
    <button className="button button-primary" style={{ width: "100%" }} disabled={loading}>{loading ? "Enviando..." : "Enviar link de recuperação"}</button>
    <p style={{ marginTop: 14, textAlign: "center" }}><Link href="/login">Voltar para o login</Link></p>
  </form>;
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");

    if (password.length < 8) {
      setMessage("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setMessage("As senhas não são iguais.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.replace("/painel");
    router.refresh();
  }

  return <form onSubmit={submit}>
    <Message error={message} />
    <PasswordField id="new-password" name="password" label="Nova senha" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" minLength={8} />
    <PasswordField id="confirm-password" name="confirmation" label="Confirmar nova senha" autoComplete="new-password" placeholder="Digite novamente" minLength={8} />
    <button className="button button-primary" style={{ width: "100%" }} disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</button>
  </form>;
}
