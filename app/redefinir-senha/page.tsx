import { Brand } from "@/components/brand";
import { ResetPasswordForm } from "@/components/auth-forms";

export default function ResetPasswordPage() {
  return <main className="auth-shell"><section className="auth-visual"><Brand /><div className="auth-copy"><span className="eyebrow">Nova senha</span><h1>Crie uma nova senha segura.</h1><p>Escolha uma senha com pelo menos oito caracteres para voltar a acessar sua agenda.</p></div><small>Cruz Agenda • acesso protegido</small></section><section className="auth-panel"><div className="card auth-card"><h2>Redefinir senha</h2><p>Digite e confirme sua nova senha.</p><ResetPasswordForm /></div></section></main>;
}
