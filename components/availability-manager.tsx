"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AvailabilityBlock,
  WeeklyAvailability,
  createAvailabilityId,
  loadAvailability,
  loadBlocks,
  saveAvailability,
  saveBlocks,
} from "@/lib/availability-data";
import { loadProfessionals, ProfessionalRecord } from "@/lib/local-data";

const emptyBlock = (professionalId = ""): AvailabilityBlock => ({
  id: "",
  professionalId,
  date: "",
  allDay: true,
  start: "09:00",
  end: "18:00",
  reason: "",
});

export function AvailabilityManager() {
  const [professionals, setProfessionals] = useState<ProfessionalRecord[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("");
  const [availability, setAvailability] = useState<WeeklyAvailability[]>([]);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockDraft, setBlockDraft] = useState<AvailabilityBlock>(emptyBlock());

  useEffect(() => {
    const loadedProfessionals = loadProfessionals();
    const activeProfessionals = loadedProfessionals.filter((professional) => professional.active);
    setProfessionals(activeProfessionals);
    setSelectedProfessionalId(activeProfessionals[0]?.id || "");
    setAvailability(loadAvailability(loadedProfessionals));
    setBlocks(loadBlocks());
  }, []);

  const selectedProfessional = professionals.find((professional) => professional.id === selectedProfessionalId);
  const schedule = useMemo(
    () => availability.filter((item) => item.professionalId === selectedProfessionalId).sort((a, b) => a.weekday - b.weekday),
    [availability, selectedProfessionalId],
  );
  const professionalBlocks = useMemo(
    () => blocks.filter((block) => block.professionalId === selectedProfessionalId).sort((a, b) => a.date.localeCompare(b.date)),
    [blocks, selectedProfessionalId],
  );

  function updateDay(weekday: number, updater: (day: WeeklyAvailability) => WeeklyAvailability) {
    setAvailability((current) => {
      const next = current.map((day) => day.professionalId === selectedProfessionalId && day.weekday === weekday ? updater(day) : day);
      saveAvailability(next);
      return next;
    });
  }

  function toggleDay(day: WeeklyAvailability) {
    updateDay(day.weekday, (current) => ({
      ...current,
      enabled: !current.enabled,
      periods: current.enabled ? [] : [{ id: createAvailabilityId("period"), start: "09:00", end: "18:00" }],
    }));
  }

  function addPeriod(day: WeeklyAvailability) {
    updateDay(day.weekday, (current) => ({
      ...current,
      enabled: true,
      periods: [...current.periods, { id: createAvailabilityId("period"), start: "13:00", end: "18:00" }],
    }));
  }

  function updatePeriod(day: WeeklyAvailability, periodId: string, field: "start" | "end", value: string) {
    updateDay(day.weekday, (current) => ({
      ...current,
      periods: current.periods.map((period) => period.id === periodId ? { ...period, [field]: value } : period),
    }));
  }

  function removePeriod(day: WeeklyAvailability, periodId: string) {
    updateDay(day.weekday, (current) => {
      const periods = current.periods.filter((period) => period.id !== periodId);
      return { ...current, periods, enabled: periods.length > 0 };
    });
  }

  function copyMondayToWeekdays() {
    const monday = availability.find((day) => day.professionalId === selectedProfessionalId && day.weekday === 1);
    if (!monday) return;
    setAvailability((current) => {
      const next = current.map((day) => day.professionalId === selectedProfessionalId && day.weekday >= 2 && day.weekday <= 5
        ? { ...day, enabled: monday.enabled, periods: monday.periods.map((period) => ({ ...period, id: createAvailabilityId("period") })) }
        : day);
      saveAvailability(next);
      return next;
    });
  }

  function openBlockForm() {
    setBlockDraft(emptyBlock(selectedProfessionalId));
    setShowBlockForm(true);
  }

  function saveBlock() {
    if (!blockDraft.professionalId || !blockDraft.date || !blockDraft.reason.trim()) return;
    if (!blockDraft.allDay && blockDraft.start >= blockDraft.end) return;
    const nextBlock = { ...blockDraft, id: createAvailabilityId("block") };
    const next = [...blocks, nextBlock];
    setBlocks(next);
    saveBlocks(next);
    setShowBlockForm(false);
  }

  function removeBlock(id: string) {
    const next = blocks.filter((block) => block.id !== id);
    setBlocks(next);
    saveBlocks(next);
  }

  if (!professionals.length) {
    return <div className="content"><div className="card empty-state"><h2>Nenhum profissional ativo</h2><p>Cadastre ou reative um profissional antes de configurar a disponibilidade.</p></div></div>;
  }

  return (
    <div className="content availability-page">
      <div className="page-heading">
        <div><h1>Disponibilidade</h1><p>Defina horários semanais, pausas, folgas e bloqueios individuais.</p></div>
        <button className="button button-primary" onClick={openBlockForm}>+ Novo bloqueio</button>
      </div>

      <div className="card availability-toolbar">
        <div className="field compact-field">
          <label>Profissional</label>
          <select className="input" value={selectedProfessionalId} onChange={(event) => setSelectedProfessionalId(event.target.value)}>
            {professionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}
          </select>
        </div>
        <div className="availability-person-summary">
          <div className="avatar">{selectedProfessional?.name.slice(0, 1).toUpperCase()}</div>
          <div><strong>{selectedProfessional?.name}</strong><span>{selectedProfessional?.specialty}</span></div>
        </div>
        <button className="button button-secondary" onClick={copyMondayToWeekdays}>Copiar segunda para dias úteis</button>
      </div>

      <div className="availability-layout">
        <section className="card panel">
          <div className="panel-header"><div><h3>Horários semanais</h3><p className="table-muted">Use mais de um período para criar pausas, como horário de almoço.</p></div></div>
          <div className="weekly-list">
            {schedule.map((day) => (
              <div className={`weekly-row ${day.enabled ? "" : "day-off"}`} key={day.weekday}>
                <label className="day-switch"><input type="checkbox" checked={day.enabled} onChange={() => toggleDay(day)} /><span>{day.label}</span></label>
                <div className="period-list">
                  {day.enabled ? day.periods.map((period) => (
                    <div className="period-row" key={period.id}>
                      <input className="input" type="time" value={period.start} onChange={(event) => updatePeriod(day, period.id, "start", event.target.value)} />
                      <span>até</span>
                      <input className="input" type="time" value={period.end} onChange={(event) => updatePeriod(day, period.id, "end", event.target.value)} />
                      <button className="small-icon-button" onClick={() => removePeriod(day, period.id)} aria-label="Remover período">×</button>
                    </div>
                  )) : <span className="closed-label">Folga</span>}
                </div>
                <button className="text-button" disabled={!day.enabled} onClick={() => addPeriod(day)}>+ período</button>
              </div>
            ))}
          </div>
        </section>

        <aside className="card panel">
          <div className="panel-header"><div><h3>Bloqueios futuros</h3><p className="table-muted">Férias, consultas, compromissos ou indisponibilidades pontuais.</p></div></div>
          <div className="block-list">
            {professionalBlocks.length ? professionalBlocks.map((block) => (
              <div className="block-item" key={block.id}>
                <div><strong>{new Date(`${block.date}T12:00:00`).toLocaleDateString("pt-BR")}</strong><span>{block.allDay ? "Dia inteiro" : `${block.start} às ${block.end}`}</span><small>{block.reason}</small></div>
                <button className="small-icon-button" onClick={() => removeBlock(block.id)} aria-label="Excluir bloqueio">×</button>
              </div>
            )) : <div className="compact-empty"><strong>Nenhum bloqueio</strong><span>O profissional seguirá apenas os horários semanais.</span></div>}
          </div>
        </aside>
      </div>

      {showBlockForm && <div className="modal-backdrop" onMouseDown={() => setShowBlockForm(false)}>
        <div className="card modal-card" onMouseDown={(event) => event.stopPropagation()}>
          <div className="modal-header"><div><h2>Novo bloqueio</h2><p>Retire um período específico da agenda.</p></div><button className="small-icon-button" onClick={() => setShowBlockForm(false)}>×</button></div>
          <div className="form-grid">
            <div className="field field-wide"><label>Motivo</label><input className="input" value={blockDraft.reason} onChange={(event) => setBlockDraft({ ...blockDraft, reason: event.target.value })} placeholder="Ex.: Consulta médica" /></div>
            <div className="field"><label>Data</label><input className="input" type="date" value={blockDraft.date} onChange={(event) => setBlockDraft({ ...blockDraft, date: event.target.value })} /></div>
            <label className="checkbox-card"><input type="checkbox" checked={blockDraft.allDay} onChange={(event) => setBlockDraft({ ...blockDraft, allDay: event.target.checked })} /><span>Bloquear o dia inteiro</span></label>
            {!blockDraft.allDay && <><div className="field"><label>Início</label><input className="input" type="time" value={blockDraft.start} onChange={(event) => setBlockDraft({ ...blockDraft, start: event.target.value })} /></div><div className="field"><label>Fim</label><input className="input" type="time" value={blockDraft.end} onChange={(event) => setBlockDraft({ ...blockDraft, end: event.target.value })} /></div></>}
          </div>
          <div className="modal-actions"><button className="button button-secondary" onClick={() => setShowBlockForm(false)}>Cancelar</button><button className="button button-primary" onClick={saveBlock}>Salvar bloqueio</button></div>
        </div>
      </div>}
    </div>
  );
}
