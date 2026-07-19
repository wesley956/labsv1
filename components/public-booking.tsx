"use client";

import { useEffect, useMemo, useState } from "react";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

type Step = "service" | "professional" | "date" | "time" | "customer" | "review" | "success";
type Business = {
  id: string;
  name: string;
  slug: string;
  segment: string;
  city: string;
  public_description: string;
  minimum_notice_hours: number;
  booking_window_days: number;
  slot_step_minutes: number;
  theme: string;
  show_prices_publicly: boolean;
  show_professional_specialty: boolean;
};
type Service = { id: string; name: string; price: number; duration_minutes: number; professional_ids: string[] };
type Professional = { id: string; name: string; specialty: string };
type BookingData = { business: Business; services: Service[]; professionals: Professional[] };

const stepOrder: Step[] = ["service", "professional", "date", "time", "customer", "review", "success"];
const labels: Record<Step, string> = { service: "Serviço", professional: "Profissional", date: "Data", time: "Horário", customer: "Seus dados", review: "Revisar", success: "Confirmado" };

function localDate(offset = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(`${value}T12:00:00`));
}

function endTime(start: string, duration: number) {
  const [hours, minutes] = start.split(":").map(Number);
  const total = hours * 60 + minutes + duration;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function PublicBooking({ slug }: { slug: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState<Step>("service");
  const [data, setData] = useState<BookingData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoaded(false);
      setError("");
      const { data: result, error: rpcError } = await (supabase as any).rpc("get_public_booking_data", { p_slug: slug });
      if (rpcError) setError("Não foi possível carregar esta agenda.");
      else if (result) {
        const bookingData = result as BookingData;
        setData(bookingData);
        document.documentElement.dataset.theme = bookingData.business.theme || "system";
      }
      setLoaded(true);
    }
    void load();
  }, [slug, supabase]);

  const selectedService = data?.services.find((item) => item.id === serviceId);
  const eligibleProfessionals = data?.professionals.filter((item) => selectedService?.professional_ids.includes(item.id)) ?? [];
  const selectedProfessional = data?.professionals.find((item) => item.id === professionalId);
  const progress = Math.min(100, ((stepOrder.indexOf(step) + 1) / 6) * 100);

  async function loadSlots(nextDate = date) {
    if (!selectedService || !selectedProfessional || !nextDate) return;
    setLoadingSlots(true);
    setError("");
    setTime("");
    const { data: result, error: rpcError } = await (supabase as any).rpc("get_public_available_slots", {
      p_slug: slug,
      p_service_id: selectedService.id,
      p_professional_id: selectedProfessional.id,
      p_date: nextDate,
    });
    if (rpcError) {
      setSlots([]);
      setError("Não foi possível consultar os horários. Tente novamente.");
    } else {
      setSlots((result ?? []).map((item: { slot: string } | string) => typeof item === "string" ? item : item.slot));
    }
    setLoadingSlots(false);
  }

  function go(next: Step) {
    setError("");
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function chooseService(id: string) {
    setServiceId(id);
    setProfessionalId("");
    setDate("");
    setTime("");
    setSlots([]);
  }

  function chooseProfessional(id: string) {
    setProfessionalId(id);
    setDate("");
    setTime("");
    setSlots([]);
  }

  async function confirm() {
    if (!selectedService || !selectedProfessional || !date || !time || !name.trim() || !phone.trim()) return;
    setSaving(true);
    setError("");
    const { error: rpcError } = await (supabase as any).rpc("create_public_appointment", {
      p_slug: slug,
      p_service_id: selectedService.id,
      p_professional_id: selectedProfessional.id,
      p_date: date,
      p_start: time,
      p_customer_name: name.trim(),
      p_customer_phone: phone.trim(),
    });
    if (rpcError) {
      setError(rpcError.message.includes("não está mais disponível") ? "Esse horário acabou de ficar indisponível. Escolha outro horário." : rpcError.message);
      await loadSlots(date);
      setStep("time");
    } else {
      go("success");
    }
    setSaving(false);
  }

  if (loaded && !data) {
    return <main className="public-booking-shell"><section className="public-unavailable card"><Brand /><h1>Agenda não encontrada</h1><p>Confira o endereço enviado pelo estabelecimento.</p></section></main>;
  }

  const business = data?.business;

  return <main className="public-booking-shell">
    <header className="public-header"><Brand href={`/${slug}`} /><span>Agendamento online</span></header>
    <section className="public-business"><div className="public-business-avatar">{business?.name.slice(0, 1) || "C"}</div><div><h1>{business?.name || "Carregando agenda..."}</h1><p>{[business?.segment, business?.city].filter(Boolean).join(" · ")}</p>{business?.public_description && <small>{business.public_description}</small>}</div></section>
    {step !== "success" && <><div className="public-progress"><div style={{ width: `${progress}%` }} /></div><div className="public-step-title"><small>Etapa {stepOrder.indexOf(step) + 1} de 6</small><strong>{labels[step]}</strong></div></>}
    <section className="public-booking-card card">
      {error && <div className="public-error">{error}</div>}
      {step === "service" && <><div className="public-heading"><h2>Qual serviço você deseja?</h2><p>Escolha uma opção para continuar.</p></div><div className="choice-list">{data?.services.map((service) => <button className={`choice-card ${serviceId === service.id ? "selected" : ""}`} key={service.id} onClick={() => chooseService(service.id)}><div><strong>{service.name}</strong><span>{service.duration_minutes} min</span></div>{business?.show_prices_publicly && <b>{money(service.price)}</b>}</button>)}</div>{loaded && data?.services.length === 0 && <div className="public-empty"><strong>Nenhum serviço disponível</strong><p>O estabelecimento ainda não publicou serviços para agendamento.</p></div>}<footer><span /><button className="button button-primary" disabled={!serviceId} onClick={() => go("professional")}>Continuar</button></footer></>}
      {step === "professional" && <><div className="public-heading"><h2>Com quem você deseja agendar?</h2><p>Mostramos apenas profissionais que realizam o serviço escolhido.</p></div><div className="professional-choice-grid">{eligibleProfessionals.map((professional) => <button className={`professional-choice ${professionalId === professional.id ? "selected" : ""}`} key={professional.id} onClick={() => chooseProfessional(professional.id)}><span>{professional.name.slice(0, 1)}</span><strong>{professional.name}</strong>{business?.show_professional_specialty && <small>{professional.specialty}</small>}</button>)}</div><footer><button className="button button-secondary" onClick={() => go("service")}>Voltar</button><button className="button button-primary" disabled={!professionalId} onClick={() => go("date")}>Continuar</button></footer></>}
      {step === "date" && <><div className="public-heading"><h2>Escolha a data</h2><p>É possível agendar nos próximos {business?.booking_window_days ?? 60} dias.</p></div><div className="field"><label>Data do atendimento</label><input className="input" type="date" min={localDate()} max={localDate(business?.booking_window_days ?? 60)} value={date} onChange={(event) => { setDate(event.target.value); setTime(""); setSlots([]); }} /></div>{date && <div className="date-preview">{formatDate(date)}</div>}<footer><button className="button button-secondary" onClick={() => go("professional")}>Voltar</button><button className="button button-primary" disabled={!date || loadingSlots} onClick={async () => { await loadSlots(date); go("time"); }}>{loadingSlots ? "Consultando..." : "Ver horários"}</button></footer></>}
      {step === "time" && <><div className="public-heading"><h2>Escolha um horário</h2><p>{date ? formatDate(date) : "Selecione uma data"}</p></div>{loadingSlots ? <div className="public-empty"><strong>Consultando horários...</strong></div> : <div className="slot-grid">{slots.map((slot) => <button className={time === slot ? "selected" : ""} key={slot} onClick={() => setTime(slot)}>{slot}</button>)}</div>}{!loadingSlots && slots.length === 0 && <div className="public-empty"><strong>Nenhum horário disponível</strong><p>Escolha outra data para encontrar novos horários.</p></div>}<footer><button className="button button-secondary" onClick={() => go("date")}>Voltar</button><button className="button button-primary" disabled={!time} onClick={() => go("customer")}>Continuar</button></footer></>}
      {step === "customer" && <><div className="public-heading"><h2>Como podemos identificar você?</h2><p>Usaremos seu WhatsApp apenas para informações sobre o agendamento.</p></div><div className="field"><label>Seu nome</label><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome completo" /></div><div className="field"><label>WhatsApp</label><input className="input" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(11) 99999-9999" /></div><footer><button className="button button-secondary" onClick={() => go("time")}>Voltar</button><button className="button button-primary" disabled={!name.trim() || !phone.trim()} onClick={() => go("review")}>Revisar</button></footer></>}
      {step === "review" && <><div className="public-heading"><h2>Revise seu agendamento</h2><p>Confirme se todos os dados estão corretos.</p></div><div className="booking-review"><div><small>Serviço</small><strong>{selectedService?.name}</strong><span>{business?.show_prices_publicly && `${money(selectedService?.price ?? 0)} · `}{selectedService?.duration_minutes} min</span></div><div><small>Profissional</small><strong>{selectedProfessional?.name}</strong>{business?.show_professional_specialty && <span>{selectedProfessional?.specialty}</span>}</div><div><small>Data e horário</small><strong>{date && formatDate(date)}</strong><span>{time} às {selectedService && time ? endTime(time, selectedService.duration_minutes) : ""}</span></div><div><small>Cliente</small><strong>{name}</strong><span>{phone}</span></div></div><footer><button className="button button-secondary" disabled={saving} onClick={() => go("customer")}>Voltar</button><button className="button button-primary" disabled={saving} onClick={() => void confirm()}>{saving ? "Confirmando..." : "Confirmar agendamento"}</button></footer></>}
      {step === "success" && <div className="booking-success"><div className="booking-success-icon">✓</div><span className="eyebrow">Agendamento confirmado</span><h2>Está tudo certo, {name.split(" ")[0]}!</h2><p>Seu horário foi reservado com sucesso.</p><div className="success-summary"><strong>{selectedService?.name}</strong><span>{date && formatDate(date)} às {time}</span><span>com {selectedProfessional?.name}</span></div><button className="button button-secondary" onClick={() => { setServiceId(""); setProfessionalId(""); setDate(""); setTime(""); setName(""); setPhone(""); setSlots([]); go("service"); }}>Fazer outro agendamento</button></div>}
    </section>
    <footer className="public-powered">Agendamento seguro por <strong>Cruz Agenda</strong></footer>
  </main>;
}
