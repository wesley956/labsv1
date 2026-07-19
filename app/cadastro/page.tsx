import Link from "next/link";
import { Brand } from "@/components/brand";
import { RegisterForm } from "@/components/auth-forms";

export default function RegisterPage() {
  return <main className="auth-shell"><section className="auth-visual"><Brand /><div className="auth-copy"><span className="eyebrow">15 dias grátis</span><h1>Crie a agenda do seu negócio.</h1><p>Cadastre seu estabelecimento, profissionais e serviços com uma configuração guiada e simples.</p></div><small>Você poderá conectar o pagamento somente depois do período gratuito.</small></section><section className="auth-panel"><div className="card auth-card"><h2>Criar sua conta</h2><p>Leva menos de dois minutos.</p><RegisterForm /><p className="form-footer">Já possui uma conta? <Link href="/login" style={{color:"var(--primary)",fontWeight:800}}>Entrar</Link></p></div></section></main>;
}
