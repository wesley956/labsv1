import { Brand } from "@/components/brand";
import { ForgotPasswordForm } from "@/components/auth-forms";

export default function ForgotPasswordPage() {
  return <main className="auth-shell"><section className="auth-visual"><Brand /><div className="auth-copy"><span className="eyebrow">Recuperação de acesso</span><h1>Vamos recuperar sua conta.</h1><p>Informe o e-mail cadastrado para receber um link seguro de redefinição de senha.</p></div><small>Cruz Agenda • acesso protegido</small></section><section className="auth-panel"><div className="card auth-card"><h2>Esqueci minha senha</h2><p>Enviaremos as instruções para o seu e-mail.</p><ForgotPasswordForm /></div></section></main>;
}
