"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ReviewContext = {
  appointment: { customer_name: string; service_name: string; professional_name: string; appointment_date: string; status: string };
  business: { name: string; slug: string; logo_url: string; primary_color: string };
  review: { rating: number; comment: string } | null;
};

export function PublicReview({ token }: { token: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<ReviewContext | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const { data: result, error: rpcError } = await (supabase as any).rpc("get_public_review_context", { p_token: token });
      if (rpcError || !result) setError("Não foi possível localizar este atendimento.");
      else {
        const context = result as ReviewContext;
        setData(context);
        setRating(context.review?.rating ?? 0);
        setComment(context.review?.comment ?? "");
      }
      setLoading(false);
    }
    void load();
  }, [supabase, token]);

  async function submit() {
    if (!rating || saving) return;
    setSaving(true); setError("");
    const { error: rpcError } = await (supabase as any).rpc("submit_public_review", { p_token: token, p_rating: rating, p_comment: comment.trim() });
    if (rpcError) setError(rpcError.message || "Não foi possível enviar sua avaliação.");
    else setSuccess(true);
    setSaving(false);
  }

  if (loading) return <main className="public-booking-shell"><section className="card public-unavailable"><h1>Carregando...</h1></section></main>;
  if (!data) return <main className="public-booking-shell"><section className="card public-unavailable"><h1>Avaliação indisponível</h1><p>{error}</p></section></main>;

  const completed = data.appointment.status === "completed";
  return <main className="public-booking-shell" style={{ ["--public-accent" as string]: data.business.primary_color || "#7c3aed" }}>
    <section className="card public-booking-card" style={{ marginTop: 40, textAlign: "center" }}>
      {data.business.logo_url && <img src={data.business.logo_url} alt={data.business.name} style={{ width: 84, height: 84, borderRadius: 24, objectFit: "cover", margin: "0 auto 14px" }} />}
      <span className="eyebrow">Sua experiência</span>
      <h1>{data.business.name}</h1>
      <p>{data.appointment.service_name} com {data.appointment.professional_name}</p>

      {success ? <div className="booking-success"><div className="booking-success-icon">✓</div><h2>Obrigado pela avaliação!</h2><p>Seu comentário foi enviado ao estabelecimento e poderá ser publicado após aprovação.</p></div> : !completed ? <div className="notice-box"><strong>A avaliação ainda não está disponível.</strong><p style={{ margin: "6px 0 0" }}>Ela será liberada quando o atendimento for marcado como concluído.</p></div> : <>
        {error && <div className="public-error">{error}</div>}
        <div style={{ margin: "26px 0" }}><strong style={{ display: "block", marginBottom: 12 }}>Qual nota você dá para o atendimento?</strong><div style={{ display: "flex", justifyContent: "center", gap: 8 }}>{[1,2,3,4,5].map((value) => <button key={value} type="button" aria-label={`${value} estrela(s)`} onClick={() => setRating(value)} style={{ border: 0, background: "transparent", fontSize: 38, cursor: "pointer", opacity: value <= rating ? 1 : .25 }}>★</button>)}</div></div>
        <div className="field" style={{ textAlign: "left" }}><label>Comentário (opcional)</label><textarea className="input" rows={5} maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Conte como foi sua experiência" /></div>
        <button className="button button-primary" style={{ width: "100%" }} disabled={!rating || saving} onClick={() => void submit()}>{saving ? "Enviando..." : "Enviar avaliação"}</button>
      </>}
      <a href={`/${data.business.slug}`} className="button button-secondary" style={{ width: "100%", marginTop: 12 }}>Voltar para o estabelecimento</a>
    </section>
    <footer className="public-powered">Tecnologia de agendamento por <strong>Cruz Agenda</strong></footer>
  </main>;
}
