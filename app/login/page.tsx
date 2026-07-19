import Link from "next/link";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/auth-forms";

export default function LoginPage() {
  return <main className="auth-shell"><section className="auth-visual"><Brand /><div className="auth-copy"><span className="eyebrow">Cruz Agenda</span><h1>Sua rotina mais leve começa aqui.</h1><p>Organize sua equipe, compartilhe seu link e acompanhe todos os atendimentos em um único lugar.</p></div><small>Menos tempo organizando. Mais tempo atendendo.</small></section><section className="auth-panel"><div className="card auth-card"><h2>Bem-vindo de volta</h2><p>Entre para continuar administrando sua agenda.</p><LoginForm /><p className="form-footer">Ainda não tem uma conta? <Link href="/cadastro" style={{color:"var(--primary)",fontWeight:800}}>Criar conta</Link></p></div></section></main>;
}
