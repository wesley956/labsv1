"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Review = { id:string; customer_name:string; rating:number; comment:string; approved:boolean; created_at:string; appointments:{service_name:string;professional_name:string;appointment_date:string}|null };

export function ReviewsManager({businessId,initialItems}:{businessId:string;initialItems:Review[]}){
  const supabase=useMemo(()=>createClient(),[]);
  const[items,setItems]=useState(initialItems);
  const[error,setError]=useState("");
  async function toggle(item:Review){setError("");const{data,error:requestError}=await supabase.from("reviews").update({approved:!item.approved,updated_at:new Date().toISOString()}).eq("id",item.id).eq("business_id",businessId).select("id,customer_name,rating,comment,approved,created_at,appointments(service_name,professional_name,appointment_date)").single();if(requestError)setError(requestError.message);else setItems(current=>current.map(row=>row.id===item.id?data as Review:row));}
  return <div className="content"><div className="page-heading"><div><h1>Avaliações</h1><p>Aprove os comentários que podem aparecer publicamente.</p></div></div>{error&&<div className="notice-box" style={{marginBottom:16}}>{error}</div>}<section className="card panel"><div className="appointment-list">{items.map(item=><div className="appointment-item" key={item.id}><strong>{"★".repeat(item.rating)}<br/><small>{new Date(item.created_at).toLocaleDateString("pt-BR")}</small></strong><div><b>{item.customer_name}</b><br/><small>{item.appointments?.service_name} · {item.appointments?.professional_name}</small>{item.comment&&<p style={{margin:"8px 0 0"}}>{item.comment}</p>}</div><button className={`button ${item.approved?"button-secondary":"button-primary"}`} onClick={()=>void toggle(item)}>{item.approved?"Ocultar":"Aprovar"}</button></div>)}{!items.length&&<div className="empty-state"><strong>Nenhuma avaliação recebida</strong><p>As avaliações enviadas pelos clientes aparecerão aqui.</p></div>}</div></section></div>;
}
