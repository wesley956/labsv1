import Link from "next/link";
import { Brand } from "@/components/brand";

export default function LoginPage() {
  return <main className="auth-shell"><section className="auth-visual"><Brand /><div className="auth-copy"><span className="eyebrow">Cruz Agenda</span><h1>Sua rotina mais leve começa aqui.</h1><p>Organize sua equipe, compartilhe seu link e acompanhe todos os atendimentos em um único lugar.</p></div><small>Menos tempo organizando. Mais tempo atendendo.</small></section><section className="auth-panel"><div className="card auth-card"><h2>Bem-vindo de volta</h2><p>Entre para continuar administrando sua agenda.</p><form><div className="field"><label htmlFor="email">E-mail</label><input className="input" id="email" type="email" placeholder="seu@email.com" /></div><div className="field"><label htmlFor="password">Senha</label><input className="input" id="password" type="password" placeholder="Sua senha" /></div><Link className="button button-primary" style={{width:"100%"}} href="/painel">Entrar</Link></form><p className="form-footer">Ainda não tem uma conta? <Link href="/cadastro" style={{color:"var(--primary)",fontWeight:800}}>Criar conta</Link></p></div></section></main>;
}
