"use client";

import { useEffect, useMemo, useState } from "react";
import { Brand } from "@/components/brand";
import { loadAvailability, loadBlocks } from "@/lib/availability-data";
import { createAppointment, getAvailableSlots, loadAppointments, saveAppointments, timeToMinutes } from "@/lib/appointments-data";
import { loadProfessionals, loadServices, ProfessionalRecord, ServiceRecord } from "@/lib/local-data";
import { BusinessSettings, defaultSettings, loadSettings } from "@/lib/settings-data";

type Step = "service" | "professional" | "date" | "time" | "customer" | "review" | "success";

const stepOrder: Step[] = ["service", "professional", "date", "time", "customer", "review", "success"];
const labels: Record<Step, string> = { service: "Serviço", professional: "Profissional", date: "Data", time: "Horário", customer: "Seus dados", review: "Revisar", success: "Confirmado" };

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(`${value}T12:00:00`));
}

function endTime(start: string, duration: number) {
  const total = timeToMinutes(start) + duration;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function PublicBooking({ slug }: { slug: string }) {
  const [step, setStep] = useState<Step>("service");
  const [settings, setSettings] = useState<BusinessSettings>(defaultSettings());
  const [loaded, setLoaded] = useState(false);
  const [professionals, setProfessionals] = useState<ProfessionalRecord[]>([]);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const currentSettings = loadSettings();
    setSettings(currentSettings);
    document.documentElement.dataset.theme = currentSettings.theme;
    const loadedProfessionals = loadProfessionals().filter((item) => item.active);
    setProfessionals(loadedProfessionals);
    setServices(loadServices(loadedProfessionals).filter((item) => item.active));
    setLoaded(true);
  }, []);

  const selectedService = services.find((item) => item.id === serviceId);
  const eligibleProfessionals = professionals.filter((item) => selectedService?.professionalIds.includes(item.id));
  const selectedProfessional = professionals.find((item) => item.id === professionalId);

  const slots = useMemo(() => {
    if (!selectedService || !selectedProfessional || !date) return [];
    const available = getAvailableSlots({
      date,
      professional: selectedProfessional,
      service: selectedService,
      availability: loadAvailability(professionals),
      blocks: loadBlocks(),
      appointments: loadAppointments(),
      step: settings.slotStepMinutes,
    });
    const minimum = Date.now() + settings.minimumNoticeHours * 60 * 60 * 1000;
    return available.filter((slot) => new Date(`${date}T${slot}:00`).getTime() >= minimum);
  }, [date, professionals, selectedProfessional, selectedService, settings.minimumNoticeHours, settings.slotStepMinutes]);

  const progress = Math.min(100, ((stepOrder.indexOf(step) + 1) / 6) * 100);

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
  }

  function chooseProfessional(id: string) {
    setProfessionalId(id);
    setDate("");
    setTime("");
  }

  function confirm() {
    if (!selectedService || !selectedProfessional || !date || !time || !name.trim() || !phone.trim()) return;
    const currentAppointments = loadAppointments();
    const stillAvailable = getAvailableSlots({
      date,
      professional: selectedProfessional,
      service: selectedService,
      availability: loadAvailability(professionals),
      blocks: loadBlocks(),
      appointments: currentAppointments,
      step: settings.slotStepMinutes,
    }).includes(time);
    const minimum = Date.now() + settings.minimumNoticeHours * 60 * 60 * 1000;
    const respectsNotice = new Date(`${date}T${time}:00`).getTime() >= minimum;
    if (!stillAvailable || !respectsNotice) {
      setError("Esse horário acabou de ficar indisponível. Escolha outro horário.");
      go("time");
      return;
    }
    const appointment = createAppointment({ customerName: name.trim(), customerPhone: phone.trim(), professionalId: selectedProfessional.id, professionalName: selectedProfessional.name, serviceId: selectedService.id, serviceName: selectedService.name, serviceDuration: selectedService.duration, servicePrice: selectedService.price, date, start: time, status: "confirmed", origin: "public", notes: "" });
    saveAppointments([...currentAppointments, appointment]);
    go("success");
  }

  if (loaded && settings.slug && settings.slug !== slug) {
    return <main className="public-booking-shell"><section className="public-unavailable card"><Brand /><h1>Agenda não encontrada</h1><p>Confira o endereço enviado pelo estabelecimento.</p></section></main>;
  }

  return <main className="public-booking-shell">
    <header className="public-header"><Brand href={`/${slug}`} /><span>Agendamento online</span></header>
    <section className="public-business"><div className="public-business-avatar">{settings.businessName.slice(0, 1) || "C"}</div><div><h1>{loaded ? settings.businessName : "Carregando agenda..."}</h1><p>{[settings.segment, settings.city].filter(Boolean).join(" · ")}</p>{settings.publicDescription && <small>{settings.publicDescription}</small>}</div></section>
    {step !== "success" && <><div className="public-progress"><div style={{ width: `${progress}%` }} /></div><div className="public-step-title"><small>Etapa {stepOrder.indexOf(step) + 1} de 6</small><strong>{labels[step]}</strong></div></>}
    <section className="public-booking-card card">
      {step === "service" && <><div className="public-heading"><h2>Qual serviço você deseja?</h2><p>Escolha uma opção para continuar.</p></div><div className="choice-list">{services.map((service) => <button className={`choice-card ${serviceId === service.id ? "selected" : ""}`} key={service.id} onClick={() => chooseService(service.id)}><div><strong>{service.name}</strong><span>{service.duration} min</span></div>{settings.showPricesPublicly && <b>{service.price}</b>}</button>)}</div>{loaded && services.length === 0 && <div className="public-empty"><strong>Nenhum serviço disponível</strong><p>O estabelecimento ainda não publicou serviços para agendamento.</p></div>}<footer><span /><button className="button button-primary" disabled={!serviceId} onClick={() => go("professional")}>Continuar</button></footer></>}
      {step === "professional" && <><div className="public-heading"><h2>Com quem você deseja agendar?</h2><p>Mostramos apenas profissionais que realizam o serviço escolhido.</p></div><div className="professional-choice-grid">{eligibleProfessionals.map((professional) => <button className={`professional-choice ${professionalId === professional.id ? "selected" : ""}`} key={professional.id} onClick={() => chooseProfessional(professional.id)}><span>{professional.name.slice(0, 1)}</span><strong>{professional.name}</strong>{settings.showProfessionalSpecialty && <small>{professional.specialty}</small>}</button>)}</div><footer><button className="button button-secondary" onClick={() => go("service")}>Voltar</button><button className="button button-primary" disabled={!professionalId} onClick={() => go("date")}>Continuar</button></footer></>}
      {step === "date" && <><div className="public-heading"><h2>Escolha a data</h2><p>É possível agendar nos próximos {settings.bookingWindowDays} dias.</p></div><div className="field"><label>Data do atendimento</label><input className="input" type="date" min={localDate()} max={localDate(settings.bookingWindowDays)} value={date} onChange={(event) => { setDate(event.target.value); setTime(""); }} /></div>{date && <div className="date-preview">{formatDate(date)}</div>}<footer><button className="button button-secondary" onClick={() => go("professional")}>Voltar</button><button className="button button-primary" disabled={!date} onClick={() => go("time")}>Ver horários</button></footer></>}
      {step === "time" && <><div className="public-heading"><h2>Escolha um horário</h2><p>{date ? formatDate(date) : "Selecione uma data"}</p></div>{error && <div className="public-error">{error}</div>}<div className="slot-grid">{slots.map((slot) => <button className={time === slot ? "selected" : ""} key={slot} onClick={() => setTime(slot)}>{slot}</button>)}</div>{slots.length === 0 && <div className="public-empty"><strong>Nenhum horário disponível</strong><p>Escolha outra data para encontrar novos horários.</p></div>}<footer><button className="button button-secondary" onClick={() => go("date")}>Voltar</button><button className="button button-primary" disabled={!time} onClick={() => go("customer")}>Continuar</button></footer></>}
      {step === "customer" && <><div className="public-heading"><h2>Como podemos identificar você?</h2><p>Usaremos seu WhatsApp apenas para informações sobre o agendamento.</p></div><div className="field"><label>Seu nome</label><input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome completo" /></div><div className="field"><label>WhatsApp</label><input className="input" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(11) 99999-9999" /></div><footer><button className="button button-secondary" onClick={() => go("time")}>Voltar</button><button className="button button-primary" disabled={!name.trim() || !phone.trim()} onClick={() => go("review")}>Revisar</button></footer></>}
      {step === "review" && <><div className="public-heading"><h2>Revise seu agendamento</h2><p>Confirme se todos os dados estão corretos.</p></div><div className="booking-review"><div><small>Serviço</small><strong>{selectedService?.name}</strong><span>{settings.showPricesPublicly && `${selectedService?.price} · `}{selectedService?.duration} min</span></div><div><small>Profissional</small><strong>{selectedProfessional?.name}</strong>{settings.showProfessionalSpecialty && <span>{selectedProfessional?.specialty}</span>}</div><div><small>Data e horário</small><strong>{date && formatDate(date)}</strong><span>{time} às {selectedService && time ? endTime(time, selectedService.duration) : ""}</span></div><div><small>Cliente</small><strong>{name}</strong><span>{phone}</span></div></div><footer><button className="button button-secondary" onClick={() => go("customer")}>Voltar</button><button className="button button-primary" onClick={confirm}>Confirmar agendamento</button></footer></>}
      {step === "success" && <div className="booking-success"><div className="booking-success-icon">✓</div><span className="eyebrow">Agendamento confirmado</span><h2>Está tudo certo, {name.split(" ")[0]}!</h2><p>Seu horário foi reservado com sucesso.</p><div className="success-summary"><strong>{selectedService?.name}</strong><span>{date && formatDate(date)} às {time}</span><span>com {selectedProfessional?.name}</span></div><button className="button button-secondary" onClick={() => { setServiceId(""); setProfessionalId(""); setDate(""); setTime(""); setName(""); setPhone(""); go("service"); }}>Fazer outro agendamento</button></div>}
    </section>
    <footer className="public-powered">Agendamento seguro por <strong>Cruz Agenda</strong></footer>
  </main>;
}
