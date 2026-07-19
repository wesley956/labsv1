"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Professional = { id: string; name: string; specialty: string; active: boolean };
type AvailabilityRow = { id: string; professional_id: string; weekday: number; enabled: boolean; start_time: string; end_time: string };
type BlockRow = { id: string; professional_id: string; block_date: string; all_day: boolean; start_time: string | null; end_time: string | null; reason: string };
type Period = { id: string; start: string; end: string };
type Day = { weekday: number; label: string; enabled: boolean; periods: Period[] };

const labels = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const newPeriod = (start = "09:00", end = "18:00"): Period => ({ id: crypto.randomUUID(), start, end });
const emptyBlock = (professionalId = "") => ({ professionalId, date: "", allDay: true, start: "09:00", end: "18:00", reason: "" });

function buildDays(professionalId: string, rows: AvailabilityRow[]): Day[] {
  return labels.map((label, weekday) => {
    const periods = rows.filter((row) => row.professional_id === professionalId && row.weekday === weekday && row.enabled);
    return { weekday, label, enabled: periods.length > 0, periods: periods.length ? periods.map((row) => ({ id: row.id, start: row.start_time.slice(0, 5), end: row.end_time.slice(0, 5) })) : [] };
  });
}

function periodsOverlap(periods: Period[]) {
  const sorted = [...periods].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.some((period, index) => index > 0 && period.start < sorted[index - 1].end);
}

export function AvailabilityManager({ businessId, initialProfessionals, initialAvailability, initialBlocks }: { businessId: string; initialProfessionals: Professional[]; initialAvailability: AvailabilityRow[]; initialBlocks: BlockRow[] }) {
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(initialProfessionals[0]?.id ?? "");
  const [availability, setAvailability] = useState(initialAvailability);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockDraft, setBlockDraft] = useState(emptyBlock(initialProfessionals[0]?.id ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedProfessional = initialProfessionals.find((professional) => professional.id === selectedProfessionalId);
  const schedule = useMemo(() => buildDays(selectedProfessionalId, availability), [selectedProfessionalId, availability]);
  const professionalBlocks = useMemo(() => blocks.filter((block) => block.professional_id === selectedProfessionalId), [blocks, selectedProfessionalId]);

  function replaceDay(nextDay: Day) {
    setAvailability((current) => {
      const others = current.filter((row) => !(row.professional_id === selectedProfessionalId && row.weekday === nextDay.weekday));
      const replacements: AvailabilityRow[] = nextDay.enabled ? nextDay.periods.map((period) => ({ id: period.id, professional_id: selectedProfessionalId, weekday: nextDay.weekday, enabled: true, start_time: period.start, end_time: period.end })) : [];
      return [...others, ...replacements];
    });
  }

  function toggleDay(day: Day) { replaceDay({ ...day, enabled: !day.enabled, periods: day.enabled ? [] : [newPeriod()] }); }
  function addPeriod(day: Day) { replaceDay({ ...day, enabled: true, periods: [...day.periods, newPeriod("13:00", "18:00")] }); }
  function updatePeriod(day: Day, periodId: string, field: "start" | "end", value: string) { replaceDay({ ...day, periods: day.periods.map((period) => period.id === periodId ? { ...period, [field]: value } : period) }); }
  function removePeriod(day: Day, periodId: string) { const periods = day.periods.filter((period) => period.id !== periodId); replaceDay({ ...day, periods, enabled: periods.length > 0 }); }

  function copyMondayToWeekdays() {
    const monday = schedule.find((day) => day.weekday === 1);
    if (!monday) return;
    setAvailability((current) => {
      const untouched = current.filter((row) => row.professional_id !== selectedProfessionalId || row.weekday < 2 || row.weekday > 5);
      const copied = [2, 3, 4, 5].flatMap((weekday) => monday.enabled ? monday.periods.map((period) => ({ id: crypto.randomUUID(), professional_id: selectedProfessionalId, weekday, enabled: true, start_time: period.start, end_time: period.end })) : []);
      return [...untouched, ...copied];
    });
  }

  async function saveSchedule() {
    setError(""); setSuccess("");
    for (const day of schedule) {
      for (const period of day.periods) if (period.start >= period.end) { setError(`Horário inválido em ${day.label}.`); return; }
      if (periodsOverlap(day.periods)) { setError(`Existem períodos sobrepostos em ${day.label}.`); return; }
    }

    setSaving(true);
    const supabase = createClient();
    const oldRows = availability.filter((row) => row.professional_id === selectedProfessionalId);
    const newRows = schedule.flatMap((day) => day.enabled ? day.periods.map((period) => ({ business_id: businessId, professional_id: selectedProfessionalId, weekday: day.weekday, enabled: true, start_time: period.start, end_time: period.end })) : []);

    let inserted: AvailabilityRow[] = [];
    if (newRows.length) {
      const { data, error: insertError } = await supabase.from("weekly_availability").insert(newRows).select("id,professional_id,weekday,enabled,start_time,end_time");
      if (insertError) { setError(insertError.message); setSaving(false); return; }
      inserted = (data ?? []) as AvailabilityRow[];
    }

    if (oldRows.length) {
      const { error: deleteError } = await supabase.from("weekly_availability").delete().eq("business_id", businessId).eq("professional_id", selectedProfessionalId).in("id", oldRows.map((row) => row.id));
      if (deleteError) {
        if (inserted.length) await supabase.from("weekly_availability").delete().eq("business_id", businessId).in("id", inserted.map((row) => row.id));
        setError(deleteError.message); setSaving(false); return;
      }
    }

    setAvailability((current) => [...current.filter((row) => row.professional_id !== selectedProfessionalId), ...inserted]);
    setSaving(false); setSuccess("Horários salvos com sucesso.");
  }

  function openBlockForm() { setBlockDraft(emptyBlock(selectedProfessionalId)); setShowBlockForm(true); }

  async function saveBlock() {
    setError("");
    if (!blockDraft.date || !blockDraft.reason.trim()) return;
    if (!blockDraft.allDay && blockDraft.start >= blockDraft.end) { setError("O horário final precisa ser maior que o inicial."); return; }
    setSaving(true);
    const supabase = createClient();
    const { data, error: blockError } = await supabase.from("availability_blocks").insert({ business_id: businessId, professional_id: selectedProfessionalId, block_date: blockDraft.date, all_day: blockDraft.allDay, start_time: blockDraft.allDay ? null : blockDraft.start, end_time: blockDraft.allDay ? null : blockDraft.end, reason: blockDraft.reason.trim() }).select("id,professional_id,block_date,all_day,start_time,end_time,reason").single();
    setSaving(false);
    if (blockError) { setError(blockError.message); return; }
    setBlocks((current) => [...current, data].sort((a, b) => a.block_date.localeCompare(b.block_date)));
    setShowBlockForm(false);
  }

  async function removeBlock(id: string) {
    setError("");
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("availability_blocks").delete().eq("id", id).eq("business_id", businessId);
    if (deleteError) { setError(deleteError.message); return; }
    setBlocks((current) => current.filter((block) => block.id !== id));
  }

  if (!initialProfessionals.length) return <div className="content"><div className="card empty-state"><h2>Nenhum profissional ativo</h2><p>Cadastre ou reative um profissional antes de configurar a disponibilidade.</p></div></div>;

  return <div className="content availability-page">
    <div className="page-heading"><div><h1>Disponibilidade</h1><p>Defina horários semanais, pausas, folgas e bloqueios individuais.</p></div><button className="button button-primary" onClick={openBlockForm}>+ Novo bloqueio</button></div>
    {error && <div className="notice-box" style={{marginBottom:16}}>{error}</div>}{success && <div className="notice-box" style={{marginBottom:16}}>{success}</div>}
    <div className="card availability-toolbar"><div className="field compact-field"><label>Profissional</label><select className="input" value={selectedProfessionalId} onChange={(e) => { setSelectedProfessionalId(e.target.value); setBlockDraft(emptyBlock(e.target.value)); setSuccess(""); }}>{initialProfessionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}</select></div><div className="availability-person-summary"><div className="avatar">{selectedProfessional?.name.slice(0,1).toUpperCase()}</div><div><strong>{selectedProfessional?.name}</strong><span>{selectedProfessional?.specialty}</span></div></div><button className="button button-secondary" onClick={copyMondayToWeekdays}>Copiar segunda para dias úteis</button><button className="button button-primary" disabled={saving} onClick={saveSchedule}>{saving ? "Salvando..." : "Salvar horários"}</button></div>
    <div className="availability-layout"><section className="card panel"><div className="panel-header"><div><h3>Horários semanais</h3><p className="table-muted">Use mais de um período para criar pausas, como horário de almoço.</p></div></div><div className="weekly-list">{schedule.map((day) => <div className={`weekly-row ${day.enabled ? "" : "day-off"}`} key={day.weekday}><label className="day-switch"><input type="checkbox" checked={day.enabled} onChange={() => toggleDay(day)} /><span>{day.label}</span></label><div className="period-list">{day.enabled ? day.periods.map((period) => <div className="period-row" key={period.id}><input className="input" type="time" value={period.start} onChange={(e) => updatePeriod(day, period.id, "start", e.target.value)} /><span>até</span><input className="input" type="time" value={period.end} onChange={(e) => updatePeriod(day, period.id, "end", e.target.value)} /><button className="small-icon-button" onClick={() => removePeriod(day, period.id)}>×</button></div>) : <span className="closed-label">Folga</span>}</div><button className="text-button" disabled={!day.enabled} onClick={() => addPeriod(day)}>+ período</button></div>)}</div></section>
    <aside className="card panel"><div className="panel-header"><div><h3>Bloqueios futuros</h3><p className="table-muted">Férias, consultas e indisponibilidades pontuais.</p></div></div><div className="block-list">{professionalBlocks.length ? professionalBlocks.map((block) => <div className="block-item" key={block.id}><div><strong>{new Date(`${block.block_date}T12:00:00`).toLocaleDateString("pt-BR")}</strong><span>{block.all_day ? "Dia inteiro" : `${block.start_time?.slice(0,5)} às ${block.end_time?.slice(0,5)}`}</span><small>{block.reason}</small></div><button className="small-icon-button" onClick={() => removeBlock(block.id)}>×</button></div>) : <div className="compact-empty"><strong>Nenhum bloqueio</strong><span>O profissional seguirá os horários semanais.</span></div>}</div></aside></div>
    {showBlockForm && <div className="modal-backdrop" onMouseDown={() => !saving && setShowBlockForm(false)}><div className="card modal-card" onMouseDown={(e) => e.stopPropagation()}><div className="modal-header"><div><h2>Novo bloqueio</h2><p>Retire um período específico da agenda.</p></div><button className="small-icon-button" disabled={saving} onClick={() => setShowBlockForm(false)}>×</button></div><div className="form-grid"><div className="field field-wide"><label>Motivo</label><input className="input" value={blockDraft.reason} onChange={(e) => setBlockDraft({...blockDraft, reason:e.target.value})} placeholder="Ex.: Consulta médica" /></div><div className="field"><label>Data</label><input className="input" type="date" value={blockDraft.date} onChange={(e) => setBlockDraft({...blockDraft, date:e.target.value})} /></div><label className="checkbox-card"><input type="checkbox" checked={blockDraft.allDay} onChange={(e) => setBlockDraft({...blockDraft, allDay:e.target.checked})} /><span>Bloquear o dia inteiro</span></label>{!blockDraft.allDay && <><div className="field"><label>Início</label><input className="input" type="time" value={blockDraft.start} onChange={(e) => setBlockDraft({...blockDraft,start:e.target.value})} /></div><div className="field"><label>Fim</label><input className="input" type="time" value={blockDraft.end} onChange={(e) => setBlockDraft({...blockDraft,end:e.target.value})} /></div></>}</div><div className="modal-actions"><button className="button button-secondary" disabled={saving} onClick={() => setShowBlockForm(false)}>Cancelar</button><button className="button button-primary" disabled={saving || !blockDraft.date || !blockDraft.reason.trim()} onClick={saveBlock}>{saving ? "Salvando..." : "Salvar bloqueio"}</button></div></div></div>}
  </div>;
}
