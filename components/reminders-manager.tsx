"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Appointment = { id:string; customer_name:string; customer_phone:string; service_name:string; professional_name:string; appointment_date:string; start_time:string; status:string; reminder_24h_sent_at:string|null; reminder_2h_sent_at:string|null };
type Settings = { name:string; reminder_24h_enabled:boolean; reminder_2h_enabled:boolean; reminder_24h_template:string; reminder_2h_template:string };

function phoneUrl(phone:string,message:string){let value=phone.replace(/\D/g,"");if(value.length<=11)value=`55${value}`;return `https://wa.me/${value}?text=${encodeURIComponent(message)}`;}
function formatDate(value:string){return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric"});}
function renderTemplate(template:string,item:Appointment,businessName:string){return template.replaceAll("{cliente}",item.customer_name).replaceAll("{servico}",item.service_name).replaceAll("{profissional}",item.professional_name).replaceAll("{data}",formatDate(item.appointment_date)).replaceAll("{horario}",item.start_time.slice(0,5)).replaceAll("{estabelecimento}",businessName);}

export function RemindersManager({businessId,appointments,settings}:{businessId:string;appointments:Appointment[];settings:Settings}){
  const supabase=useMemo(()=>createClient(),[]);
  const[items,setItems]=useState(appointments);
  const[savingId,setSavingId]=useState("");
  const[error,setError]=useState("");

  async function send(item:Appointment,type:"24h"|"2h"){
    const template=type==="24h"?settings.reminder_24h_template:settings.reminder_2h_template;
    const message=renderTemplate(template,item,settings.name);
    window.open(phoneUrl(item.customer_phone,message),"_blank","noopener,noreferrer");
    setSavingId(`${item.id}-${type}`);setError("");
    const field=type==="24h"?"reminder_24h_sent_at":"reminder_2h_sent_at";
    const{data,error:requestError}=await supabase.from("appointments").update({[field]:new Date().toISOString()}).eq("id",item.id).eq("business_id",businessId).select("id,customer_name,customer_phone,service_name,professional_name,appointment_date,start_time,status,reminder_24h_sent_at,reminder_2h_sent_at").single();
    if(requestError)setError(requestError.message);else setItems(current=>current.map(row=>row.id===item.id?data:row));
    setSavingId("");
  }

  return <div className="content"><div className="page-heading"><div><h1>Central de lembretes</h1><p>Abra a mensagem pronta no WhatsApp e registre o envio com um clique.</p></div></div>{error&&<div className="notice-box" style={{marginBottom:16}}>{error}</div>}<section className="card panel"><div className="panel-header"><div><h3>Próximos atendimentos</h3><p className="table-muted">São exibidos os próximos três dias.</p></div></div><div className="appointment-list">{items.map(item=><div className="appointment-item" key={item.id}><strong>{formatDate(item.appointment_date)}<br/>{item.start_time.slice(0,5)}</strong><div><b>{item.customer_name}</b><br/><small>{item.service_name} · {item.professional_name}</small></div><div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>{settings.reminder_24h_enabled&&<button className="button button-secondary" disabled={Boolean(item.reminder_24h_sent_at)||savingId===`${item.id}-24h`} onClick={()=>void send(item,"24h")}>{item.reminder_24h_sent_at?"24h enviado":"Enviar 24h"}</button>}{settings.reminder_2h_enabled&&<button className="button button-secondary" disabled={Boolean(item.reminder_2h_sent_at)||savingId===`${item.id}-2h`} onClick={()=>void send(item,"2h")}>{item.reminder_2h_sent_at?"2h enviado":"Enviar 2h"}</button>}</div></div>)}{!items.length&&<div className="empty-state"><strong>Nenhum atendimento nos próximos dias</strong><p>Os lembretes aparecerão aqui automaticamente.</p></div>}</div></section></div>;
}
