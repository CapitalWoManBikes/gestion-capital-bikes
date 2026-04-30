import { useState, useEffect, useRef } from "react";
import emailjs from '@emailjs/browser';
import { saveShopData, loadShopDataOnce } from './firebase';

// ─── Configuración EmailJS (cámbiala desde la interfaz o aquí) ───────────────
const EMAILJS_SERVICE_ID          = "service_dzchw0a";
const EMAILJS_TEMPLATE_ID         = "2ux0vlp";
const EMAILJS_SERVICE_TEMPLATE_ID = "template_fcgenmc";
const EMAILJS_PUBLIC_KEY          = "UgKvCtUeZVka8ji8t";
const ADMIN_EMAIL                 = "capital.woman.bikes@gmail.com";

// ─── Fases del servicio de bici ──────────────────────────────────────────────
const PHASES = [
  { id: 1, name: "Desarme",            icon: "🔧", color: "#e8a020", msg: "Tu bici está siendo desarmada para su revisión." },
  { id: 2, name: "Lavado",             icon: "💧", color: "#5cc8e8", msg: "Tu bici está siendo limpiada a fondo." },
  { id: 3, name: "Ensamble",           icon: "⚙️", color: "#9c4a9e", msg: "Tu bici está siendo ensamblada y ajustada." },
  { id: 4, name: "Lista para recoger", icon: "✅", color: "#4caf50", msg: "¡Tu bici está lista! Puedes pasar a recogerla." },
];

interface DiagnosticUpdate {
  id: string; date: string;
  estado: string; hallazgos: string; problemas: string; recomendaciones: string;
  partes: string[];
}
interface BikeService {
  id: string; clientName: string; clientEmail: string;
  bikeDescription: string; date: string; phase: number;
  createdAt: string; notes: string;
  serviceType?: string;
  startTime?: string; endTime?: string; technicianId?: string;
  paymentStatus?: "pendiente" | "pagado" | "adelanto";
  paymentAmount?: number;
  deliveryStatus?: "en_taller" | "lista" | "entregada";
  neededByDate?: string;
  completedAt?: string;
  diagnosticUpdates?: DiagnosticUpdate[];
}
interface AppTask {
  id: string; title: string; assignedTo: string;
  tag: string; done: boolean; createdAt: string;
  date?: string; hasTime?: boolean; startTime?: string; endTime?: string;
}
interface Appointment {
  id: string; client: string; service: string; assignedTo: string;
  date: string; startTime: string; endTime: string; notes: string; createdAt: string;
}
interface Session {
  type: "admin" | "employee";
  id?: string; name?: string; role?: string;
}

// ─── Helpers de fecha ────────────────────────────────────────────────────────
const _fmtDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const _addDays = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return _fmtDate(d);
};

const SERVICES_CATALOG: { category: string; items: { code: string; name: string; price: number }[] }[] = [
  {
    category: "🔧 Mantenimiento Profesional",
    items: [
      { code: "SERMANT001", name: "Mant Pro Ruta Sin Disco",                            price: 130000 },
      { code: "SERMANT002", name: "Mant Pro Ruta Con Disco",                            price: 140000 },
      { code: "SERMANT003", name: "Mant Pro MTB Sin Disco",                             price: 130000 },
      { code: "SERMANT004", name: "Mant Pro MTB Con Disco",                             price: 140000 },
      { code: "SERMANT005", name: "Mant Pro Fija",                                      price: 80000  },
      { code: "SERMANT006", name: "Mant Pro Coaster",                                   price: 90000  },
      { code: "SERMANT007", name: "Mant Pro Libre Con Frenos",                          price: 100000 },
      { code: "SERMANT008", name: "Mant Pro Gravel Sin Disco",                          price: 130000 },
      { code: "SERMANT009", name: "Mant Pro Gravel Con Disco",                          price: 140000 },
      { code: "SERMANT010", name: "Mant Pro Cargo Con Disco",                           price: 160000 },
      { code: "SERMANT011", name: "Mant Pro Cargo Sin Disco",                           price: 150000 },
      { code: "SERMANT012", name: "Mant Pro Ruta · Actualización Sistema Electrónico",  price: 50000  },
    ],
  },
  {
    category: "🔄 Mantenimiento de Seguimiento",
    items: [
      { code: "MANTSEG001", name: "Mant Seg Ruta Sin Disco",    price: 60000 },
      { code: "MANTSEG002", name: "Mant Seg Ruta Con Disco",    price: 70000 },
      { code: "MANTSEG003", name: "Mant Seg MTB Sin Disco",     price: 60000 },
      { code: "MANTSEG004", name: "Mant Seg MTB Con Disco",     price: 70000 },
      { code: "MANTSEG005", name: "Mant Seg Fija",              price: 40000 },
      { code: "MANTSEG006", name: "Mant Seg Coaster",           price: 40000 },
      { code: "MANTSEG007", name: "Mant Seg Libre Con Frenos",  price: 50000 },
      { code: "MANTSEG008", name: "Mant Seg Gravel Con Disco",  price: 70000 },
      { code: "MANTSEG009", name: "Mant Seg Gravel Sin Disco",  price: 60000 },
      { code: "MANTSEG010", name: "Mant Seg Cargo Con Disco",   price: 80000 },
      { code: "MANTSEG011", name: "Mant Seg Cargo Sin Disco",   price: 70000 },
    ],
  },
  {
    category: "⚡ Performance",
    items: [
      { code: "MANTPER001", name: "Performance Fija",          price: 65000 },
      { code: "MANTPER002", name: "Performance Ruta",          price: 90000 },
      { code: "MANTPER003", name: "Performance Libre",         price: 70000 },
      { code: "MANTPER004", name: "Performance MTB / Gravel",  price: 95000 },
    ],
  },
  {
    category: "🚀 Alistamiento Express",
    items: [
      { code: "ALEX001", name: "Alistamiento Express Fija",         price: 20000 },
      { code: "ALEX002", name: "Alistamiento Express Ruta",         price: 30000 },
      { code: "ALEX003", name: "Alistamiento Express Libre",        price: 25000 },
      { code: "ALEX004", name: "Alistamiento Express MTB / Gravel", price: 35000 },
    ],
  },
  {
    category: "🔩 Componentes",
    items: [
      { code: "MANT001",  name: "Mant Rueda",                  price: 20000  },
      { code: "MANT002",  name: "Mant Centro",                 price: 25000  },
      { code: "MANT003",  name: "Mant Cajas de Dirección",     price: 20000  },
      { code: "MANT004",  name: "Mant Pedales",                price: 35000  },
      { code: "MANT005",  name: "Mant Núcleo",                 price: 35000  },
      { code: "MANT009",  name: "Mant Tensor",                 price: 50000  },
      { code: "MANT0010", name: "Instalación Kit SRAM",        price: 180000 },
      { code: "MANT0011", name: "Mant Mordazas Hidráulicas",   price: 70000  },
    ],
  },
  {
    category: "💪 Ergonomía",
    items: [
      { code: "MANT006", name: "Mant Ergo",    price: 120000 },
      { code: "MANT008", name: "Mant Ergo X2", price: 200000 },
    ],
  },
  {
    category: "🌊 Suspensión",
    items: [
      { code: "PREVSUS001", name: "Preventivo Suspensión",               price: 40000  },
      { code: "PREVSUS002", name: "Mant Suspensión Completo",            price: 150000 },
      { code: "PREVSUS003", name: "Mant Suspensión Hidráulica",          price: 50000  },
    ],
  },
  {
    category: "🛠 Reparaciones Especiales",
    items: [
      { code: "REP005", name: "Reparación Ruedas Carbono", price: 330000 },
    ],
  },
];

// Listado plano para búsquedas rápidas
const SERVICES_FLAT = SERVICES_CATALOG.flatMap(g => g.items);

function buildTrackingUrl(service: BikeService): string {
  const phase = PHASES.find(p => p.id === service.phase);
  const data = {
    clientName: service.clientName, bikeDescription: service.bikeDescription,
    phase: service.phase, phaseName: phase?.name || "", phaseMsg: phase?.msg || "",
    phaseIcon: phase?.icon || "", phaseColor: phase?.color || "#6c1f6e",
    date: service.date, id: service.id,
    neededByDate: service.neededByDate,
    completedAt: service.completedAt,
    diagnosticUpdates: service.diagnosticUpdates || [],
  };
  return `${window.location.origin}${window.location.pathname}?track=${btoa(encodeURIComponent(JSON.stringify(data)))}`;
}

function urgencyInfo(neededByDate: string | undefined): { label: string; color: string; bg: string } | null {
  if (!neededByDate) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const needed = new Date(neededByDate + "T00:00:00");
  const diff = Math.ceil((needed.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return { label: `🔴 Vencida hace ${Math.abs(diff)}d`, color: "#c0392b", bg: "rgba(192,57,43,.12)" };
  if (diff <= 1) return { label: diff === 0 ? "🔴 Necesaria hoy" : "🔴 Necesaria mañana", color: "#c0392b", bg: "rgba(192,57,43,.12)" };
  if (diff <= 3) return { label: `⚠️ Necesaria en ${diff}d`, color: "#e8a020", bg: "rgba(232,160,32,.12)" };
  return { label: `📅 Necesaria en ${diff}d`, color: "#4caf50", bg: "rgba(76,175,80,.1)" };
}

// ─── Colores de marca Capital Wo-Man Bikes ───────────────────────────────────
// Morado: #6c1f6e  |  Cyan: #5cc8e8

const LOGO_B64 = "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";
const LOGO_SRC = `data:image/png;base64,${LOGO_B64}`;

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&family=Caveat:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  :root {
    --ink: #1d1a16;
    --ink-2: #3a362f;
    --ink-3: #6b6559;
    --paper: #fbfbf9;
    --paper-2: #f0eee9;
    --line: #2a261f;
    --accent: #6c1f6e;
    --accent-soft: #f3e3f0;
    --accent-2: #5cc8e8;
    --accent-2-soft: #e6f6fc;
    --lunch: #5cc8e8;
    --lunch-soft: #e6f6fc;
    --done: #3a8a3a;
    --mono: "JetBrains Mono", ui-monospace, monospace;
    --hand: "Kalam", cursive;
    --title: "Caveat", cursive;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#f0eee9;color:var(--ink);font-family:var(--hand);}

  .sk-box{border:1.6px solid var(--line);border-radius:14px 10px 12px 11px/11px 13px 10px 12px;background:var(--paper);position:relative;}
  .sk-box.tight{border-radius:8px 6px 7px 6px/6px 8px 6px 7px;}
  .sk-box.dashed{border-style:dashed;}
  .sk-box.fill{background:var(--paper-2);}
  .sk-box.ink{background:var(--ink);color:var(--paper);border-color:var(--ink);}
  .sk-box.accent{background:var(--accent);color:#fff;border-color:var(--ink);}
  .sk-hr{height:0;border:0;border-top:1.4px solid var(--line);margin:10px 0;}
  .sk-hr.dashed{border-top-style:dashed;}
  .sk-hr.wavy{border:0;height:8px;background-image:radial-gradient(circle at 4px 4px,transparent 2px,var(--line) 2.2px,transparent 2.6px);background-size:10px 8px;opacity:.7;}

  .chip{display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border:1.3px solid var(--line);border-radius:999px;font-size:12px;font-family:var(--mono);background:var(--paper);white-space:nowrap;}
  .chip.ink{background:var(--ink);color:var(--paper);border-color:var(--ink);}
  .chip.accent{background:var(--accent);color:#fff;border-color:var(--ink);}
  .chip.lunch{background:var(--lunch);color:#fff;border-color:var(--ink);}
  .chip.dash{border-style:dashed;}
  .chip.done-chip{background:var(--done);color:#fff;border-color:var(--done);}

  .dot{width:8px;height:8px;border-radius:50%;background:var(--ink);display:inline-block;flex-shrink:0;}
  .dot.g{background:#3a8a3a;}
  .dot.a{background:var(--accent);}
  .dot.l{background:var(--lunch);}
  .dot.o{background:transparent;border:1.3px solid var(--line);}

  .avatar{width:36px;height:36px;border-radius:50%;background:var(--paper-2);border:1.4px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-family:var(--title);font-size:18px;font-weight:700;color:var(--ink);flex-shrink:0;}
  .avatar.xs{width:24px;height:24px;font-size:13px;}
  .avatar.sm{width:28px;height:28px;font-size:14px;}
  .avatar.lg{width:54px;height:54px;font-size:26px;}
  .avatar.xl{width:80px;height:80px;font-size:38px;}
  .avatar.lunch{border-color:var(--lunch);background:var(--lunch-soft);}
  .avatar.busy{border-color:var(--accent);background:var(--accent-soft);}

  .scribble{background:linear-gradient(transparent 55%,rgba(108,31,110,.25) 55% 80%,transparent 80%);padding:0 2px;}
  .sk-mono{font-family:var(--mono);}.sk-title{font-family:var(--title);letter-spacing:.5px;}
  .muted{color:var(--ink-3);}.sub{color:var(--ink-2);}
  .row{display:flex;align-items:center;}.stack{display:flex;flex-direction:column;}
  .between{justify-content:space-between;}
  .gap-2{gap:8px;}.gap-3{gap:12px;}.gap-4{gap:16px;}.gap-6{gap:24px;}
  .p-3{padding:12px;}.p-4{padding:16px;}.p-5{padding:20px;}
  .pt-2{padding-top:8px;}.pb-2{padding-bottom:8px;}
  .text-xs{font-size:11px;}.text-sm{font-size:13px;}.text-md{font-size:15px;}
  .text-lg{font-size:18px;}.text-xl{font-size:22px;}.text-2xl{font-size:28px;}.text-3xl{font-size:36px;}
  .tracked{letter-spacing:.6px;text-transform:uppercase;}
  .w-full{width:100%;}.tick{color:var(--done);font-family:var(--mono);}
  .placeholder{background:repeating-linear-gradient(45deg,var(--paper) 0 6px,var(--paper-2) 6px 12px);border:1.3px dashed var(--line);font-family:var(--mono);color:var(--ink-3);font-size:11px;display:flex;align-items:center;justify-content:center;}

  .phone{width:300px;height:600px;background:var(--paper);border:2px solid var(--ink);border-radius:34px;position:relative;overflow:hidden;padding:36px 14px 18px;margin:auto;}
  .phone .notch{position:absolute;top:8px;left:50%;transform:translateX(-50%);width:70px;height:6px;background:var(--ink);border-radius:6px;}
  .phone-inner{width:100%;height:100%;overflow:hidden;position:relative;display:flex;flex-direction:column;}

  .nav{width:210px;min-width:210px;background:var(--paper-2);border-right:1.4px solid var(--line);display:flex;flex-direction:column;}
  .nav-brand{padding:16px 18px;border-bottom:1.4px dashed var(--line);}
  .nav-brand img{width:100%;max-width:160px;display:block;}
  .nav-item{display:flex;align-items:center;gap:10px;padding:9px 18px;font-size:13px;cursor:pointer;border-left:3px solid transparent;transition:all .15s;white-space:nowrap;}
  .nav-item:hover{background:rgba(0,0,0,.04);}
  .nav-item.active{border-left-color:var(--accent);background:var(--accent-soft);}
  .nav-section{font-family:var(--mono);font-size:10px;letter-spacing:.8px;color:var(--ink-3);padding:14px 18px 4px;text-transform:uppercase;}

  .app-layout{display:flex;height:100vh;overflow:hidden;}
  .main-content{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}
  .content-area{flex:1;overflow-y:auto;}

  .app-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 18px;border-bottom:1.4px solid var(--line);background:var(--paper);flex-shrink:0;gap:14px;}
  .app-bar-left{display:flex;align-items:center;gap:12px;min-width:0;flex:1;}
  .app-bar-divider{width:1px;height:30px;background:var(--line);opacity:.4;flex-shrink:0;}

  .section-tabs{display:flex;border-bottom:1.4px solid var(--line);background:var(--paper-2);flex-shrink:0;overflow-x:auto;}
  .section-tab{padding:9px 16px;font-family:var(--mono);font-size:11px;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;border-right:1.2px solid var(--line);border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap;}
  .section-tab:hover{background:rgba(0,0,0,.04);}
  .section-tab.active{border-bottom-color:var(--accent);background:var(--paper);}

  .list-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1.2px dashed var(--line);}
  .list-row:last-child{border-bottom:none;}
  .task-item{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1.2px dashed var(--line);transition:background .12s;}
  .task-item:hover{background:var(--paper-2);}
  .kcard{padding:12px;border-radius:8px 6px 7px 6px/6px 8px 6px 7px;background:var(--paper);border:1.4px solid var(--line);transition:transform .15s;cursor:default;}
  .kcard:hover{transform:translateY(-1px);}
  .tblock{position:absolute;top:6px;bottom:6px;border:1.4px solid var(--line);border-radius:6px 4px 7px 5px/5px 7px 4px 6px;padding:3px 8px;font-family:var(--mono);font-size:11px;display:flex;align-items:center;overflow:hidden;white-space:nowrap;}
  .cal-day{flex:1;border-right:1.2px dashed var(--line);padding:8px;min-width:0;}
  .cal-day:last-child{border-right:none;}
  .cal-event{padding:4px 6px;font-size:11px;border:1.3px solid var(--line);border-radius:6px 4px 7px 5px/5px 7px 4px 6px;margin-bottom:6px;}
  .lunch-bar{height:8px;background:var(--paper-2);border:1.3px solid var(--line);border-radius:4px;position:relative;overflow:hidden;margin-top:4px;}
  .lunch-bar-fill{position:absolute;left:0;top:0;bottom:0;background:var(--lunch);border-radius:3px;transition:width 1s linear;}
  .prog-bar{height:8px;background:var(--paper-2);border:1.3px solid var(--line);border-radius:4px;position:relative;overflow:hidden;}
  .prog-bar-fill{position:absolute;left:0;top:0;bottom:0;background:var(--accent);border-radius:3px;}

  button.action{background:none;border:1.3px solid var(--line);border-radius:999px;padding:4px 12px;font-family:var(--hand);font-size:13px;cursor:pointer;transition:all .15s;white-space:nowrap;}
  button.action:hover{background:var(--paper-2);}
  button.action.ink{background:var(--ink);color:var(--paper);border-color:var(--ink);}
  button.action.ink:hover{opacity:.85;}
  button.action.accent{background:var(--accent);color:#fff;border-color:var(--accent);}
  button.action.lunch-btn{background:var(--lunch);color:#fff;border-color:var(--lunch);}

  .notif-banner{background:var(--lunch);color:#fff;padding:10px 18px;display:flex;align-items:center;gap:12px;border-bottom:1.4px solid var(--line);flex-shrink:0;}
  .notif-banner.in-banner{background:var(--accent);}

  @keyframes fadeIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
  .fade-in{animation:fadeIn .2s ease;}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.6;}}
  .pulse{animation:pulse 2s ease-in-out infinite;}

  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:rgba(0,0,0,.2);border-radius:2px;}

  /* ── Barra de navegación móvil (oculta en escritorio) ── */
  .mobile-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--paper-2);border-top:1.4px solid var(--line);z-index:200;padding:4px 0 env(safe-area-inset-bottom,0);}
  .mobile-nav-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;cursor:pointer;color:var(--ink-3);font-family:var(--mono);font-size:9px;letter-spacing:.3px;text-transform:uppercase;border-top:2px solid transparent;transition:color .15s,border-color .15s;-webkit-tap-highlight-color:transparent;}
  .mobile-nav-item.active{color:var(--accent);border-top-color:var(--accent);}
  .mobile-nav-item span{max-width:52px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-align:center;}

  /* ── Responsive ── */
  @media (max-width:768px){
    .nav{display:none!important;}
    .mobile-nav{display:flex!important;}
    .app-layout{flex-direction:column;}
    .content-area{padding-bottom:80px;}
    .app-bar{padding:8px 12px;gap:8px;}
    .app-bar-left{gap:8px;}
    .app-bar-divider{display:none;}
    .app-bar .chip{display:none;}
    .section-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
    .section-tabs::-webkit-scrollbar{display:none;}
    .section-tab{padding:10px 14px;font-size:10px;flex-shrink:0;}
    .list-row{flex-wrap:wrap;gap:6px;}
    .kcard{touch-action:manipulation;}
    .task-item{padding:12px 10px;}
    .cal-day{min-width:120px;}
    .text-3xl{font-size:22px;}
    .text-2xl{font-size:18px;}
    .text-xl{font-size:16px;}
    .phone{width:100%;max-width:260px;}
    button.action{min-height:36px;}
    .mobile-nav-item{padding:8px 2px;}
  }
  @media (max-width:480px){
    .app-bar .action{display:none;}
    .nav-section span:last-child{display:none;}
    button.action{min-height:40px;}
  }

  /* ── Calendario: tipo de evento ── */
  .cal-event.ev-service{background:#fff9c4;border-color:#c8a800;}
  .cal-event.ev-task{background:#dbeafe;border-color:#3b82f6;}
  .cal-event.ev-bici{background:rgba(108,31,110,.1);border-color:#6c1f6e;}
  .cal-day{position:relative;}
  .cal-add-btn{position:absolute;bottom:6px;right:6px;background:var(--ink);color:var(--paper);border:none;border-radius:999px;width:22px;height:22px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;opacity:0;transition:opacity .15s;padding:0;}
  .cal-day:hover .cal-add-btn{opacity:.8;}

  /* ── Modal general ── */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:600;padding:12px;}
  .modal-box{background:var(--paper);border:2px solid var(--line);border-radius:18px 14px 16px 15px/15px 17px 14px 16px;padding:24px;width:440px;max-width:100%;max-height:88vh;overflow-y:auto;}
  .field-group{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}
  .field-label{font-family:var(--mono);font-size:11px;letter-spacing:.6px;text-transform:uppercase;color:var(--ink-3);}
  .field-input{border:1.4px solid var(--line);border-radius:8px 6px 7px 6px/6px 8px 6px 7px;padding:8px 12px;font-family:var(--hand);font-size:13px;background:var(--paper);width:100%;outline:none;color:var(--ink);}
  .field-input:focus{border-color:var(--accent);}
  select.field-input{cursor:pointer;}
  textarea.field-input{resize:vertical;min-height:56px;}

  /* ── Chips de tipo ── */
  .serv-tag{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;font-size:11px;font-family:var(--mono);background:#fff9c4;border:1.2px solid #c8a800;color:#7a5500;}
  .task-tag-b{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;font-size:11px;font-family:var(--mono);background:#dbeafe;border:1.2px solid #3b82f6;color:#1d4ed8;}

  /* ── Vista colaborador (EmployeeDashboard mejorado) ── */
  .serv-card-emp{padding:14px;border:1.5px solid #c8a800;border-radius:12px;background:#fffdf0;margin-bottom:10px;}
  .maint-card{padding:12px;border:1.3px dashed var(--line);border-radius:10px;background:var(--paper);cursor:pointer;transition:background .12s;}
  .maint-card:hover{background:var(--accent-soft);}
  @media(max-width:768px){.modal-box{padding:18px;}.field-input{font-size:15px;}}
`;

// ─── Equipo (datos iniciales — la lista real vive en App state) ──────────────
const INITIAL_TEAM = [
  { id: "s", name: "Sergio", role: "Mecánico", initials: "S" },
  { id: "c", name: "Cindy", role: "Tienda/Caja", initials: "C" },
];

// Modal para añadir/gestionar miembros
function MemberModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const roles = ["Mecánico", "Tienda/Caja", "Administración", "Reparto", "Otro"];
  const initials = name.trim().split(" ").map(w => w[0] || "").join("").toUpperCase().slice(0, 2);
  const canAdd = name.trim().length > 0 && role.length > 0;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="sk-box p-5" style={{ width: "100%", maxWidth: 380, background: "var(--paper)", position: "relative" }}>
        <div className="sk-title text-2xl" style={{ marginBottom: 16 }}>Añadir miembro</div>
        <div className="stack gap-3">
          <div>
            <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 6 }}>NOMBRE COMPLETO</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: María López"
              style={{ width: "100%", padding: "8px 12px", border: "1.4px solid var(--line)", borderRadius: 8, fontFamily: "var(--hand)", fontSize: 15, background: "var(--paper)", outline: "none" }} />
          </div>
          <div>
            <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 6 }}>ROL</div>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {roles.map(r => (
                <button key={r} className={"action" + (role === r ? " accent" : "")} style={{ fontSize: 12, padding: "3px 10px" }} onClick={() => setRole(r)}>{r}</button>
              ))}
            </div>
          </div>
          {name.trim() && role && (
            <div className="sk-box fill p-3 row gap-3" style={{ marginTop: 4 }}>
              <div className="avatar lg" style={{ background: "var(--accent-soft)", borderColor: "var(--accent)", color: "var(--accent)", fontFamily: "var(--title)", fontSize: 22, fontWeight: 700 }}>{initials}</div>
              <div className="stack">
                <div style={{ fontWeight: 700, fontSize: 15 }}>{name.trim()}</div>
                <div className="sk-mono text-xs muted">{role}</div>
              </div>
            </div>
          )}
        </div>
        <div className="row gap-2" style={{ marginTop: 20, justifyContent: "flex-end" }}>
          <button className="action" onClick={onClose}>Cancelar</button>
          <button className="action ink" disabled={!canAdd} style={{ opacity: canAdd ? 1 : .4 }}
            onClick={() => { if (canAdd) { onAdd({ name: name.trim(), role, initials }); onClose(); } }}>
            Añadir al equipo
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 4 }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "7px 10px", border: "1.4px solid var(--line)", borderRadius: 8, fontFamily: "var(--hand)", fontSize: 14, background: "var(--paper)", outline: "none" }} />
    </div>
  );
}

// ─── Modal edición privada (solo admin) ──────────────────────────────────────
function EditMemberModal({ person, extData = {}, onClose, onSave }) {
  const ADMIN_PIN = "1234";
  const [pinOk, setPinOk] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [name, setName] = useState(person.name);
  const [role, setRole] = useState(person.role);
  const [salario, setSalario] = useState(extData.salario || "");
  const [direccion, setDireccion] = useState(extData.direccion || "");
  const [documento, setDocumento] = useState(extData.documento || "");
  const [eps, setEps] = useState(extData.eps || "");
  const [horasSemana, setHorasSemana] = useState(extData.horasSemana || "40");
  const [employeePin, setEmployeePin] = useState(extData.pin || "");
  const [permissions, setPermissions] = useState(extData.permissions || { ...DEFAULT_PERMISSIONS });
  const roles = ["Mecánico", "Tienda/Caja", "Administración", "Reparto", "Otro"];
  const verifyPin = () => {
    if (pin === ADMIN_PIN) { setPinOk(true); setPinError(""); }
    else setPinError("PIN incorrecto. Solo administración puede editar.");
  };
  const save = () => {
    onSave({ name, role, salario, direccion, documento, eps, horasSemana, pin: employeePin, permissions });
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="sk-box p-5" style={{ width: "100%", maxWidth: 440, background: "var(--paper)", maxHeight: "92vh", overflowY: "auto", position: "relative" }}>
        {!pinOk ? (
          <>
            <div className="sk-title text-2xl" style={{ marginBottom: 4 }}>Acceso restringido</div>
            <div className="sk-mono text-xs muted" style={{ marginBottom: 20 }}>Solo administración · introduce tu PIN</div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                onKeyDown={e => e.key === "Enter" && verifyPin()}
                placeholder="••••"
                maxLength={8}
                autoFocus
                style={{
                  textAlign: "center", letterSpacing: 10, width: 160, padding: "10px 12px",
                  border: "1.4px solid var(--line)", borderRadius: 8,
                  fontFamily: "var(--mono)", fontSize: 22, background: "var(--paper)", outline: "none"
                }}
              />
              {pinError && <div className="sk-mono text-xs" style={{ color: "#c0392b", marginTop: 8 }}>{pinError}</div>}
            </div>
            <div className="row gap-2" style={{ justifyContent: "flex-end" }}>
              <button className="action" onClick={onClose}>Cancelar</button>
              <button className="action ink" onClick={verifyPin}>Entrar</button>
            </div>
          </>
        ) : (
          <>
            <div className="sk-title text-2xl" style={{ marginBottom: 4 }}>Editar · {person.name}</div>
            <div className="sk-mono text-xs muted" style={{ marginBottom: 20 }}>Datos privados · solo administración 🔐</div>
            <div className="stack gap-3">
              <Field label="NOMBRE COMPLETO" value={name} onChange={setName} placeholder="Nombre completo" />
              <div>
                <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 6 }}>ROL</div>
                <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                  {roles.map(r => (
                    <button key={r} className={"action" + (role === r ? " accent" : "")} style={{ fontSize: 12, padding: "3px 10px" }} onClick={() => setRole(r)}>{r}</button>
                  ))}
                </div>
              </div>
              <hr className="sk-hr dashed" />
              <Field label="N.º DOCUMENTO (DNI / NIT / CC)" value={documento} onChange={setDocumento} placeholder="12345678A" />
              <Field label="DIRECCIÓN" value={direccion} onChange={setDireccion} placeholder="Calle, número, ciudad" />
              <Field label="EPS / SEGURO MÉDICO" value={eps} onChange={setEps} placeholder="Nombre de la EPS" />
              <Field label="SALARIO (€ o $ / mes)" value={salario} onChange={setSalario} placeholder="1.850" />
              <Field label="HORAS SEMANALES OBLIGATORIAS" value={horasSemana} onChange={setHorasSemana} placeholder="40" />
              <hr className="sk-hr dashed" />
              <Field label="PIN DE ACCESO COLABORADOR (4 dígitos)" value={employeePin} onChange={setEmployeePin} placeholder="1234" />
              <hr className="sk-hr dashed" />
              <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 10 }}>PERMISOS</div>
              {([
                { key: "canScheduleServices", label: "Puede agendar servicios" },
                { key: "canEditAppointments", label: "Puede editar agendamientos" },
                { key: "canRegisterBikes", label: "Puede registrar bicicletas" },
                { key: "canModifyServices", label: "Puede modificar servicios" },
              ] as const).map(p => (
                <div key={p.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13 }}>{p.label}</span>
                  <button
                    className={"action" + (permissions[p.key] ? " accent" : "")}
                    style={{ fontSize: 12, padding: "3px 10px", minWidth: 80 }}
                    onClick={() => setPermissions((prev: any) => ({ ...prev, [p.key]: !prev[p.key] }))}
                  >
                    {permissions[p.key] ? "✓ Activo" : "Inactivo"}
                  </button>
                </div>
              ))}
            </div>
            <div className="row gap-2" style={{ marginTop: 24, justifyContent: "flex-end" }}>
              <button className="action" onClick={onClose}>Cancelar</button>
              <button className="action ink" onClick={save}>Guardar cambios</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Primitivas ──────────────────────────────────────────────────────────────
function Logo({ height = 28 }) {
  return <img src={LOGO_SRC} alt="Capital Wo-Man Bikes" style={{ height, display: "block", objectFit: "contain" }} />;
}

function Av({ p, size = "sm", state }) {
  const cls = ["avatar", size, state === "lunch" ? "lunch" : state === "busy" ? "busy" : ""].filter(Boolean).join(" ");
  return <div className={cls}>{p.initials}</div>;
}

function StatusPill({ state }) {
  if (state === "lunch") return <span className="chip lunch"><span className="dot" style={{ background: "#fff" }} />ALMUERZO</span>;
  if (state === "busy") return <span className="chip accent"><span className="dot" style={{ background: "#fff" }} />EN TAREA</span>;
  if (state === "in") return <span className="chip accent"><span className="dot" style={{ background: "#fff" }} />EN TURNO</span>;
  if (state === "off") return <span className="chip dash"><span className="dot o" />LIBRE</span>;
  return <span className="chip"><span className="dot g" />DISPONIBLE</span>;
}

function Check({ on, onClick }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="none" stroke="var(--ink)" strokeWidth="1.4" />
      {on && <path d="M4 8.5 L7 11 L12 4.5" fill="none" stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function Icon({ d, size = 18, stroke = 1.6 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
}
const I = {
  bell: <><path d="M6 8a6 6 0 0 1 12 0v5l1.5 2h-15L6 13V8Z" /><path d="M10 18a2 2 0 0 0 4 0" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  chev: <><path d="M9 6l6 6-6 6" /></>,
  lunch: <><path d="M4 3v8a3 3 0 0 0 3 3v7" /><path d="M9 3v8" /><path d="M14 3c-1 1-2 3-2 5s1 3 2 3v9" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  home: <><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1Z" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><circle cx="17" cy="7" r="2.3" /><path d="M15 14c3 0 6 2 6 5" /></>,
  tasks: <><path d="M5 4h10l4 4v12H5z" /><path d="M15 4v4h4" /><path d="M9 12h6M9 15h4" /></>,
  coin: <><circle cx="12" cy="12" r="8" /><path d="M12 7v10M9.5 9.5c0-1 1-1.5 2.5-1.5s2.5.5 2.5 1.8-1 1.7-2.5 1.7-2.5.4-2.5 1.7 1 1.8 2.5 1.8 2.5-.5 2.5-1.5" /></>,
  dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></>,
  note: <><path d="M5 4h10l4 4v12H5z" /><path d="M15 4v4h4" /></>,
  in: <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></>,
  out: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
  wrench: <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>,
};

function MiniLine({ w = 120, h = 34, seed = 1 }) {
  const pts = [];
  let y = h * 0.5;
  for (let i = 0; i < 12; i++) {
    y += (Math.sin(i * 1.3 + seed) * 0.5 + Math.cos(i * 0.7 + seed * 2) * 0.3) * h * 0.25;
    y = Math.max(6, Math.min(h - 6, y));
    pts.push(`${(i / 11) * w},${y.toFixed(1)}`);
  }
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <polyline points={pts.join(" ")} fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="0" y1={h - 1} x2={w} y2={h - 1} stroke="var(--line)" strokeWidth=".8" strokeDasharray="2 3" />
    </svg>
  );
}
function MiniBars({ n = 7, w = 120, h = 34, seed = 1 }) {
  const bw = w / (n * 1.6);
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {Array.from({ length: n }).map((_, i) => {
        const v = (Math.sin(i * 1.7 + seed) * 0.4 + 0.6) * h * 0.8;
        return <rect key={i} x={i * (bw * 1.6) + 2} y={h - v - 1} width={bw} height={v} fill="none" stroke="var(--ink)" strokeWidth="1.3" />;
      })}
    </svg>
  );
}

function AppBar({ title, breadcrumb, children }) {
  return (
    <div className="app-bar">
      <div className="app-bar-left">
        <Logo height={26} />
        <div className="app-bar-divider" />
        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
          {breadcrumb && <div className="sk-mono text-xs muted" style={{ whiteSpace: "nowrap" }}>{breadcrumb}</div>}
          <div className="sk-title text-xl" style={{ lineHeight: 1, whiteSpace: "nowrap" }}>{title}</div>
        </div>
      </div>
      <div className="row gap-2" style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

// ─── SECCIÓN 1: Dashboard ────────────────────────────────────────────────────
function DashLista({ lunchState, shiftState, team = INITIAL_TEAM, onRemove }) {
  const [tasks, setTasks] = useState([
    { id: 1, who: "s", label: "Cambio cadena #112", done: true },
    { id: 2, who: "s", label: "Revisión frenos #108", done: false },
    { id: 3, who: "s", label: "Montaje bici #115", done: false },
    { id: 4, who: "c", label: "Facturas abril", done: true },
    { id: 5, who: "c", label: "Llamar Shimano", done: false },
    { id: 6, who: "c", label: "Nómina + 3", done: false },
  ]);
  const toggle = id => setTasks(t => t.map(x => x.id === id ? { ...x, done: !x.done } : x));
  const done = tasks.filter(t => t.done).length;

  return (
    <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 18, padding: 18, flex: 1 }}>
      <div className="stack gap-3">
        <div className="sk-mono text-xs tracked muted">PERSONAS (2)</div>

        {team.map((p, idx) => {
          const isLunch = lunchState && p.id === "s";
          const inShift = !!shiftState[p.id];
          const pStatus = !inShift ? "off" : isLunch ? "lunch" : "ok";
          return (
            <div key={p.id} className="sk-box p-4" style={isLunch ? { borderColor: "var(--lunch)", borderWidth: 2 } : inShift ? { borderColor: "var(--accent)", borderWidth: 2 } : {}}>
              <div className="row between">
                <div className="row gap-3">
                  <Av p={p} size="lg" state={isLunch ? "lunch" : inShift ? "busy" : null} />
                  <div className="stack" style={{ gap: 4 }}>
                    <div className="text-lg" style={{ fontWeight: 700 }}>{p.name} · {p.role}</div>
                    <StatusPill state={pStatus} />
                    {inShift && isLunch && <div className="sk-mono text-xs muted">en almuerzo · no molestar</div>}
                    {inShift && !isLunch && <div className="sk-mono text-xs muted">turno activo</div>}
                    {!inShift && <div className="sk-mono text-xs muted">fuera de turno</div>}
                  </div>
                </div>
                <div className="stack" style={{ alignItems: "flex-end", gap: 4 }}>
                  <MiniBars n={5} seed={idx + 1} />
                  <div className="sk-mono text-xs muted">carga semana</div>
                  {onRemove && <button onClick={() => onRemove(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 11, fontFamily: "var(--mono)", padding: 0 }}>× eliminar</button>}
                </div>
              </div>
              <hr className="sk-hr dashed" />
              <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                {tasks.filter(t => t.who === p.id).map(t => (
                  <span key={t.id} className="chip" style={{ cursor: "pointer" }} onClick={() => toggle(t.id)}>
                    <Check on={t.done} /> <span style={{ textDecoration: t.done ? "line-through" : "none", opacity: t.done ? .6 : 1 }}>{t.label}</span>
                  </span>
                ))}
                {tasks.filter(t => t.who === p.id).length === 0 && (
                  <span className="chip dash muted">sin tareas asignadas</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="stack gap-3">
        <div className="sk-box p-4">
          <div className="sk-title text-xl">Resumen hoy</div>
          <hr className="sk-hr wavy" />
          <div className="stack" style={{ gap: 8 }}>
            <div className="list-row"><span>En turno</span><span className="sk-mono">{team.filter(p => shiftState[p.id]).length}/{team.length}</span></div>
            <div className="list-row"><span>En almuerzo</span><span className="sk-mono">{lunchState && shiftState.s ? 1 : 0}</span></div>
            <div className="list-row"><span>Tareas cerradas</span><span className="sk-mono">{done}/{tasks.length}</span></div>
            <div className="list-row"><span>Caja · hoy</span><span className="sk-mono">€ 842</span></div>
          </div>
        </div>
        <div className="sk-box p-4">
          <div className="sk-title text-xl">Avisos</div>
          <hr className="sk-hr wavy" />
          <div className="stack" style={{ gap: 8 }}>
            {team.filter(p => shiftState[p.id]).map(p => {
              const t = typeof shiftState[p.id] === "string" ? new Date(shiftState[p.id] as string).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
              const isOnLunch = lunchState && p.id === "s";
              return (
                <div key={p.id} className="text-sm">
                  <span className={isOnLunch ? "chip lunch" : "chip accent"}>·</span> {p.name} entró {t}{isOnLunch ? " · almuerzo" : ""}
                </div>
              );
            })}
            {team.filter(p => shiftState[p.id]).length === 0 && <div className="text-sm muted">Nadie ha fichado entrada hoy</div>}
            <div className="text-sm"><span className="chip dash">·</span> 1:1 Sergio — jueves 10:00</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashKanban() {
  const [cols, setCols] = useState({
    todo: [
      { id: 1, who: "s", tag: "TALLER", title: "Cambio cadena MTB #112", meta: "25m" },
      { id: 2, who: "s", tag: "TALLER", title: "Montaje bici nueva #115", meta: "1h" },
      { id: 3, who: "c", tag: "CAJA", title: "Llamar Shimano", meta: "10m" },
      { id: 4, who: "c", tag: "TIENDA", title: "Enviar factura #204", meta: "15m" },
    ],
    doing: [{ id: 5, who: "c", tag: "CAJA", title: "Cierre mañana", meta: "en curso" }],
    done: [
      { id: 6, who: "s", tag: "TALLER", title: "Revisión frenos #108", meta: "✓ 10:05" },
      { id: 7, who: "c", tag: "TIENDA", title: "Facturas abril", meta: "✓ ayer" },
    ],
  });
  const move = (card, from, to) => setCols(c => ({ ...c, [from]: c[from].filter(x => x.id !== card.id), [to]: [...c[to], card] }));
  const Col = ({ id, title, bg, cards }) => (
    <div className="sk-box p-3 stack gap-2" style={{ background: bg || "transparent", minHeight: "100%" }}>
      <div className="row between" style={{ marginBottom: 4 }}>
        <div className="sk-title text-xl">{title}</div>
        <span className="sk-mono text-xs muted">{cards.length}</span>
      </div>
      {cards.map(c => (
        <div key={c.id} className="kcard">
          <div className="row between" style={{ marginBottom: 6 }}>
            {c.tag && <span className="chip text-xs">{c.tag}</span>}
            <Icon d={I.dots} size={14} />
          </div>
          <div className="text-sm" style={{ marginBottom: 8, textDecoration: id === "done" ? "line-through" : "none", opacity: id === "done" ? .55 : 1 }}>{c.title}</div>
          <hr className="sk-hr dashed" />
          <div className="row between">
            <Av p={INITIAL_TEAM.find(t => t.id === c.who)} size="xs" />
            <span className="sk-mono text-xs muted">{c.meta}</span>
          </div>
          <div className="row gap-2" style={{ marginTop: 8, flexWrap: "wrap" }}>
            {id === "todo" && <button className="action" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => move(c, "todo", "doing")}>→ haciendo</button>}
            {id === "doing" && <button className="action" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => move(c, "doing", "done")}>→ hecho</button>}
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, padding: 14, flex: 1 }}>
      <Col id="todo" title="Por hacer" cards={cols.todo} />
      <Col id="doing" title="Haciendo" cards={cols.doing} bg="var(--accent-soft)" />
      <Col id="done" title="Hecho" cards={cols.done} />
    </div>
  );
}

function DashTimeline() {
  const hours = ["09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19"];
  const Block = ({ x, w, kind, label }) => (
    <div className="tblock" style={{
      left: `${x}%`, width: `${w}%`,
      background: kind === "lunch" ? "var(--lunch)" : kind === "task" ? "var(--accent)" : "var(--paper-2)",
      color: (kind === "lunch" || kind === "task") ? "#fff" : "var(--ink)"
    }}>
      {label}
    </div>
  );
  const grid = "repeating-linear-gradient(90deg,transparent 0 calc(10% - 1px),rgba(0,0,0,.07) calc(10% - 1px) 10%)";
  return (
    <div className="fade-in" style={{ padding: "12px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
      <div className="row" style={{ borderBottom: "1.2px dashed var(--line)", paddingLeft: 120, marginBottom: 14 }}>
        {hours.map(h => <div key={h} className="sk-mono text-xs muted" style={{ flex: 1, textAlign: "center" }}>{h}</div>)}
      </div>
      {[
        {
          p: INITIAL_TEAM[0], role: "taller", state: "lunch", blocks: [
            { x: 0, w: 20, kind: "task", label: "Frenos #108" }, { x: 20, w: 25, kind: "task", label: "Cadena #112" },
            { x: 48, w: 8, kind: "lunch", label: "🥪" }, { x: 58, w: 30, kind: "task", label: "Montaje #115" }, { x: 90, w: 10, kind: "", label: "Limpieza" },
          ]
        },
        ...(INITIAL_TEAM[1] ? [{
          p: INITIAL_TEAM[1], role: "caja", state: null, blocks: [
            { x: 0, w: 15, kind: "", label: "Apertura" }, { x: 16, w: 22, kind: "task", label: "Facturas" },
            { x: 40, w: 10, kind: "lunch", label: "🥪" }, { x: 52, w: 18, kind: "task", label: "Llamadas" }, { x: 72, w: 28, kind: "task", label: "Cierre" },
          ]
        }] : []),
      ].map(({ p, role, state, blocks }, ri) => (
        <div key={ri} className="row" style={{ marginBottom: ri === 0 ? 18 : 0 }}>
          <div style={{ width: 120, display: "flex", alignItems: "center", gap: 8 }}>
            <Av p={p} size="sm" state={state} />
            <div className="stack" style={{ gap: 0 }}>
              <div className="text-sm" style={{ fontWeight: 700 }}>{p.name}</div>
              <div className="sk-mono text-xs muted">{role}</div>
            </div>
          </div>
          <div style={{ flex: 1, position: "relative", height: 44, background: grid }}>
            {blocks.map((b, i) => <Block key={i} {...b} />)}
            {ri === 0 && <>
              <div style={{ position: "absolute", left: "52%", top: -4, bottom: -4, borderLeft: "2px solid var(--accent)" }} />
              <div className="sk-mono text-xs" style={{ position: "absolute", left: "52%", top: -16, color: "var(--accent)", transform: "translateX(-50%)" }}>AHORA</div>
            </>}
          </div>
        </div>
      ))}
      <div style={{ marginTop: "auto", borderTop: "1.4px solid var(--line)", paddingTop: 10 }} className="row between">
        <div className="row gap-3">
          <span className="chip accent">· tarea</span>
          <span className="chip lunch">· almuerzo</span>
          <span className="chip">· apertura/cierre</span>
        </div>
      </div>
    </div>
  );
}

function DashMapa({ lunchState, shiftState, team = INITIAL_TEAM }) {
  return (
    <div className="fade-in" style={{ flex: 1, position: "relative", padding: 18 }}>
      {lunchState && shiftState.s && (
        <div className="sk-box accent" style={{ position: "absolute", left: "50%", top: 16, transform: "translateX(-50%)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, zIndex: 2 }}>
          <Icon d={I.lunch} size={18} />
          <div>
            <div className="sk-title text-lg" style={{ color: "#fff" }}>Sergio está en almuerzo</div>
            <div className="sk-mono text-xs" style={{ opacity: .9 }}>te avisaré cuando vuelva</div>
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: lunchState && shiftState.s ? 80 : 16 }}>
        <div className="sk-box fill p-4" style={lunchState && shiftState.s ? { borderColor: "var(--lunch)", borderWidth: 2 } : shiftState.s ? { borderColor: "var(--accent)", borderWidth: 2 } : {}}>
          <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 16 }}>ZONA · TALLER</div>
          <div className="stack gap-2" style={{ alignItems: "center" }}>
            <Av p={team[0] || INITIAL_TEAM[0]} size="xl" state={lunchState && shiftState.s ? "lunch" : shiftState.s ? "busy" : null} />
            <div className="sk-title text-xl">{(team[0] || INITIAL_TEAM[0]).name}</div>
            <StatusPill state={!shiftState.s ? "off" : lunchState ? "lunch" : "ok"} />
            {shiftState.s && lunchState && <div className="sk-mono text-xs muted">empezó 13:58 · ~22 min</div>}
            {shiftState.s && !lunchState && <div className="sk-mono text-xs muted">montaje #115 en curso</div>}
            {!shiftState.s && <div className="sk-mono text-xs muted">sin fichar hoy</div>}
          </div>
        </div>
        <div className="sk-box fill p-4" style={shiftState.c ? { borderColor: "var(--accent)", borderWidth: 2 } : {}}>
          <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 16 }}>ZONA · TIENDA/CAJA</div>
          <div className="stack gap-2" style={{ alignItems: "center" }}>
            <Av p={(team[1] || INITIAL_TEAM[1])} size="xl" state={shiftState.c ? "busy" : null} />
            <div className="sk-title text-xl">{(team[1] || INITIAL_TEAM[1]).name}</div>
            <StatusPill state={shiftState.c ? "ok" : "off"} />
            {shiftState.c && <div className="sk-mono text-xs muted">facturas abril · 15 min restantes</div>}
            <div className="chip"><Icon d={I.coin} size={12} /> Caja · €842</div>
          </div>
        </div>
      </div>
      <div className="row gap-3" style={{ marginTop: 16 }}>
        <div className="sk-box p-3" style={{ flex: 1 }}>
          <div className="sk-mono text-xs tracked muted">DÍA</div>
          <div className="row between text-sm" style={{ marginTop: 4 }}><span>Tareas</span><span className="sk-mono">6/11</span></div>
          <div className="row between text-sm"><span>Caja</span><span className="sk-mono">€ 842</span></div>
        </div>
        <div className="sk-box p-3" style={{ flex: 2 }}>
          <div className="sk-mono text-xs tracked muted">SEMANA</div>
          <MiniBars n={5} w={200} h={26} />
          <div className="sk-mono text-xs muted">lun · mar · mié · jue · vie</div>
        </div>
        <div className="sk-box p-3" style={{ flex: 1 }}>
          <div className="sk-mono text-xs tracked muted">AGENDA</div>
          <div className="text-sm" style={{ marginTop: 4 }}>1:1 Sergio · jue 10:00</div>
          <div className="text-sm">Cindy libre · 03/05</div>
        </div>
      </div>
    </div>
  );
}

// ─── SECCIÓN 2: Almuerzo ─────────────────────────────────────────────────────
function LunchSection({ lunchState, setLunchState, shiftState, team = INITIAL_TEAM }) {
  const [timer, setTimer] = useState(28 * 60);
  const running = lunchState && shiftState.s;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTimer(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => { if (!lunchState) setTimer(28 * 60); }, [lunchState]);
  const mm = Math.floor(timer / 60).toString().padStart(2, "0");
  const ss = (timer % 60).toString().padStart(2, "0");
  const pct = ((28 * 60 - timer) / (28 * 60)) * 100;

  return (
    <div className="fade-in" style={{ padding: 18 }}>
      <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 16 }}>FLUJO ALMUERZO / NO MOLESTAR</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, alignItems: "start" }}>

        {/* 1 · Normal */}
        <div>
          <div className="sk-mono text-xs muted" style={{ textAlign: "center", marginBottom: 8 }}>1 · Estado normal</div>
          <div className="phone">
            <div className="notch" />
            <div className="phone-inner">
              <div className="row between"><span className="sk-mono text-xs muted">14:01</span><span className="sk-mono text-xs muted">●●●</span></div>
              <div style={{ marginTop: 8, marginBottom: 4 }}><Logo height={22} /></div>
              <div className="sk-title text-xl">Equipo</div>
              <hr className="sk-hr wavy" />
              {team.map(p => (
                <div key={p.id} className="sk-box p-3" style={{ marginBottom: 8 }}>
                  <div className="row between">
                    <div className="row gap-2"><Av p={p} size="sm" /><div className="text-sm" style={{ fontWeight: 700 }}>{p.name}</div></div>
                    <StatusPill state="ok" />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: "auto" }}>
                <button className="action lunch-btn w-full" style={{ width: "100%" }}
                  onClick={() => setLunchState(true)} disabled={lunchState || !shiftState.s}>
                  <Icon d={I.lunch} size={14} /> Iniciar almuerzo Sergio
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 2 · Push */}
        <div>
          <div className="sk-mono text-xs muted" style={{ textAlign: "center", marginBottom: 8 }}>2 · Push al llegar</div>
          <div className="phone">
            <div className="notch" />
            <div className="phone-inner" style={{ filter: "blur(1.4px) grayscale(20%)", opacity: .75 }}>
              <div style={{ marginTop: 8 }}><Logo height={22} /></div>
              <div className="sk-title text-2xl">Equipo</div>
            </div>
            {lunchState && shiftState.s ? (
              <div className="sk-box fade-in" style={{ position: "absolute", left: 14, right: 14, top: 48, padding: 14, background: "var(--paper)", boxShadow: "0 10px 30px rgba(0,0,0,.15)" }}>
                <div className="row between">
                  <span className="chip lunch"><Icon d={I.lunch} size={12} /> ALMUERZO</span>
                  <span className="sk-mono text-xs muted">ahora</span>
                </div>
                <div className="sk-title text-xl" style={{ marginTop: 8 }}>Sergio empezó a almorzar</div>
                <div className="text-sm sub" style={{ marginTop: 4 }}>te aviso cuando vuelva (~28min)</div>
                <hr className="sk-hr dashed" />
                <div className="row gap-2">
                  <button className="action ink" style={{ flex: 1 }}>ok, gracias</button>
                  <button className="action" style={{ flex: 1 }}>urgente →</button>
                </div>
              </div>
            ) : (
              <div className="sk-box dashed" style={{ position: "absolute", left: 14, right: 14, top: 60, padding: 12, textAlign: "center" }}>
                <div className="sk-mono text-xs muted">aparece cuando Sergio inicie almuerzo</div>
              </div>
            )}
          </div>
        </div>

        {/* 3 · Timer */}
        <div>
          <div className="sk-mono text-xs muted" style={{ textAlign: "center", marginBottom: 8 }}>3 · Timer activo</div>
          <div className="phone">
            <div className="notch" />
            <div className="phone-inner">
              <div style={{ marginTop: 8 }}><Logo height={22} /></div>
              <hr className="sk-hr wavy" />
              <div className="sk-box p-3" style={lunchState && shiftState.s ? { borderColor: "var(--lunch)", borderWidth: 2, background: "var(--lunch-soft)" } : {}}>
                <div className="row gap-3">
                  <Av p={team[0] || INITIAL_TEAM[0]} size="lg" state={lunchState && shiftState.s ? "lunch" : null} />
                  <div className="stack" style={{ flex: 1 }}>
                    <div className="text-sm" style={{ fontWeight: 700 }}>Sergio</div>
                    <StatusPill state={lunchState && shiftState.s ? "lunch" : "ok"} />
                  </div>
                </div>
                {lunchState && shiftState.s && (
                  <>
                    <div className="row between" style={{ marginTop: 10 }}>
                      <div className="sk-mono text-xs muted">tiempo restante</div>
                      <div className="sk-title text-2xl" style={{ color: "var(--accent-2)" }}>{mm}:{ss}</div>
                    </div>
                    <div className="lunch-bar"><div className="lunch-bar-fill" style={{ width: `${pct}%` }} /></div>
                    <hr className="sk-hr dashed" />
                    <button className="action" style={{ width: "100%", marginTop: 4 }} onClick={() => setLunchState(false)}>
                      ✓ Terminar almuerzo
                    </button>
                  </>
                )}
              </div>
              <div className="sk-box p-3" style={{ marginTop: 10 }}>
                <div className="row gap-2"><Av p={team[1] || INITIAL_TEAM[1]} size="sm" /><div className="text-sm" style={{ fontWeight: 700 }}>{(team[1] || INITIAL_TEAM[1]).name} — disponible</div></div>
              </div>
              <div style={{ marginTop: "auto" }} className="sk-box p-3 fill">
                <div className="sk-mono text-xs tracked muted">HISTORIAL · DIEGO</div>
                <div className="row between text-sm"><span>esta semana</span><span className="sk-mono">3 · prom 32m</span></div>
                <MiniBars n={5} w={240} h={24} />
              </div>
            </div>
          </div>
        </div>

        {/* 4 · Empleado */}
        <div>
          <div className="sk-mono text-xs muted" style={{ textAlign: "center", marginBottom: 8 }}>4 · Pantalla Sergio</div>
          <div className="phone">
            <div className="notch" />
            <div className="phone-inner" style={{ alignItems: "center" }}>
              <div className="row between w-full"><span className="sk-mono text-xs muted">09:02</span></div>
              <div style={{ marginTop: 8 }}><Logo height={22} /></div>
              <div className="sk-title text-2xl" style={{ marginTop: 8 }}>Hola Sergio 👋</div>
              <div className="sk-box accent" style={{ width: "100%", padding: 18, marginTop: 14, textAlign: "center" }}>
                <div className="sk-mono text-xs tracked" style={{ opacity: .9, color: "#fff" }}>FICHAJE</div>
                <div className="sk-title text-3xl" style={{ color: "#fff", lineHeight: 1, margin: "6px 0" }}>Entrar</div>
              </div>
              <div className="sk-box" style={{ width: "100%", padding: 14, marginTop: 10 }}>
                <div className="row between">
                  <div className="row gap-2"><Icon d={I.lunch} size={18} /><span className="text-sm">Empezar almuerzo</span></div>
                  <Icon d={I.chev} size={16} />
                </div>
                <hr className="sk-hr dashed" />
                <div className="sk-mono text-xs muted">avisa a Julieth · 30 min</div>
              </div>
              <div style={{ marginTop: "auto" }} className="w-full">
                <div className="sk-mono text-xs tracked muted">TAREAS HOY</div>
                <div className="text-sm">◻ Montaje bici #115</div>
                <div className="text-sm">◻ Pedido Shimano</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SECCIÓN 2b: Turnos ───────────────────────────────────────────────────────
function ShiftSection({ shiftState, setShiftState, lunchState, team = INITIAL_TEAM }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const getElapsed = (val: boolean | string): number => {
    if (!val || typeof val !== "string") return 0;
    return Math.floor((Date.now() - new Date(val).getTime()) / 1000);
  };
  const fmtTime = (s: number) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return `${h}h ${m.toString().padStart(2, "0")}m`; };
  const fmtHour = (iso: string) => new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });
  const nowStr = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div className="fade-in" style={{ padding: 18 }}>
      <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 16 }}>FICHAJES · ENTRADA Y SALIDA DE TURNO</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 14 }}>
        <div className="stack gap-3">

          {/* Ahora mismo */}
          <div className="sk-box p-4">
            <div className="row between">
              <div className="sk-title text-xl">Ahora mismo</div>
              <span className="sk-mono text-xs muted">{nowStr}</span>
            </div>
            <hr className="sk-hr wavy" />
            <div className="row gap-3" style={{ flexWrap: "wrap" }}>
              {team.map(p => (
                <div key={p.id} className="sk-box tight p-3" style={{
                  flex: 1, minWidth: 160,
                  background: shiftState[p.id] ? (lunchState && p.id === "s" ? "var(--lunch-soft)" : "var(--accent-soft)") : "var(--paper-2)",
                  borderColor: shiftState[p.id] ? (lunchState && p.id === "s" ? "var(--lunch)" : "var(--accent)") : "var(--line)"
                }}>
                  <div className="row gap-2">
                    <Av p={p} size="sm" state={shiftState[p.id] ? (lunchState && p.id === "s" ? "lunch" : "busy") : null} />
                    <div className="stack" style={{ gap: 0 }}>
                      <span className="text-sm" style={{ fontWeight: 700 }}>{p.name}</span>
                      <span className="sk-mono text-xs muted">
                        {shiftState[p.id] ? (lunchState && p.id === "s" ? "almuerzo" : `${fmtTime(getElapsed(shiftState[p.id]))} trabajadas`) : "fuera de turno"}
                      </span>
                    </div>
                  </div>
                  <hr className="sk-hr dashed" />
                  <div className="sk-mono text-xs muted">
                    {typeof shiftState[p.id] === "string" ? `ENTRÓ ${fmtHour(shiftState[p.id] as string)}` : "— sin fichar —"}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {!shiftState[p.id] ? (
                      <button className="action accent" style={{ width: "100%", fontSize: 12 }} onClick={() => setShiftState(s => ({ ...s, [p.id]: new Date().toISOString() }))}>
                        <Icon d={I.in} size={14} /> ENTRAR
                      </button>
                    ) : (
                      <button className="action ink" style={{ width: "100%", fontSize: 12 }} onClick={() => setShiftState(s => ({ ...s, [p.id]: false }))}>
                        <Icon d={I.out} size={14} /> SALIR
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Eventos del día */}
          <div className="sk-box p-4">
            <div className="row between">
              <div className="sk-title text-xl">Fichajes de hoy</div>
              <span className="sk-mono text-xs muted">{new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
            <hr className="sk-hr dashed" />
            {team.filter(p => shiftState[p.id]).length === 0 && (
              <div className="sk-mono text-xs muted" style={{ padding: "12px 0" }}>— Nadie ha fichado entrada hoy —</div>
            )}
            {team.filter(p => shiftState[p.id]).map(p => {
              const entryTime = typeof shiftState[p.id] === "string" ? fmtHour(shiftState[p.id] as string) : "—";
              const elapsed = fmtTime(getElapsed(shiftState[p.id]));
              const isOnLunch = lunchState && p.id === "s";
              return (
                <div key={p.id} className="row gap-3" style={{ padding: "10px 0", borderBottom: "1.2px dashed var(--line)" }}>
                  <Av p={p} size="xs" state={isOnLunch ? "lunch" : "busy"} />
                  <div style={{ flex: 1 }}>
                    <div className="text-sm" style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="sk-mono text-xs muted">Entró {entryTime} · {elapsed} trabajadas</div>
                  </div>
                  <span className="chip" style={{ background: isOnLunch ? "var(--lunch-soft)" : "var(--accent-soft)", color: isOnLunch ? "var(--lunch)" : "var(--accent)", borderColor: isOnLunch ? "var(--lunch)" : "var(--accent)", fontSize: 11 }}>
                    {isOnLunch ? "🥪 ALMUERZO" : "⬈ EN TURNO"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Resumen semanal */}
          <div className="sk-box p-4">
            <div className="sk-title text-xl">Esta semana</div>
            <hr className="sk-hr wavy" />
            <div className="row gap-3">
              {INITIAL_TEAM.map((p, i) => (
                <div key={p.id} className="stack" style={{ flex: 1 }}>
                  <div className="sk-mono text-xs muted">{p.name}</div>
                  <div className="list-row"><span>Horas</span><span className="sk-mono">{i === 0 ? "26h 40m" : "28h 15m"}</span></div>
                  <div className="list-row"><span>Almuerzos</span><span className="sk-mono">{i === 0 ? "3 · 32m" : "3 · 28m"}</span></div>
                  <div className="list-row"><span>Puntualidad</span><span className="sk-mono tick">100%</span></div>
                  <MiniBars n={5} w={160} h={26} seed={i * 3 + 1} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar notificaciones */}
        <div className="stack gap-3">
          <div className="sk-box p-3" style={{ borderColor: "var(--accent)", borderWidth: 2 }}>
            <div className="sk-mono text-xs tracked muted">NOTIFICACIONES</div>
            <hr className="sk-hr dashed" />
            {["Entradas / salidas", "Inicio almuerzo", "Vuelta almuerzo", "Retraso >15 min", "Olvido fichaje"].map((label, i) => (
              <div key={i} className="row gap-2" style={{ marginTop: 8 }}>
                <Check on={i < 3} /><span className="text-xs" style={{ whiteSpace: "nowrap" }}>{label}</span>
              </div>
            ))}
          </div>
          <div className="sk-box p-3 fill">
            <div className="sk-mono text-xs tracked muted">RESUMEN HOY</div>
            <div className="list-row" style={{ marginTop: 4 }}><span>Total presencia</span><span className="sk-mono">9h 53m</span></div>
            <div className="list-row"><span>En almuerzo</span><span className="sk-mono">35m</span></div>
            <div className="list-row"><span>Productiva</span><span className="sk-mono tick">9h 18m</span></div>
          </div>
          <div className="sk-box dashed p-3 text-xs muted">
            Todo se registra automáticamente cuando Sergio o Cindy pulsan los botones · sin papeles.
          </div>
        </div>
      </div>

      {/* 3 teléfonos empleado */}
      <div style={{ marginTop: 24 }}>
        <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 16 }}>PANTALLAS DEL EMPLEADO (móvil)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, alignItems: "start" }}>
          {[
            {
              label: "Entrar al turno", content: (
                <div className="phone-inner" style={{ alignItems: "center" }}>
                  <div className="row between w-full"><span className="sk-mono text-xs muted">08:58</span></div>
                  <div style={{ marginTop: 8 }}><Logo height={22} /></div>
                  <div className="sk-title text-2xl" style={{ marginTop: 8 }}>Buenos días, Sergio</div>
                  <div className="sk-mono text-xs muted">mar · 21 abr · taller</div>
                  <div className="sk-box accent" style={{ width: "100%", padding: 20, marginTop: 14, textAlign: "center" }}>
                    <div className="sk-mono text-xs tracked" style={{ opacity: .9, color: "#fff" }}>INICIAR TURNO</div>
                    <div className="sk-title text-3xl" style={{ color: "#fff", lineHeight: 1, margin: "8px 0" }}>⬈ ENTRAR</div>
                    <div className="sk-mono text-xs" style={{ opacity: .9, color: "#fff" }}>pulsa para fichar tu entrada</div>
                  </div>
                  <div className="sk-box dashed" style={{ width: "100%", padding: 12, marginTop: 10, textAlign: "center" }}>
                    <div className="sk-mono text-xs muted">tu turno</div>
                    <div className="text-md" style={{ fontWeight: 700 }}>09:00 — 18:30</div>
                  </div>
                  <div style={{ marginTop: "auto" }} className="w-full sk-box p-3 fill">
                    <div className="sk-mono text-xs tracked muted">ÚLTIMOS DÍAS</div>
                    <div className="row between text-sm"><span>lun 20</span><span className="sk-mono">9h 33m🥪</span></div>
                    <div className="row between text-sm"><span>vie 17</span><span className="sk-mono">9h 32m🥪</span></div>
                  </div>
                </div>
              )
            },
            {
              label: "Turno activo", content: (
                <div className="phone-inner" style={{ alignItems: "center" }}>
                  <div className="row between w-full"><span className="sk-mono text-xs muted">14:08</span></div>
                  <div style={{ marginTop: 8 }}><Logo height={22} /></div>
                  <div className="sk-title text-xl" style={{ marginTop: 6 }}>Turno en curso</div>
                  <div className="sk-box" style={{ width: "100%", padding: 14, marginTop: 8, borderColor: "var(--accent)", borderWidth: 2, background: "var(--accent-soft)" }}>
                    <div className="row between">
                      <span className="chip accent">EN TURNO</span>
                      <span className="sk-mono text-xs muted">desde 09:15</span>
                    </div>
                    <div className="sk-title text-3xl" style={{ margin: "6px 0", color: "var(--accent)" }}>4h 53m</div>
                    <div className="sk-mono text-xs muted">trabajadas · meta 9h</div>
                    <div className="prog-bar" style={{ marginTop: 6 }}><div className="prog-bar-fill" style={{ width: "54%" }} /></div>
                  </div>
                  <div className="sk-box" style={{ width: "100%", padding: 14, marginTop: 10 }}>
                    <div className="row between">
                      <div className="row gap-2"><Icon d={I.lunch} size={18} /><span className="text-sm">Empezar almuerzo</span></div>
                      <Icon d={I.chev} size={16} />
                    </div>
                  </div>
                  <div className="sk-box ink" style={{ width: "100%", padding: 14, marginTop: 10, textAlign: "center" }}>
                    <span className="sk-title text-xl">⬊ SALIR · cerrar turno</span>
                  </div>
                  <div style={{ marginTop: "auto" }} className="w-full">
                    <div className="sk-mono text-xs tracked muted">HOY</div>
                    <div className="text-sm tick">✓ Frenos #108</div>
                    <div className="text-sm tick">✓ Cadena #112</div>
                    <div className="text-sm muted">◻ Montaje #115</div>
                  </div>
                </div>
              )
            },
            {
              label: "Cerrar turno", content: (
                <div className="phone-inner" style={{ alignItems: "center" }}>
                  <div className="row between w-full"><span className="sk-mono text-xs muted">18:32</span></div>
                  <div style={{ marginTop: 8 }}><Logo height={22} /></div>
                  <div className="sk-title text-2xl" style={{ marginTop: 8 }}>Cerrando turno</div>
                  <div className="sk-box" style={{ width: "100%", padding: 16, marginTop: 12, background: "var(--paper-2)" }}>
                    <div className="sk-mono text-xs tracked muted">RESUMEN DEL DÍA</div>
                    <div className="row between" style={{ marginTop: 6 }}>
                      <span className="sk-title text-3xl" style={{ lineHeight: 1 }}>9h 17m</span>
                      <span className="chip done-chip">A TIEMPO</span>
                    </div>
                    <hr className="sk-hr dashed" />
                    <div className="list-row"><span>Entrada</span><span className="sk-mono">09:15</span></div>
                    <div className="list-row"><span>Almuerzo</span><span className="sk-mono">13:58→14:30</span></div>
                    <div className="list-row"><span>Salida</span><span className="sk-mono">18:32</span></div>
                    <hr className="sk-hr dashed" />
                    <div className="list-row"><span>Tareas hechas</span><span className="sk-mono tick">3/3 ✓</span></div>
                  </div>
                  <div className="sk-box ink" style={{ width: "100%", padding: 18, marginTop: 12, textAlign: "center" }}>
                    <div className="sk-mono text-xs tracked" style={{ opacity: .9, color: "var(--paper)" }}>FICHAR SALIDA</div>
                    <div className="sk-title text-3xl" style={{ color: "var(--paper)", lineHeight: 1, margin: "6px 0" }}>⬊ SALIR</div>
                    <div className="sk-mono text-xs" style={{ opacity: .7, color: "var(--paper)" }}>Julieth recibirá el resumen</div>
                  </div>
                  <div style={{ marginTop: "auto" }} className="sk-mono text-xs muted text-center">¡Buen trabajo hoy! 👋</div>
                </div>
              )
            },
          ].map(({ label, content }, i) => (
            <div key={i}>
              <div className="sk-mono text-xs muted" style={{ textAlign: "center", marginBottom: 8 }}>{label}</div>
              <div className="phone"><div className="notch" />{content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SECCIÓN 3: Perfil ───────────────────────────────────────────────────────
function ProfileSection({ team = INITIAL_TEAM, extendedData = {}, onEditMember }) {
  const [tab, setTab] = useState("ficha");
  const [person, setPerson] = useState(team[0] || INITIAL_TEAM[0]);
  const [editOpen, setEditOpen] = useState(false);
  const Ev = ({ t, what, tag }) => (
    <div className="row gap-3" style={{ padding: "10px 0", borderBottom: "1.2px dashed var(--line)" }}>
      <div className="sk-mono text-xs muted" style={{ width: 70, flexShrink: 0 }}>{t}</div>
      <div style={{ width: 14, display: "flex", justifyContent: "center" }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%", border: "1.4px solid var(--line)",
          background: tag === "lunch" ? "var(--lunch)" : tag === "done" ? "var(--accent)" : "var(--paper)"
        }} />
      </div>
      <div className="text-sm" style={{ flex: 1 }}>{what}</div>
      {tag && <span className={"chip text-xs " + (tag === "lunch" ? "lunch" : tag === "done" ? "accent" : "dash")}>{tag}</span>}
    </div>
  );
  return (
    <div className="fade-in" style={{ flex: 1 }}>
      <div className="row gap-3" style={{ padding: "12px 18px", borderBottom: "1.4px dashed var(--line)" }}>
        {team.map(p => (
          <button key={p.id} className={"action" + (person.id === p.id ? " accent" : "")} onClick={() => setPerson(p)}>
            {p.name} · {p.role}
          </button>
        ))}
        <div style={{ marginLeft: "auto" }} className="row gap-2">
          {["ficha", "timeline"].map(t => (
            <button key={t} className={"action" + (tab === t ? " ink" : "")} onClick={() => setTab(t)}>{t}</button>
          ))}
          {onEditMember && (
            <button className="action" style={{ borderColor: "var(--accent)", color: "var(--accent)" }} onClick={() => setEditOpen(true)}>
              🔐 editar
            </button>
          )}
        </div>
      </div>
      {tab === "ficha" ? (
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20, padding: "16px 18px" }}>
          <div className="stack gap-3" style={{ alignItems: "center", textAlign: "center" }}>
            <Av p={person} size="xl" />
            <div>
              <div className="sk-title text-2xl">{person.name} García</div>
              <div className="sk-mono text-xs muted">{person.role.toLowerCase()} · desde mar 2024</div>
            </div>
            <StatusPill state="ok" />
            <div className="sk-box p-3 w-full text-sm stack" style={{ gap: 4 }}>
              {extendedData[person.id]?.documento
                ? <div className="list-row"><span className="muted">documento</span><span className="sk-mono">{extendedData[person.id].documento}</span></div>
                : <div className="list-row"><span className="muted">documento</span><span className="sk-mono muted">—</span></div>}
              {extendedData[person.id]?.direccion
                ? <div className="list-row"><span className="muted">dirección</span><span className="sk-mono text-xs" style={{ maxWidth: 120, textAlign: "right" }}>{extendedData[person.id].direccion}</span></div>
                : <div className="list-row"><span className="muted">dirección</span><span className="sk-mono muted">—</span></div>}
              {extendedData[person.id]?.eps
                ? <div className="list-row"><span className="muted">EPS</span><span className="sk-mono">{extendedData[person.id].eps}</span></div>
                : <div className="list-row"><span className="muted">EPS</span><span className="sk-mono muted">—</span></div>}
              <div className="list-row"><span className="muted">nómina</span><span className="sk-mono">{extendedData[person.id]?.salario ? `€ ${extendedData[person.id].salario}` : "—"}</span></div>
              <div className="list-row"><span className="muted">horas/sem</span><span className="sk-mono">{extendedData[person.id]?.horasSemana || "—"}h</span></div>
              <div className="list-row"><span className="muted">vacaciones</span><span className="sk-mono">18/22</span></div>
            </div>
          </div>
          <div className="stack gap-3">
            <div className="sk-box p-4">
              <div className="sk-title text-xl">Rendimiento · mes</div>
              <hr className="sk-hr wavy" />
              <div className="row gap-6">
                <div className="stack"><div className="sk-mono text-3xl">32</div><div className="muted text-xs">tareas cerradas</div></div>
                <div className="stack"><div className="sk-mono text-3xl">96%</div><div className="muted text-xs">a tiempo</div></div>
                <div className="stack"><div className="sk-mono text-3xl">4</div><div className="muted text-xs">almuerzos/sem</div></div>
                <div style={{ flex: 1 }}><MiniLine w={200} h={60} seed={3} /></div>
              </div>
            </div>
            <div className="sk-box p-4">
              <div className="sk-title text-xl">Tareas en curso</div>
              <hr className="sk-hr dashed" />
              <div className="list-row"><span className="row gap-2"><Check /> Montaje bici #115</span><span className="sk-mono text-xs muted">hoy</span></div>
              <div className="list-row"><span className="row gap-2"><Check /> Pedido piezas Shimano</span><span className="sk-mono text-xs muted">mie</span></div>
              <div className="list-row"><span className="row gap-2"><Check on /> Revisión frenos #108</span><span className="sk-mono text-xs muted tick">✓</span></div>
            </div>
            <div className="sk-box p-4">
              <div className="sk-title text-xl">Notas 1:1</div>
              <hr className="sk-hr dashed" />
              <div className="text-sm sub">«quiere especializarse en e-bikes — buscar curso oficial»</div>
              <div className="text-sm sub pt-2">«pedir centradora de ruedas — presupuesto Q3»</div>
              <div className="muted text-xs pt-2 sk-mono">última · 2 abr</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: "12px 18px" }}>
          <div className="row gap-3" style={{ marginBottom: 10 }}>
            <Av p={person} size="lg" />
            <div className="stack"><div className="sk-title text-xl">{person.name}</div><StatusPill state="ok" /></div>
            <div style={{ flex: 1 }} />
            <MiniLine w={140} h={40} seed={5} />
          </div>
          <Ev t="14:02" what={`${person.name} inició almuerzo`} tag="lunch" />
          <Ev t="13:20" what="Completó 'Cadena MTB #112'" tag="done" />
          <Ev t="12:10" what="Pidió material — pastillas freno" />
          <Ev t="11:40" what="Inició 'Cadena MTB #112'" />
          <Ev t="10:05" what="Completó 'Frenos #108'" tag="done" />
          <Ev t="09:15" what="Entró al taller · fichaje" />
          <div className="sk-mono text-xs muted" style={{ padding: "14px 0 4px" }}>— lun 20 abr —</div>
          <Ev t="18:40" what="Cerró turno · 9h 17m" />
        </div>
      )}
      {editOpen && onEditMember && (
        <EditMemberModal
          person={person}
          extData={extendedData[person.id] || {}}
          onClose={() => setEditOpen(false)}
          onSave={data => { onEditMember(person.id, data); setPerson(prev => ({ ...prev, name: data.name, role: data.role })); }}
        />
      )}
    </div>
  );
}

// ─── SECCIÓN 4: Tareas ───────────────────────────────────────────────────────
function TasksSection({ tasks, team, onToggle, onAssign }: { tasks: AppTask[]; team: any[]; onToggle: (id: string) => void; onAssign: () => void }) {
  const [view, setView] = useState("lista");
  const getMember = (id: string) => team.find(m => m.id === id);
  const pending = tasks.filter(t => !t.done);
  const done    = tasks.filter(t => t.done);
  return (
    <div className="fade-in" style={{ flex: 1 }}>
      <div className="row gap-2 between" style={{ padding: "12px 18px", borderBottom: "1.4px dashed var(--line)", flexWrap: "wrap" }}>
        <div className="row gap-2">
          <button className={"action" + (view === "todas" ? " ink" : "")} onClick={() => setView("todas")}>Todas</button>
          <button className={"action" + (view === "hechas" ? " ink" : "")} onClick={() => setView("hechas")}>Completadas</button>
        </div>
        <button className="action accent" style={{ fontSize: 12 }} onClick={onAssign}>+ Asignar tarea</button>
      </div>

      {tasks.length === 0 && (
        <div className="placeholder" style={{ margin: 20, borderRadius: 12, padding: 40, textAlign: "center" }}>
          No hay tareas aún. Crea una con "Asignar tarea".
        </div>
      )}

      <div style={{ padding: "8px 0" }}>
        {(view === "todas" ? pending : done).map(t => {
          const member = getMember(t.assignedTo);
          return (
            <div key={t.id} className="task-item">
              <div className="row gap-3">
                <div onClick={() => onToggle(t.id)} style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${t.done ? "var(--accent)" : "var(--line)"}`, background: t.done ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: "#fff", fontSize: 12 }}>{t.done && "✓"}</div>
                <span className="text-sm" style={{ textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.5 : 1 }}>{t.title}</span>
              </div>
              <div className="row gap-2">
                <span className="chip text-xs">{t.tag}</span>
                {member && <Av p={member} size="xs" />}
                {member && <span className="sk-mono text-xs muted">{member.name}</span>}
              </div>
            </div>
          );
        })}
        {view === "todas" && pending.length === 0 && tasks.length > 0 && (
          <div style={{ textAlign: "center", padding: 32, color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 12 }}>✅ Todas las tareas completadas</div>
        )}
      </div>
    </div>
  );
}

// ─── SECCIÓN 5: Calendario ───────────────────────────────────────────────────
function CalendarSection({ tasks, appointments, services, setTasks, setAppointments, onNewBikeService, onUpdateService, team }: {
  tasks: AppTask[]; appointments: Appointment[]; services: BikeService[];
  setTasks: (fn: (prev: AppTask[]) => AppTask[]) => void;
  setAppointments: (fn: (prev: Appointment[]) => Appointment[]) => void;
  onNewBikeService: (date: string) => void;
  onUpdateService?: (id: string, changes: Partial<BikeService>) => void;
  team: any[];
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showApptModal, setShowApptModal] = useState(false);
  const [preDate, setPreDate] = useState<string | undefined>(undefined);
  const [editingSvc, setEditingSvc] = useState<BikeService | null>(null);

  const DAY_NAMES = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
  const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

  const getWeekDays = (offset: number): Date[] => {
    const now = new Date();
    const dow = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1) + offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return d;
    });
  };

  const days = getWeekDays(weekOffset);
  const todayStr = _fmtDate(new Date());
  const first = days[0], last = days[6];
  const rangeLabel = `${first.getDate()} ${MONTH_NAMES[first.getMonth()]} — ${last.getDate()} ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`;

  const openAdd = (dateStr: string, type: "task" | "appt") => {
    setPreDate(dateStr);
    type === "task" ? setShowTaskModal(true) : setShowApptModal(true);
  };

  return (
    <div className="fade-in" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Barra de controles */}
      <div className="row between" style={{ padding: "10px 16px", borderBottom: "1.4px solid var(--line)", flexShrink: 0, gap: 12, flexWrap: "wrap" }}>
        <div className="row gap-2">
          <button className="action" onClick={() => setWeekOffset(w => w - 1)}>◀</button>
          <button className="action" onClick={() => setWeekOffset(0)}>Hoy</button>
          <button className="action" onClick={() => setWeekOffset(w => w + 1)}>▶</button>
          <span className="sk-mono text-xs muted" style={{ marginLeft: 6 }}>{rangeLabel}</span>
        </div>
        <div className="row gap-2">
          <button className="action" style={{ background: "#dbeafe", borderColor: "#3b82f6", color: "#1d4ed8" }}
            onClick={() => openAdd(todayStr, "task")}>
            <Icon d={I.plus} size={13} /> Tarea
          </button>
          <button className="action" style={{ background: "rgba(108,31,110,.1)", borderColor: "#6c1f6e", color: "#6c1f6e" }}
            onClick={() => onNewBikeService(todayStr)}>
            <Icon d={I.plus} size={13} /> Servicio de bici
          </button>
        </div>
      </div>

      {/* Grid semana */}
      <div style={{ display: "flex", flex: 1, overflow: "auto", borderBottom: "1.4px solid var(--line)" }}>
        {days.map((day, i) => {
          const dateStr = _fmtDate(day);
          const isToday = dateStr === todayStr;
          const dayAppts = appointments.filter(a => a.date === dateStr);
          const dayTasks = tasks.filter(t => t.date === dateStr);
          const dayBikes = services.filter(s => s.date === dateStr);
          return (
            <div key={i} className="cal-day" style={{ background: isToday ? "rgba(108,31,110,.04)" : undefined, minHeight: 120 }}>
              <div className="sk-mono text-xs tracked muted">{DAY_NAMES[i]}</div>
              <div className="sk-title text-2xl" style={{ lineHeight: 1, marginBottom: 8, color: isToday ? "var(--accent)" : "var(--ink)" }}>
                {day.getDate()}
              </div>

              {/* Servicios bici — morado */}
              {dayBikes.map(s => {
                const tech = team.find(p => p.id === s.technicianId);
                const phInfo = PHASES.find(ph => ph.id === s.phase);
                const urg = urgencyInfo(s.neededByDate);
                return (
                  <div key={s.id} className="cal-event ev-bici"
                    title={`${s.clientName} · ${s.bikeDescription}`}
                    onClick={() => onUpdateService && setEditingSvc(s)}
                    style={{
                      ...(urg && urg.color === "#c0392b" ? { borderColor: "#c0392b", background: "rgba(192,57,43,.08)" } : {}),
                      cursor: onUpdateService ? "pointer" : "default",
                    }}>
                    {s.startTime && <div className="sk-mono text-xs" style={{ color: "#6c1f6e" }}>{s.startTime}{s.endTime ? `–${s.endTime}` : ""}</div>}
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{s.clientName}</div>
                    <div style={{ fontSize: 10, color: "#6c1f6e" }}>{s.bikeDescription}</div>
                    <div style={{ fontSize: 10, color: "#9c4a9e" }}>{s.phase === 0 ? "📋 Recibida" : `${phInfo?.icon} ${phInfo?.name}`}</div>
                    {tech && <div style={{ fontSize: 10, color: "#9c4a9e" }}>🔧 {tech.name}</div>}
                    {urg && <div style={{ fontSize: 10, color: urg.color, fontWeight: 600 }}>{urg.label}</div>}
                    {s.paymentStatus === "pagado" && <div style={{ fontSize: 10, color: "#2e7d32" }}>✅ Pagado</div>}
                    {s.paymentStatus === "adelanto" && <div style={{ fontSize: 10, color: "#6c1f6e" }}>📤 {s.paymentAmount ? `$${s.paymentAmount.toLocaleString()}` : "Abono"}</div>}
                    {onUpdateService && <div style={{ fontSize: 9, color: "var(--ink-3)", marginTop: 2 }}>✏️ editar</div>}
                  </div>
                );
              })}

              {/* Agendamientos — amarillo */}
              {dayAppts.map(a => {
                const person = team.find(p => p.id === a.assignedTo);
                return (
                  <div key={a.id} className="cal-event ev-service" title={`${a.client} · ${a.service}`}>
                    <div className="sk-mono text-xs" style={{ color: "#7a5500" }}>{a.startTime}–{a.endTime}</div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{a.client}</div>
                    <div style={{ fontSize: 10, color: "#7a5500" }}>{a.service}</div>
                    {person && <div style={{ fontSize: 10, color: "#a07000" }}>· {person.name}</div>}
                  </div>
                );
              })}

              {/* Tareas — azul */}
              {dayTasks.map(t => {
                const person = team.find(p => p.id === t.assignedTo);
                return (
                  <div key={t.id} className="cal-event ev-task" style={{ opacity: t.done ? .45 : 1 }} title={t.title}>
                    <div className="sk-mono text-xs" style={{ color: "#1d4ed8" }}>
                      {t.hasTime ? `${t.startTime}–${t.endTime}` : "todo el día"}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</div>
                    {person && <div style={{ fontSize: 10, color: "#3b82f6" }}>· {person.name}</div>}
                  </div>
                );
              })}

              {dayAppts.length === 0 && dayTasks.length === 0 && dayBikes.length === 0 && (
                <div style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--mono)", marginTop: 4 }}>—</div>
              )}
              <button className="cal-add-btn" title="Agregar servicio de bici" onClick={() => onNewBikeService(dateStr)}>+</button>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="row between" style={{ padding: "10px 14px", flexShrink: 0 }}>
        <div className="row gap-4" style={{ flexWrap: "wrap" }}>
          <div className="row gap-2">
            <div style={{ width: 12, height: 12, background: "rgba(108,31,110,.1)", border: "1.2px solid #6c1f6e", borderRadius: 3, flexShrink: 0 }} />
            <span className="sk-mono text-xs muted">Servicios de bicicleta</span>
          </div>
          <div className="row gap-2">
            <div style={{ width: 12, height: 12, background: "#fff9c4", border: "1.2px solid #c8a800", borderRadius: 3, flexShrink: 0 }} />
            <span className="sk-mono text-xs muted">Agendamientos internos</span>
          </div>
          <div className="row gap-2">
            <div style={{ width: 12, height: 12, background: "#dbeafe", border: "1.2px solid #3b82f6", borderRadius: 3, flexShrink: 0 }} />
            <span className="sk-mono text-xs muted">Tareas internas del equipo</span>
          </div>
        </div>
        <span className="sk-mono text-xs muted">
          {services.filter(s => s.date === todayStr).length} bicis · {appointments.filter(a => a.date === todayStr).length} appts · {tasks.filter(t => t.date === todayStr && !t.done).length} tareas hoy
        </span>
      </div>

      {showTaskModal && (
        <AssignTaskModal team={team} onClose={() => setShowTaskModal(false)}
          onAdd={task => { setTasks(ts => [{ ...task, date: preDate || task.date }, ...ts]); }} />
      )}
      {showApptModal && (
        <AppointmentModal team={team} initialDate={preDate} onClose={() => setShowApptModal(false)}
          onAdd={appt => setAppointments(as => [appt, ...as])} />
      )}

      {/* Modal edición de servicio desde el calendario */}
      {editingSvc && onUpdateService && (
        <EditServiceCalModal
          service={editingSvc}
          team={team}
          onClose={() => setEditingSvc(null)}
          onSave={(id, changes) => { onUpdateService(id, changes); setEditingSvc(null); }}
        />
      )}
    </div>
  );
}

function EditServiceCalModal({ service, team, onClose, onSave }: {
  service: BikeService;
  team: any[];
  onClose: () => void;
  onSave: (id: string, changes: Partial<BikeService>) => void;
}) {
  const [bikeDescription, setBikeDescription] = useState(service.bikeDescription);
  const [serviceType, setServiceType] = useState(service.serviceType || "");
  const [notes, setNotes] = useState(service.notes || "");
  const [neededByDate, setNeededByDate] = useState(service.neededByDate || "");
  const [technicianId, setTechnicianId] = useState(service.technicianId || "");
  const [startTime, setStartTime] = useState(service.startTime || "");
  const [endTime, setEndTime] = useState(service.endTime || "");

  const inp: React.CSSProperties = { width: "100%", padding: "8px 11px", borderRadius: 7, border: "1.3px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit", marginBottom: 10 };
  const lbl: React.CSSProperties = { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase" as const, display: "block", marginBottom: 3 };

  const handleSave = () => {
    if (!bikeDescription.trim()) return;
    onSave(service.id, {
      bikeDescription: bikeDescription.trim(),
      serviceType: serviceType || undefined,
      notes,
      neededByDate: neededByDate || undefined,
      technicianId: technicianId || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
    });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0008", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "var(--paper-2)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 420, boxShadow: "0 4px 32px #0006", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1 }}>EDITAR SERVICIO</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginTop: 2 }}>{service.clientName}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        <label style={lbl}>Descripción de la bici *</label>
        <textarea rows={2} style={{ ...inp, resize: "vertical" as const }} value={bikeDescription} onChange={e => setBikeDescription(e.target.value)} autoFocus />

        <label style={lbl}>Servicio solicitado</label>
        <select style={{ ...inp }} value={serviceType} onChange={e => setServiceType(e.target.value)}>
          <option value="">Sin especificar</option>
          {SERVICES_CATALOG.map(g => (
            <optgroup key={g.category} label={g.category}>
              {g.items.map(item => (
                <option key={item.code} value={`${item.code} - ${item.name}`}>
                  {item.name} · ${item.price.toLocaleString("es-CO")}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <label style={lbl}>Técnico asignado</label>
        <select style={{ ...inp }} value={technicianId} onChange={e => setTechnicianId(e.target.value)}>
          <option value="">Sin asignar</option>
          {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>Hora inicio</label>
            <input style={inp} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Hora fin</label>
            <input style={inp} type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>

        <label style={lbl}>¿Cuándo necesita la bici el cliente?</label>
        <input style={inp} type="date" value={neededByDate} onChange={e => setNeededByDate(e.target.value)} />

        <label style={lbl}>Notas</label>
        <textarea rows={2} style={{ ...inp, resize: "vertical" as const }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones adicionales…" />

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button type="button" className="action" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button type="button" className="action ink" onClick={handleSave} style={{ flex: 2 }} disabled={!bikeDescription.trim()}>Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}

// ─── SECCIÓN 6: 1:1 y Onboarding ─────────────────────────────────────────────
function OpsSection() {
  const [view, setView] = useState("1:1");
  const [agenda, setAgenda] = useState([
    { id: 1, done: true, text: "Revisar carga semana" },
    { id: 2, done: true, text: "Feedback sobre montajes" },
    { id: 3, done: false, text: "Formación e-bikes" },
    { id: 4, done: false, text: "Pedir centradora ruedas" },
  ]);
  const onbSteps = [
    {
      section: "ANTES DE EMPEZAR", steps: [
        { done: true, what: "Firmar contrato", owner: "Cindy", when: "✓" },
        { done: true, what: "Alta seguridad social", owner: "Cindy", when: "✓" },
        { done: true, what: "Copia DNI + cuenta", owner: "Cindy", when: "✓" },
        { done: false, what: "Preparar uniforme + EPIs", owner: "yo", when: "30/4" },
      ]
    },
    {
      section: "PRIMER DÍA", steps: [
        { done: true, what: "Tour del taller", owner: "yo", when: "✓" },
        { done: false, what: "Presentación con Sergio y Cindy", owner: "yo", when: "5/5" },
        { done: false, what: "Acceso al sistema de tareas", owner: "Cindy", when: "5/5" },
        { done: false, what: "Explicar flujo de fichaje", owner: "yo", when: "5/5" },
      ]
    },
    {
      section: "PRIMER MES", steps: [
        { done: false, what: "Sombra con Sergio · 2 semanas", owner: "Sergio", when: "may" },
        { done: false, what: "1:1 semana 1", owner: "yo", when: "12/5" },
        { done: false, what: "Feedback 30 días", owner: "yo", when: "5/6" },
        { done: false, what: "Ajustar objetivos", owner: "yo", when: "5/6" },
      ]
    },
  ];
  return (
    <div className="fade-in" style={{ flex: 1 }}>
      <div className="row gap-2" style={{ padding: "12px 18px", borderBottom: "1.4px dashed var(--line)" }}>
        <button className={"action" + (view === "1:1" ? " ink" : "")} onClick={() => setView("1:1")}>1:1 Sergio</button>
        <button className={"action" + (view === "onb" ? " ink" : "")} onClick={() => setView("onb")}>Onboarding</button>
      </div>
      {view === "1:1" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 16, padding: "14px 18px" }}>
          <div className="stack gap-3">
            <div className="sk-box p-4">
              <div className="sk-mono text-xs tracked muted">AGENDA · JUE 23 ABR 10:00</div>
              <div className="stack gap-2" style={{ marginTop: 8 }}>
                {agenda.map(item => (
                  <div key={item.id} className="row gap-2" style={{ cursor: "pointer" }} onClick={() => setAgenda(a => a.map(x => x.id === item.id ? { ...x, done: !x.done } : x))}>
                    <Check on={item.done} /><span className="text-sm" style={{ textDecoration: item.done ? "line-through" : "none", opacity: item.done ? .6 : 1 }}>{item.text}</span>
                  </div>
                ))}
                <div className="row gap-2 muted"><Icon d={I.plus} size={14} /><span className="text-sm">añadir</span></div>
              </div>
            </div>
            <div className="sk-box p-4">
              <div className="sk-mono text-xs tracked muted">NOTAS</div>
              <div className="text-md" style={{ marginTop: 8, lineHeight: 1.5, fontFamily: "var(--hand)" }}>
                <p style={{ marginBottom: 8 }}>— Se siente cómodo con las revisiones pero quiere más variedad.</p>
                <p style={{ marginBottom: 8 }}>— Le interesa la parte <span className="scribble">e-bikes / motores eléctricos</span>. Buscar curso antes de julio.</p>
                <p style={{ marginBottom: 8 }}>— Propone renegociar <span className="scribble">hora extra sábados</span> (Q3).</p>
                <p>— Centradora de ruedas: cotizar 2 opciones en mayo.</p>
              </div>
            </div>
          </div>
          <div className="stack gap-3">
            <div className="sk-box p-3">
              <div className="sk-title text-xl">Acciones</div>
              <hr className="sk-hr dashed" />
              <div className="text-sm" style={{ marginBottom: 8 }}>☐ Buscar curso e-bikes — <span className="sk-mono text-xs muted">yo, 30/4</span></div>
              <div className="text-sm" style={{ marginBottom: 8 }}>☐ Cotizar centradora — <span className="sk-mono text-xs muted">yo, 15/5</span></div>
              <div className="text-sm">☐ Revisar sábados — <span className="sk-mono text-xs muted">Sergio</span></div>
            </div>
            <div className="sk-box p-3">
              <div className="sk-title text-xl">Histórico</div>
              <hr className="sk-hr dashed" />
              <div className="sk-mono text-xs muted" style={{ marginBottom: 6 }}>2 abr · 50min</div>
              <div className="sk-mono text-xs muted" style={{ marginBottom: 6 }}>5 mar · 45min</div>
              <div className="sk-mono text-xs muted">1 feb · 60min</div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ padding: "14px 18px" }}>
          <div className="row gap-3" style={{ marginBottom: 14 }}>
            <div className="avatar lg" style={{ borderStyle: "dashed" }}>?</div>
            <div className="stack">
              <div className="sk-title text-xl">Nuevo · taller</div>
              <div className="sk-mono text-xs muted">empezaría · 5 mayo</div>
            </div>
            <div style={{ flex: 1 }} />
            <div className="stack" style={{ alignItems: "flex-end" }}>
              <div className="sk-title text-2xl">4 / 12</div>
              <div className="sk-mono text-xs muted">pasos hechos</div>
            </div>
          </div>
          {onbSteps.map(sec => (
            <div key={sec.section}>
              <div className="sk-mono text-xs tracked muted" style={{ marginTop: 14, marginBottom: 4 }}>{sec.section}</div>
              {sec.steps.map((step, i) => (
                <div key={i} className="list-row">
                  <div className="row gap-3"><Check on={step.done} /><span className="text-sm" style={{ textDecoration: step.done ? "line-through" : "none", opacity: step.done ? .55 : 1 }}>{step.what}</span></div>
                  <div className="row gap-3"><span className="sk-mono text-xs muted">{step.owner}</span><span className="sk-mono text-xs muted" style={{ width: 54, textAlign: "right" }}>{step.when}</span></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── NAVEGACIÓN ──────────────────────────────────────────────────────────────
const NAV = [
  { id: "dash",      label: "Dashboard",       icon: "home"   },
  { id: "servicios", label: "Servicios",        icon: "wrench" },
  { id: "lunch",     label: "Almuerzo",         icon: "lunch"  },
  { id: "turno",     label: "Fichajes/Turno",   icon: "in"     },
  { id: "perfil",    label: "Perfil equipo",    icon: "user"   },
  { id: "tareas",    label: "Tareas",           icon: "tasks"  },
  { id: "cal",       label: "Calendario",       icon: "cal"    },
];
const DASH_TABS = [
  { id: "lista", label: "A · Lista" },
  { id: "kanban", label: "B · Kanban" },
  { id: "timeline", label: "C · Timeline" },
  { id: "mapa", label: "D · Mapa" },
];

// ─── Vista pública de seguimiento para clientes ───────────────────────────────
function CustomerTrackingView({ data }: { data: any }) {
  const cur = data.phase as number;
  const diags: DiagnosticUpdate[] = data.diagnosticUpdates || [];
  const urgency = urgencyInfo(data.neededByDate);
  const completedAt: string | undefined = data.completedAt;
  const daysSinceCompleted = completedAt
    ? Math.floor((Date.now() - new Date(completedAt).getTime()) / 86400000)
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#1a0d1a", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px" }}>
      <style>{CSS}</style>
      <div style={{ width: "100%", maxWidth: 480, background: "#221222", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 32px #0008" }}>
        {/* Header morado con logo blanco */}
        <div style={{ background: "#6c1f6e", padding: "20px 24px", textAlign: "center" }}>
          <img src={LOGO_SRC} alt="Capital Wo-Man Bikes" style={{ height: 36, display: "block", margin: "0 auto", objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          <div style={{ color: "#e8d5e8", fontFamily: "monospace", fontSize: 11, letterSpacing: 2, marginTop: 10 }}>SEGUIMIENTO DE SERVICIO</div>
        </div>

        <div style={{ padding: 24 }}>
          {/* Cliente + bici */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: "#c8a8c8", fontFamily: "monospace", fontSize: 10, letterSpacing: 1 }}>CLIENTE</div>
            <div style={{ color: "#e8d5e8", fontSize: 18, fontWeight: 700, marginTop: 4 }}>{data.clientName}</div>
            <div style={{ color: "#a080a0", fontSize: 13, marginTop: 2 }}>{data.bikeDescription}</div>
          </div>

          {/* Fecha límite con urgencia */}
          {urgency && (
            <div style={{ background: urgency.bg, border: `1px solid ${urgency.color}`, borderRadius: 8, padding: "8px 12px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: urgency.color, fontSize: 13, fontWeight: 600 }}>{urgency.label}</span>
              <span style={{ color: "#a080a0", fontSize: 12 }}>— fecha requerida por el cliente</span>
            </div>
          )}

          {/* Fases */}
          {PHASES.map((ph, i) => {
            const done = cur > ph.id, active = cur === ph.id;
            return (
              <div key={ph.id} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: done ? "#4caf50" : active ? ph.color : "#2d1a2d", border: `2px solid ${done ? "#4caf50" : active ? ph.color : "#4a2a4a"}`, fontSize: 18, flexShrink: 0 }}>
                    {done ? "✓" : ph.icon}
                  </div>
                  {i < PHASES.length - 1 && <div style={{ width: 2, height: 28, background: done ? "#4caf50" : "#2d1a2d", margin: "3px 0" }} />}
                </div>
                <div style={{ paddingTop: 7, paddingBottom: i < PHASES.length - 1 ? 28 : 0 }}>
                  <div style={{ color: done ? "#4caf50" : active ? "#e8d5e8" : "#5a3a5a", fontWeight: active ? 700 : 400, fontSize: 15 }}>{ph.name}</div>
                  {active && <div style={{ color: "#a080a0", fontSize: 12, marginTop: 2 }}>{ph.msg}</div>}
                </div>
              </div>
            );
          })}

          {/* Lista si está lista */}
          {cur === 4 && (
            <div style={{ background: "#1a3a1a", border: "1px solid #4caf50", borderRadius: 10, padding: 16, textAlign: "center", marginTop: 16 }}>
              <div style={{ fontSize: 28 }}>🎉</div>
              <div style={{ color: "#4caf50", fontWeight: 700, fontSize: 16, marginTop: 6 }}>¡Tu bici está lista para entrega!</div>
              <div style={{ color: "#a0c0a0", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                Puedes acercarte a recogerla en nuestro taller en el horario habitual.
              </div>
              <div style={{ color: "#a0c0a0", fontSize: 12, marginTop: 10, padding: "10px 12px", background: "#0d1f0d", borderRadius: 8, lineHeight: 1.6, textAlign: "left" }}>
                ⏳ Tienes <strong style={{ color: "#4caf50" }}>5 días calendario</strong> para recogerla.<br />
                Pasado este tiempo se generará un cobro por bodegaje de <strong style={{ color: "#4caf50" }}>$4.000 COP/día</strong> según nuestras políticas.
              </div>
              {daysSinceCompleted !== null && daysSinceCompleted > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: daysSinceCompleted >= 5 ? "#e05555" : "#e8a020", fontWeight: 600 }}>
                  {daysSinceCompleted >= 5
                    ? `🔴 Han transcurrido ${daysSinceCompleted} días desde que quedó lista.`
                    : `⚠️ Han transcurrido ${daysSinceCompleted} día${daysSinceCompleted > 1 ? "s" : ""} desde que quedó lista.`}
                </div>
              )}
            </div>
          )}

          {/* Diagnósticos técnicos */}
          {diags.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ color: "#c8a8c8", fontFamily: "monospace", fontSize: 10, letterSpacing: 1, marginBottom: 12 }}>DIAGNÓSTICO TÉCNICO</div>
              {[...diags].reverse().map(d => (
                <div key={d.id} style={{ background: "#1a1222", border: "1px solid #4a2a4a", borderRadius: 10, padding: 14, marginBottom: 10 }}>
                  <div style={{ color: "#c8a8c8", fontFamily: "monospace", fontSize: 10, marginBottom: 8 }}>
                    {new Date(d.date).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                  {d.estado && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ color: "#9c4a9e", fontSize: 11, fontFamily: "monospace", letterSpacing: 0.5 }}>ESTADO GENERAL · </span>
                      <span style={{ color: "#e8d5e8", fontSize: 13 }}>{d.estado}</span>
                    </div>
                  )}
                  {d.hallazgos && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ color: "#9c4a9e", fontSize: 11, fontFamily: "monospace", letterSpacing: 0.5 }}>HALLAZGOS · </span>
                      <span style={{ color: "#c8a8c8", fontSize: 13 }}>{d.hallazgos}</span>
                    </div>
                  )}
                  {d.problemas && (
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ color: "#c0392b", fontSize: 11, fontFamily: "monospace", letterSpacing: 0.5 }}>PROBLEMAS · </span>
                      <span style={{ color: "#c8a8c8", fontSize: 13 }}>{d.problemas}</span>
                    </div>
                  )}
                  {d.recomendaciones && (
                    <div style={{ marginBottom: d.partes.length > 0 ? 10 : 0 }}>
                      <span style={{ color: "#5cc8e8", fontSize: 11, fontFamily: "monospace", letterSpacing: 0.5 }}>RECOMENDACIONES · </span>
                      <span style={{ color: "#c8a8c8", fontSize: 13 }}>{d.recomendaciones}</span>
                    </div>
                  )}
                  {d.partes.length > 0 && (
                    <div style={{ background: "#221222", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
                      <div style={{ color: "#e8a020", fontFamily: "monospace", fontSize: 10, letterSpacing: 1, marginBottom: 6 }}>🔩 REPUESTOS RECOMENDADOS</div>
                      {d.partes.map((p, i) => (
                        <div key={i} style={{ color: "#e8d5e8", fontSize: 13, padding: "3px 0", borderBottom: i < d.partes.length - 1 ? "1px solid #3a1a3a" : "none" }}>
                          · {p}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 24px", borderTop: "1px solid #3a1a3a", textAlign: "center" }}>
          <div style={{ color: "#5a3a5a", fontFamily: "monospace", fontSize: 10, letterSpacing: 1 }}>CAPITAL WO-MAN BIKES</div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal nuevo servicio ─────────────────────────────────────────────────────
function NewServiceModal({ onClose, onAdd, team = [], initialDate }: { onClose: () => void; onAdd: (s: BikeService) => void; team?: any[]; initialDate?: string }) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [bikeDescription, setBikeDescription] = useState("");
  const [date, setDate] = useState(initialDate || _addDays(0));
  const [neededByDate, setNeededByDate] = useState("");
  const [notes, setNotes] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [technicianId, setTechnicianId] = useState(team[0]?.id || "");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:30");
  const [paymentStatus, setPaymentStatus] = useState<"pendiente" | "pagado" | "adelanto">("pendiente");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.3px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit", marginBottom: 10 };
  const lbl: React.CSSProperties = { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase" as const, display: "block", marginBottom: 4 };
  const canAdd = clientName.trim() && clientEmail.trim() && bikeDescription.trim();
  const handleAdd = () => {
    if (!canAdd || saving) return;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const newService: BikeService = {
      id, clientName: clientName.trim(), clientEmail: clientEmail.trim(),
      bikeDescription: bikeDescription.trim(), date, phase: 0,
      createdAt: new Date().toISOString(), notes,
      serviceType: serviceType || undefined,
      startTime, endTime,
      technicianId: technicianId || undefined,
      paymentStatus,
      paymentAmount: paymentStatus === "adelanto" ? (parseFloat(paymentAmount) || 0) : undefined,
      deliveryStatus: "en_taller",
      neededByDate: neededByDate || undefined,
      diagnosticUpdates: [],
    };
    onAdd(newService);
    onClose();
    // Email se envía en segundo plano sin bloquear el cierre del modal
    const trackingLink = buildTrackingUrl(newService);
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_SERVICE_TEMPLATE_ID, {
      email: newService.clientEmail,
      client_email: newService.clientEmail,
      client_name: newService.clientName,
      bike_description: newService.bikeDescription,
      phase_name: "Recibida",
      phase_icon: "📋",
      phase_message: `Hemos recibido tu bicicleta correctamente.\n\nEl proceso de revisión y mantenimiento puede tomar entre 1 y 5 días hábiles, dependiendo del estado de la bicicleta, disponibilidad de repuestos y autorización del cliente.\n\nPuedes consultar el estado actual de tu bicicleta en el siguiente enlace:`,
      tracking_link: trackingLink,
    }, EMAILJS_PUBLIC_KEY).catch((err: any) => console.warn("EmailJS error al crear servicio:", err?.text || err));
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0008", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--paper-2)", borderRadius: 14, padding: 24, width: "100%", maxWidth: 440, boxShadow: "0 4px 32px #0006", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="sk-mono" style={{ fontSize: 12, letterSpacing: 2, color: "var(--ink-3)", marginBottom: 18 }}>NUEVO SERVICIO</div>
        <label style={lbl}>Nombre del cliente *</label>
        <input style={inp} value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Juan García" autoFocus />
        <label style={lbl}>Email del cliente *</label>
        <input style={inp} type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="juan@email.com" />
        <label style={lbl}>Descripción de la bici *</label>
        <input style={inp} value={bikeDescription} onChange={e => setBikeDescription(e.target.value)} placeholder="Trek Marlin azul 2022" />
        <label style={lbl}>Servicio solicitado</label>
        <select style={{ ...inp, marginBottom: 10 }} value={serviceType} onChange={e => setServiceType(e.target.value)}>
          <option value="">Seleccionar servicio…</option>
          {SERVICES_CATALOG.map(g => (
            <optgroup key={g.category} label={g.category}>
              {g.items.map(item => (
                <option key={item.code} value={`${item.code} - ${item.name}`}>
                  {item.name} · ${item.price.toLocaleString("es-CO")}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>Fecha de ingreso</label>
            <input style={inp} type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Técnico asignado</label>
            <select style={{ ...inp, marginBottom: 0 }} value={technicianId} onChange={e => setTechnicianId(e.target.value)}>
              <option value="">Sin asignar</option>
              {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <label style={lbl}>¿Cuándo necesita la bici el cliente? (opcional)</label>
        <input style={inp} type="date" value={neededByDate} onChange={e => setNeededByDate(e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 0 }}>
          <div>
            <label style={lbl}>Hora inicio</label>
            <input style={inp} type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Hora fin (est.)</label>
            <input style={inp} type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>
        <label style={lbl}>Estado de pago</label>
        <div style={{ display: "flex", gap: 6, marginBottom: paymentStatus === "adelanto" ? 8 : 10 }}>
          {(["pendiente", "adelanto", "pagado"] as const).map(p => (
            <button key={p} className={"action" + (paymentStatus === p ? " accent" : "")} style={{ fontSize: 12, flex: 1, padding: "6px 4px" }} onClick={() => setPaymentStatus(p)}>
              {p === "pendiente" ? "💰 Pendiente" : p === "adelanto" ? "📤 Adelanto" : "✅ Pagado"}
            </button>
          ))}
        </div>
        {paymentStatus === "adelanto" && (
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>Monto del abono</label>
            <input style={inp} type="number" min="0" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0" />
          </div>
        )}
        <label style={lbl}>Notas (opcional)</label>
        <textarea style={{ ...inp, resize: "vertical" as const, minHeight: 60 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Cambio de frenos, ajuste de cambios..." />
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button type="button" className="action" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button type="button" className="action ink" onClick={handleAdd} style={{ flex: 2 }} disabled={!canAdd}>Crear servicio</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sección de servicios (admin) ─────────────────────────────────────────────
type DiagDraft = { estado: string; hallazgos: string; problemas: string; recomendaciones: string; partesRaw: string };
const EMPTY_DIAG: DiagDraft = { estado: "", hallazgos: "", problemas: "", recomendaciones: "", partesRaw: "" };

function ServiceSection({ services, onAdvancePhase, onNewService, onUpdateService = () => {}, onDeleteService = () => {}, team = [] }: { services: BikeService[]; onAdvancePhase: (id: string) => void; onNewService: () => void; onUpdateService?: (id: string, changes: Partial<BikeService>) => void; onDeleteService?: (id: string) => void; team?: any[] }) {
  const [sending, setSending] = useState<string | null>(null);
  const [copied, setCopied]   = useState<string | null>(null);
  const [editingAmounts, setEditingAmounts] = useState<Record<string, string>>({});
  const [showDiag, setShowDiag] = useState<Record<string, boolean>>({});
  const [diagDraft, setDiagDraft] = useState<Record<string, DiagDraft>>({});
  const toggleDiag = (id: string) => setShowDiag(p => ({ ...p, [id]: !p[id] }));
  const setDraft = (id: string, field: keyof DiagDraft, val: string) =>
    setDiagDraft(p => ({ ...p, [id]: { ...(p[id] || EMPTY_DIAG), [field]: val } }));
  const saveDiag = (s: BikeService) => {
    const draft = diagDraft[s.id] || EMPTY_DIAG;
    if (!draft.estado && !draft.hallazgos && !draft.problemas && !draft.recomendaciones && !draft.partesRaw) return;
    const entry: DiagnosticUpdate = {
      id: Date.now().toString(36),
      date: new Date().toISOString(),
      estado: draft.estado.trim(),
      hallazgos: draft.hallazgos.trim(),
      problemas: draft.problemas.trim(),
      recomendaciones: draft.recomendaciones.trim(),
      partes: draft.partesRaw.split("\n").map(p => p.trim()).filter(Boolean),
    };
    onUpdateService(s.id, { diagnosticUpdates: [...(s.diagnosticUpdates || []), entry] });
    setDiagDraft(p => ({ ...p, [s.id]: EMPTY_DIAG }));
    setShowDiag(p => ({ ...p, [s.id]: false }));
  };
  const fmtPago = (s: BikeService) => {
    if (s.paymentStatus === "pagado") return "✅ Pagado";
    if (s.paymentStatus === "adelanto") return s.paymentAmount ? `📤 Abono: $${s.paymentAmount.toLocaleString()}` : "📤 Adelanto (sin monto)";
    return "💰 Pago pendiente";
  };

  const notifyClient = async (s: BikeService) => {
    const ph = PHASES.find(p => p.id === s.phase);
    if (!ph) { alert("Avanza primero a una fase."); return; }
    setSending(s.id);
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_SERVICE_TEMPLATE_ID, {
        email: s.clientEmail,
        client_email: s.clientEmail,
        client_name: s.clientName,
        bike_description: s.bikeDescription,
        phase_name: ph.name,
        phase_icon: ph.icon,
        phase_message: ph.msg,
        tracking_link: buildTrackingUrl(s),
      }, EMAILJS_PUBLIC_KEY);
      alert(`✅ Email enviado a ${s.clientEmail}`);
    } catch (err: any) {
      const detail = err?.text || err?.message || JSON.stringify(err) || "Error desconocido";
      alert(`❌ No se pudo enviar el email.\n\nDetalle: ${detail}\n\nVerifica el template en EmailJS (ID: ${EMAILJS_SERVICE_TEMPLATE_ID})`);
    }
    setSending(null);
  };

  const copyLink = (s: BikeService) => {
    navigator.clipboard.writeText(buildTrackingUrl(s));
    setCopied(s.id); setTimeout(() => setCopied(null), 2000);
  };

  const phColor = (p: number) => PHASES.find(ph => ph.id === p)?.color || "#888";
  const phName  = (p: number) => p === 0 ? "Recibida" : PHASES.find(ph => ph.id === p)?.name || "";
  const phIcon  = (p: number) => p === 0 ? "📋" : PHASES.find(ph => ph.id === p)?.icon || "";
  const active  = services.filter(s => s.phase < 4);
  const done    = services.filter(s => s.phase === 4);

  return (
    <div style={{ padding: "16px 16px", maxWidth: 700, margin: "0 auto", width: "100%", boxSizing: "border-box" as const }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Servicios de bicicletas</div>
          <div className="sk-mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{active.length} activos · {done.length} completados</div>
        </div>
        <button className="action ink" onClick={onNewService}>+ Nuevo servicio</button>
      </div>

      {services.length === 0 && (
        <div className="placeholder" style={{ borderRadius: 12, padding: 48, textAlign: "center" }}>
          No hay servicios aún.<br />Crea el primero con el botón de arriba.
        </div>
      )}

      {active.map(s => (
        <div key={s.id} style={{ background: "var(--paper)", border: "1.4px solid var(--line)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{s.clientName}</div>
              <div style={{ color: "var(--ink-3)", fontSize: 13 }}>{s.bikeDescription}</div>
              {s.serviceType && <div style={{ fontSize: 12, color: "#6c1f6e", marginTop: 2 }}>🛠 {s.serviceType}</div>}
              <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>📅 {s.date}{s.startTime ? ` · ${s.startTime}${s.endTime ? `–${s.endTime}` : ""}` : ""}</div>
              {s.technicianId && team.find(p => p.id === s.technicianId) && <div className="sk-mono" style={{ fontSize: 10, color: "#6c1f6e", marginTop: 1 }}>🔧 {team.find(p => p.id === s.technicianId)?.name}</div>}
              {(() => { const u = urgencyInfo(s.neededByDate); return u ? <div style={{ display: "inline-block", marginTop: 4, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: u.bg, color: u.color, fontWeight: 600, border: `1px solid ${u.color}` }}>{u.label}</div> : null; })()}
            </div>
            <button onClick={() => { if (window.confirm(`¿Eliminar el servicio de ${s.clientName}?`)) onDeleteService(s.id); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 18, padding: "2px 4px", lineHeight: 1, flexShrink: 0 }} title="Eliminar">🗑</button>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--paper-2)", border: `1.5px solid ${phColor(s.phase)}`, borderRadius: 999, padding: "4px 12px", fontSize: 13, whiteSpace: "nowrap" as const }}>
              {phIcon(s.phase)} <span style={{ color: phColor(s.phase), fontWeight: 600 }}>{phName(s.phase)}</span>
            </span>
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
            {PHASES.map(ph => <div key={ph.id} style={{ flex: 1, height: 5, borderRadius: 3, background: s.phase >= ph.id ? ph.color : "var(--line)", transition: "background .3s" }} />)}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
            {s.phase < 4 && (
              <button className="action accent" style={{ fontSize: 12 }} onClick={() => onAdvancePhase(s.id)}>
                → {PHASES.find(p => p.id === s.phase + 1)?.name}
              </button>
            )}
            <button className="action" style={{ fontSize: 12 }} onClick={() => notifyClient(s)} disabled={s.phase === 0 || sending === s.id}>
              {sending === s.id ? "Enviando..." : "📧 Notificar cliente"}
            </button>
            <button className="action" style={{ fontSize: 12 }} onClick={() => copyLink(s)}>
              {copied === s.id ? "✓ Copiado" : "🔗 Copiar link"}
            </button>
          </div>
          {s.notes && <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>📝 {s.notes}</div>}

          {/* Panel de diagnóstico técnico */}
          <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            {/* Historial de diagnósticos existentes */}
            {(s.diagnosticUpdates || []).length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1, marginBottom: 6 }}>DIAGNÓSTICO TÉCNICO</div>
                {[...(s.diagnosticUpdates || [])].reverse().map(d => (
                  <div key={d.id} style={{ background: "var(--paper-2)", border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginBottom: 6 }}>
                    <div className="sk-mono" style={{ fontSize: 9, color: "var(--ink-3)", marginBottom: 4 }}>
                      {new Date(d.date).toLocaleDateString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                    {d.estado && <div style={{ fontSize: 12, marginBottom: 2 }}><span style={{ color: "#9c4a9e", fontWeight: 600 }}>Estado: </span>{d.estado}</div>}
                    {d.hallazgos && <div style={{ fontSize: 12, marginBottom: 2 }}><span style={{ color: "#e8a020", fontWeight: 600 }}>Hallazgos: </span>{d.hallazgos}</div>}
                    {d.problemas && <div style={{ fontSize: 12, marginBottom: 2 }}><span style={{ color: "#c0392b", fontWeight: 600 }}>Problemas: </span>{d.problemas}</div>}
                    {d.recomendaciones && <div style={{ fontSize: 12, marginBottom: d.partes.length > 0 ? 6 : 0 }}><span style={{ color: "#5cc8e8", fontWeight: 600 }}>Recomendaciones: </span>{d.recomendaciones}</div>}
                    {d.partes.length > 0 && (
                      <div style={{ background: "rgba(232,160,32,.08)", border: "1px solid #e8a020", borderRadius: 6, padding: "6px 10px" }}>
                        <div style={{ fontSize: 10, color: "#e8a020", fontFamily: "var(--mono)", letterSpacing: 0.5, marginBottom: 4 }}>🔩 REPUESTOS RECOMENDADOS</div>
                        {d.partes.map((p, i) => <div key={i} style={{ fontSize: 12 }}>· {p}</div>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {/* Formulario nuevo diagnóstico */}
            <button
              className="action"
              style={{ fontSize: 11, marginBottom: showDiag[s.id] ? 8 : 0 }}
              onClick={() => toggleDiag(s.id)}
            >
              {showDiag[s.id] ? "✕ Cancelar diagnóstico" : "🔬 Agregar diagnóstico"}
            </button>
            {showDiag[s.id] && (() => {
              const draft = diagDraft[s.id] || EMPTY_DIAG;
              const fi: React.CSSProperties = { width: "100%", padding: "7px 10px", borderRadius: 7, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 6, resize: "vertical" as const };
              const la: React.CSSProperties = { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase" as const, display: "block", marginBottom: 3 };
              return (
                <div style={{ background: "var(--paper-2)", border: "1px dashed var(--line)", borderRadius: 8, padding: 12 }}>
                  <label style={la}>Estado general</label>
                  <textarea rows={2} style={fi} value={draft.estado} onChange={e => setDraft(s.id, "estado", e.target.value)} placeholder="La bicicleta llegó con..." />
                  <label style={la}>Hallazgos</label>
                  <textarea rows={2} style={fi} value={draft.hallazgos} onChange={e => setDraft(s.id, "hallazgos", e.target.value)} placeholder="Se detectó desgaste en..." />
                  <label style={la}>Problemas detectados</label>
                  <textarea rows={2} style={fi} value={draft.problemas} onChange={e => setDraft(s.id, "problemas", e.target.value)} placeholder="Cadena con desgaste crítico..." />
                  <label style={la}>Recomendaciones</label>
                  <textarea rows={2} style={fi} value={draft.recomendaciones} onChange={e => setDraft(s.id, "recomendaciones", e.target.value)} placeholder="Se recomienda cambio inmediato de..." />
                  <label style={la}>Repuestos recomendados (uno por línea)</label>
                  <textarea rows={3} style={fi} value={draft.partesRaw} onChange={e => setDraft(s.id, "partesRaw", e.target.value)} placeholder={"Pastillas de freno\nCadena\nCassette"} />
                  <button className="action ink" style={{ fontSize: 12, width: "100%" }} onClick={() => saveDiag(s)}>Guardar diagnóstico</button>
                </div>
              );
            })()}
          </div>

          <div style={{ marginTop: 10, borderTop: "1px dashed var(--line)", paddingTop: 8 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: s.paymentStatus === "adelanto" ? 8 : 0 }}>
              <span className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", marginRight: 2 }}>PAGO:</span>
              {(["pendiente", "adelanto", "pagado"] as const).map(p => (
                <button key={p} onClick={() => onUpdateService(s.id, { paymentStatus: p })}
                  style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: `1.3px solid ${(s.paymentStatus || "pendiente") === p ? "#6c1f6e" : "var(--line)"}`, background: (s.paymentStatus || "pendiente") === p ? "rgba(108,31,110,.1)" : "transparent", color: (s.paymentStatus || "pendiente") === p ? "#6c1f6e" : "var(--ink-3)", cursor: "pointer", fontFamily: "inherit" }}>
                  {p === "pendiente" ? "Pendiente" : p === "adelanto" ? "Adelanto" : "Pagado"}
                </button>
              ))}
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }}>
                {s.deliveryStatus === "entregada" ? "🏠 Entregada" : s.phase === 4 ? "✅ Lista" : "🔧 En taller"}
              </span>
              {s.phase === 4 && s.deliveryStatus !== "entregada" && (
                <button onClick={() => onUpdateService(s.id, { deliveryStatus: "entregada" })}
                  style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: "1.3px solid #4caf50", background: "rgba(76,175,80,.1)", color: "#2e7d32", cursor: "pointer", fontFamily: "inherit" }}>
                  Marcar entregada
                </button>
              )}
            </div>
            {s.paymentStatus === "adelanto" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Monto abono:</span>
                <input
                  type="number" min="0"
                  value={editingAmounts[s.id] ?? (s.paymentAmount != null ? String(s.paymentAmount) : "")}
                  onChange={e => setEditingAmounts(prev => ({ ...prev, [s.id]: e.target.value }))}
                  onBlur={() => {
                    const v = parseFloat(editingAmounts[s.id] ?? String(s.paymentAmount || ""));
                    onUpdateService(s.id, { paymentAmount: isNaN(v) ? 0 : v });
                    setEditingAmounts(prev => { const n = { ...prev }; delete n[s.id]; return n; });
                  }}
                  onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  placeholder="0"
                  style={{ width: 110, padding: "5px 10px", borderRadius: 8, border: "1.5px solid #6c1f6e", fontSize: 14, fontFamily: "inherit", background: "var(--paper)", color: "var(--ink)", outline: "none" }}
                />
                {s.paymentAmount ? <span style={{ fontSize: 13, color: "#6c1f6e", fontWeight: 700 }}>${s.paymentAmount.toLocaleString()}</span> : null}
              </div>
            )}
          </div>
        </div>
      ))}

      {done.length > 0 && (
        <>
          <div className="sk-mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: 1, marginTop: 24, marginBottom: 10 }}>COMPLETADOS</div>
          {done.map(s => (
            <div key={s.id} style={{ background: "var(--paper)", border: "1.4px solid var(--line)", borderRadius: 12, padding: 14, marginBottom: 8, opacity: 0.65 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.clientName}</span>
                  <span style={{ color: "var(--ink-3)", fontSize: 13 }}> · {s.bikeDescription}</span>
                  <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>📅 {s.date}</div>
                </div>
                <span style={{ color: "#4caf50", fontSize: 13 }}>✅ Lista para recoger</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Modal asignar tarea ──────────────────────────────────────────────────────
function AssignTaskModal({ team, onAdd, onClose }: { team: any[]; onAdd: (t: AppTask) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState(team[0]?.id || "");
  const [tag, setTag] = useState("GENERAL");
  const [date, setDate] = useState(_addDays(0));
  const [hasTime, setHasTime] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const tags = ["GENERAL", "TALLER", "TIENDA", "LIMPIEZA", "CAJA", "PEDIDO"];
  const handleAdd = () => {
    if (!title.trim() || !assignedTo) return;
    onAdd({ id: Date.now().toString(36), title: title.trim(), assignedTo, tag, done: false, createdAt: new Date().toISOString(), date, hasTime, startTime: hasTime ? startTime : "", endTime: hasTime ? endTime : "" });
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="row between" style={{ marginBottom: 16 }}>
          <div className="sk-title text-xl">Nueva tarea</div>
          <span className="task-tag-b">TAREA INTERNA</span>
        </div>
        <div className="field-group">
          <div className="field-label">Descripción *</div>
          <input className="field-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Revisar frenos bici #108" autoFocus />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field-group">
            <div className="field-label">Asignar a</div>
            <select className="field-input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
              {team.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
            </select>
          </div>
          <div className="field-group">
            <div className="field-label">Fecha</div>
            <input className="field-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div className="field-group">
          <div className="field-label">Categoría</div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
            {tags.map(t => <button key={t} className={"action" + (tag === t ? " accent" : "")} style={{ fontSize: 11, padding: "3px 10px" }} onClick={() => setTag(t)}>{t}</button>)}
          </div>
        </div>
        <div style={{ padding: "10px 0", marginTop: 4, borderTop: "1.2px dashed var(--line)", borderBottom: "1.2px dashed var(--line)", marginBottom: 10 }}>
          <label className="row gap-3" style={{ cursor: "pointer" }}>
            <input type="checkbox" checked={hasTime} onChange={e => setHasTime(e.target.checked)} style={{ width: 16, height: 16, cursor: "pointer" }} />
            <span className="text-sm">Tiene hora específica</span>
            <span className="sk-mono text-xs muted">(si no, aparece como "todo el día")</span>
          </label>
        </div>
        {hasTime && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="field-group">
              <div className="field-label">Hora inicio</div>
              <input className="field-input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="field-group">
              <div className="field-label">Hora fin</div>
              <input className="field-input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
        )}
        <div className="row gap-3" style={{ marginTop: 16 }}>
          <button className="action" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button className="action ink" onClick={handleAdd} style={{ flex: 2 }} disabled={!title.trim()}>+ Añadir tarea</button>
        </div>
      </div>
    </div>
  );
}

function AppointmentModal({ team, initialDate, onAdd, onClose }: { team: any[]; initialDate?: string; onAdd: (a: Appointment) => void; onClose: () => void }) {
  const [client, setClient] = useState("");
  const [service, setService] = useState("");
  const [assignedTo, setAssignedTo] = useState(team[0]?.id || "");
  const [date, setDate] = useState(initialDate || _addDays(0));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:30");
  const [notes, setNotes] = useState("");
  const handleAdd = () => {
    if (!client.trim() || !service) return;
    onAdd({ id: Date.now().toString(36), client: client.trim(), service, assignedTo, date, startTime, endTime, notes, createdAt: new Date().toISOString() });
    onClose();
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="row between" style={{ marginBottom: 16 }}>
          <div className="sk-title text-xl">Nuevo agendamiento</div>
          <span className="serv-tag">SERVICIO CLIENTE</span>
        </div>
        <div className="field-group">
          <div className="field-label">Nombre del cliente *</div>
          <input className="field-input" value={client} onChange={e => setClient(e.target.value)} placeholder="Nombre del cliente…" autoFocus />
        </div>
        <div className="field-group">
          <div className="field-label">Tipo de servicio *</div>
          <select className="field-input" value={service} onChange={e => setService(e.target.value)}>
            <option value="">Selecciona un servicio…</option>
            {SERVICES_CATALOG.map(g => (
              <optgroup key={g.category} label={g.category}>
                {g.items.map(item => (
                  <option key={item.code} value={`${item.code} - ${item.name}`}>
                    {item.name} · ${item.price.toLocaleString("es-CO")}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field-group">
            <div className="field-label">Mecánico asignado</div>
            <select className="field-input" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
              {team.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
            </select>
          </div>
          <div className="field-group">
            <div className="field-label">Fecha</div>
            <input className="field-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field-group">
            <div className="field-label">Hora inicio</div>
            <input className="field-input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div className="field-group">
            <div className="field-label">Hora fin (estimado)</div>
            <input className="field-input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>
        <div className="field-group">
          <div className="field-label">Notas para el mecánico</div>
          <textarea className="field-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionales…" />
        </div>
        <div className="row gap-3" style={{ marginTop: 16 }}>
          <button className="action" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button className="action ink" onClick={handleAdd} style={{ flex: 2 }} disabled={!client.trim() || !service}>+ Agendar servicio</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard del colaborador ────────────────────────────────────────────────
function EmployeeDashboard({ session, team, shift, setShift, tasks, onToggleTask, appointments, onNewAppointment, services, onNewService, onAdvancePhase, onLogout, extendedData = {}, setTasks, setAppointments, onNewBikeService, empLunch = {}, setEmpLunch, onUpdateService }: {
  session: Session; team: any[]; shift: any; setShift: any;
  tasks: AppTask[]; onToggleTask: (id: string) => void;
  appointments: Appointment[]; onNewAppointment: () => void;
  services: BikeService[]; onNewService: () => void; onAdvancePhase: (id: string) => void; onLogout: () => void;
  extendedData?: any;
  setTasks?: (fn: (prev: AppTask[]) => AppTask[]) => void;
  setAppointments?: (fn: (prev: Appointment[]) => Appointment[]) => void;
  onNewBikeService?: (date: string) => void;
  empLunch?: Record<string, boolean>;
  setEmpLunch?: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  onUpdateService?: (id: string, changes: Partial<BikeService>) => void;
}) {
  const me = team.find(m => m.id === session.id) || { name: session.name, role: session.role, initials: (session.name || "?")[0], id: session.id };
  const todayStr = _fmtDate(new Date());
  const myTasks = tasks.filter(t => t.assignedTo === session.id);
  const myTodayTasks = myTasks.filter(t => !t.date || t.date === todayStr);
  const myTodayAppts = appointments.filter(a => a.assignedTo === session.id && a.date === todayStr);
  const myTodayBikes = services.filter(s => s.technicianId === session.id && s.date === todayStr && s.phase < 4);
  const myUpcomingAppts = appointments.filter(a => a.assignedTo === session.id && a.date > todayStr)
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const myUpcomingBikes = services.filter(s => s.technicianId === session.id && s.date > todayStr && s.phase < 4)
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const isIn = !!shift[session.id!];
  const isLunch = !!empLunch?.[session.id!];
  const extData = (extendedData as any)[session.id!] || {};
  const perms = extData.permissions || { ...DEFAULT_PERMISSIONS };
  const phName = (p: number) => p === 0 ? "Recibida" : PHASES.find(ph => ph.id === p)?.name || "";
  const phColor = (p: number) => PHASES.find(ph => ph.id === p)?.color || "#888";
  const [tab, setTab] = useState<"inicio" | "calendario">("inicio");
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  const shiftEntry = shift[session.id!];
  const elapsedSecs = (shiftEntry && typeof shiftEntry === "string") ? Math.floor((Date.now() - new Date(shiftEntry).getTime()) / 1000) : 0;
  const elapsedStr = elapsedSecs > 0 ? `${Math.floor(elapsedSecs / 3600)}h ${String(Math.floor((elapsedSecs % 3600) / 60)).padStart(2, "0")}m` : "";
  const entryTimeStr = (shiftEntry && typeof shiftEntry === "string") ? new Date(shiftEntry).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", display: "flex", flexDirection: "column" }}>
      <style>{CSS}</style>
      {/* Header */}
      <div style={{ background: "var(--paper-2)", borderBottom: "1.4px solid var(--line)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Logo height={28} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{me.name}</div>
            <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{me.role}</div>
          </div>
        </div>
        <button className="action" style={{ fontSize: 12 }} onClick={onLogout}>Salir</button>
      </div>

      {/* Pestañas */}
      <div style={{ display: "flex", borderBottom: "1.4px solid var(--line)", background: "var(--paper-2)", flexShrink: 0 }}>
        {(["inicio", "calendario"] as const).map(t => (
          <div key={t} onClick={() => setTab(t)}
            style={{ padding: "11px 22px", fontFamily: "var(--mono)", fontSize: 11, letterSpacing: 0.5, textTransform: "uppercase" as const, cursor: "pointer", borderBottom: `2px solid ${tab === t ? "var(--accent)" : "transparent"}`, color: tab === t ? "var(--accent)" : "var(--ink-3)", transition: "color .15s, border-color .15s", WebkitTapHighlightColor: "transparent" }}
          >
            {t === "inicio" ? "🏠 Inicio" : "📅 Calendario"}
          </div>
        ))}
      </div>

      {tab === "calendario" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <CalendarSection
            tasks={tasks} appointments={appointments} services={services}
            setTasks={setTasks ?? ((_fn: any) => {})}
            setAppointments={setAppointments ?? ((_fn: any) => {})}
            onNewBikeService={onNewBikeService ?? (() => {})}
            team={team}
            onUpdateService={onUpdateService}
          />
        </div>
      )}

      {tab === "inicio" && <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 80px", maxWidth: 640, margin: "0 auto", width: "100%", boxSizing: "border-box" as const }}>
        {/* Turno */}
        <div style={{ background: isLunch ? "#fff3e0" : isIn ? "var(--accent-soft)" : "var(--paper-2)", border: `2px solid ${isLunch ? "#e8a020" : isIn ? "var(--accent)" : "var(--line)"}`, borderStyle: isIn ? "solid" : "dashed", borderRadius: 14, padding: 22, textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{isLunch ? "🍽" : isIn ? "🟢" : "⚪"}</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
            {isLunch ? "En almuerzo" : isIn ? "Estás en turno" : "Fuera de turno"}
          </div>
          <div className="sk-mono" style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>
            {isLunch ? "Toca Terminar cuando vuelvas" : isIn ? "Toca para marcar tu salida" : "Toca para marcar tu entrada"}
          </div>
          {isIn && entryTimeStr && (
            <div className="sk-mono" style={{ fontSize: 12, color: "var(--accent)", marginBottom: 14 }}>
              Entrada: {entryTimeStr}{elapsedStr ? ` · ${elapsedStr} trabajadas` : ""}
            </div>
          )}
          {!isIn && <div style={{ marginBottom: 14 }} />}
          <button
            style={{ fontSize: 14, padding: "10px 32px", borderRadius: 999, background: isIn ? "#e05555" : "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            onClick={() => {
              setShift((s: any) => ({ ...s, [session.id!]: s[session.id!] ? false : new Date().toISOString() }));
              if (isLunch) setEmpLunch?.(l => ({ ...l, [session.id!]: false }));
            }}
          >
            {isIn ? "⬊ Salir de turno" : "⬈ Entrar al turno"}
          </button>
          {isIn && (
            <div style={{ marginTop: 10 }}>
              <button
                style={{ fontSize: 13, padding: "8px 28px", borderRadius: 999, background: isLunch ? "#e8a020" : "transparent", color: isLunch ? "#fff" : "#e8a020", border: "1.5px solid #e8a020", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
                onClick={() => setEmpLunch?.(l => ({ ...l, [session.id!]: !isLunch }))}
              >
                {isLunch ? "✓ Terminar almuerzo" : "🍽 Iniciar almuerzo"}
              </button>
            </div>
          )}
        </div>

        {/* Mis tareas del día */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              Mis tareas hoy{" "}
              {myTodayTasks.length > 0 && <span className="sk-mono" style={{ fontSize: 11, color: "var(--ink-3)", fontWeight: 400 }}>({myTodayTasks.filter(t => !t.done).length} pendientes)</span>}
            </div>
          </div>
          {myTodayTasks.length === 0 ? (
            <div className="placeholder" style={{ borderRadius: 10, padding: 24, textAlign: "center", fontSize: 13 }}>No tienes tareas asignadas por ahora.</div>
          ) : myTodayTasks.map(t => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", background: "#dbeafe22", borderRadius: 10, marginBottom: 8, border: "1.3px solid #3b82f6" }}>
              <div onClick={() => onToggleTask(t.id)} style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${t.done ? "#3b82f6" : "var(--line)"}`, background: t.done ? "#3b82f6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: "#fff", fontSize: 13 }}>
                {t.done && "✓"}
              </div>
              <span style={{ flex: 1, fontSize: 14, textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.5 : 1 }}>{t.title}</span>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "#1d4ed8", background: "#dbeafe", border: "1px solid #3b82f6", borderRadius: 999, padding: "2px 8px" }}>{t.tag}</span>
                {t.hasTime && <span style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)" }}>{t.startTime}–{t.endTime}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Servicios hoy (bicis asignadas + agendamientos) */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Servicios hoy</div>
            {perms.canScheduleServices && (
              <button className="action" style={{ fontSize: 12, background: "rgba(108,31,110,.1)", borderColor: "#6c1f6e", color: "#6c1f6e" }} onClick={onNewService}>+ Nuevo servicio</button>
            )}
          </div>
          {myTodayBikes.length === 0 && myTodayAppts.length === 0 ? (
            <div className="placeholder" style={{ borderRadius: 10, padding: 24, textAlign: "center", fontSize: 13 }}>No hay servicios asignados para hoy.</div>
          ) : (
            <>
              {myTodayBikes.map(s => (
                <div key={s.id} style={{ padding: 14, border: "1.5px solid #6c1f6e", borderRadius: 12, background: "rgba(108,31,110,.05)", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontFamily: "var(--mono)", background: "rgba(108,31,110,.1)", border: "1px solid #6c1f6e", color: "#6c1f6e", borderRadius: 999, padding: "2px 8px" }}>🔧 BICI</span>
                    {s.startTime && <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "#6c1f6e" }}>{s.startTime}{s.endTime ? `–${s.endTime}` : ""}</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{s.clientName}</div>
                  <div style={{ color: "var(--ink-3)", fontSize: 13 }}>{s.bikeDescription}</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: phColor(s.phase), fontWeight: 600 }}>
                    {s.phase === 0 ? "📋 Recibida" : `${PHASES.find(ph => ph.id === s.phase)?.icon} ${phName(s.phase)}`}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: s.paymentStatus === "pagado" ? "#2e7d32" : s.paymentStatus === "adelanto" ? "#6c1f6e" : "var(--ink-3)" }}>
                    {s.paymentStatus === "pagado" ? "✅ Pagado" : s.paymentStatus === "adelanto" ? `📤 Abono: $${(s.paymentAmount || 0).toLocaleString()}` : "💰 Pago pendiente"}
                  </div>
                  {s.notes && <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>"{s.notes}"</div>}
                </div>
              ))}
              {myTodayAppts.map(a => (
                <div key={a.id} className="serv-card-emp">
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span className="serv-tag">{a.startTime}–{a.endTime}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{a.client}</div>
                  <div style={{ color: "var(--ink-3)", fontSize: 13 }}>{a.service}</div>
                  {a.notes && <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>"{a.notes}"</div>}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Próximos servicios */}
        {(myUpcomingAppts.length > 0 || myUpcomingBikes.length > 0) && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Próximos servicios</div>
            {myUpcomingBikes.map(s => (
              <div key={s.id} style={{ background: "var(--paper-2)", border: "1.3px dashed #6c1f6e", borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "#6c1f6e", marginBottom: 4 }}>{s.date}{s.startTime ? ` · ${s.startTime}` : ""}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.clientName}</div>
                <div style={{ color: "var(--ink-3)", fontSize: 13 }}>{s.bikeDescription}</div>
              </div>
            ))}
            {myUpcomingAppts.map(a => (
              <div key={a.id} style={{ background: "var(--paper-2)", border: "1.3px dashed #c8a800", borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "#7a5500", marginBottom: 4 }}>{a.date} · {a.startTime}–{a.endTime}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.client}</div>
                <div style={{ color: "var(--ink-3)", fontSize: 13 }}>{a.service}</div>
              </div>
            ))}
          </div>
        )}

        {/* Mantenimientos disponibles */}
        {perms.canScheduleServices && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Catálogo de servicios</div>
            <span className="sk-mono text-xs muted">Toca para agendar</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SERVICES_CATALOG.map(g => (
              <div key={g.category}>
                <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", letterSpacing: 1, marginBottom: 6 }}>{g.category}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                  {g.items.map(item => (
                    <div key={item.code} className="maint-card" onClick={onNewService} style={{ padding: "10px 12px" }}>
                      <div className="serv-tag" style={{ marginBottom: 4, fontSize: 9 }}>{item.code}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "#6c1f6e", marginTop: 3, fontWeight: 700 }}>${item.price.toLocaleString("es-CO")}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Servicios activos (seguimiento de fases) */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Bicis en taller</div>
            {perms.canRegisterBikes && <button className="action ink" style={{ fontSize: 12 }} onClick={onNewService}>+ Registrar bici</button>}
          </div>
          {services.filter(s => s.phase < 4).length === 0 ? (
            <div className="placeholder" style={{ borderRadius: 10, padding: 24, textAlign: "center", fontSize: 13 }}>No hay bicis en taller ahora.</div>
          ) : services.filter(s => s.phase < 4).map(s => {
            const nextPhase = PHASES.find(ph => ph.id === s.phase + 1);
            return (
              <div key={s.id} style={{ background: "var(--paper-2)", border: "1.3px solid var(--line)", borderRadius: 10, padding: 14, marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.clientName}</div>
                <div style={{ color: "var(--ink-3)", fontSize: 13 }}>{s.bikeDescription}</div>
                <div style={{ marginTop: 8, display: "flex", gap: 4, marginBottom: 8 }}>
                  {PHASES.map(ph => <div key={ph.id} style={{ flex: 1, height: 5, borderRadius: 3, background: s.phase >= ph.id ? ph.color : "var(--line)", transition: "background .3s" }} />)}
                </div>
                <div style={{ fontSize: 11, color: s.paymentStatus === "pagado" ? "#2e7d32" : s.paymentStatus === "adelanto" ? "#6c1f6e" : "var(--ink-3)", marginBottom: 6 }}>
                  {s.paymentStatus === "pagado" ? "✅ Pagado" : s.paymentStatus === "adelanto" ? `📤 Abono: $${(s.paymentAmount || 0).toLocaleString()}` : "💰 Pago pendiente"}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: phColor(s.phase), fontWeight: 600 }}>{s.phase === 0 ? "📋 Recibida" : `${PHASES.find(ph => ph.id === s.phase)?.icon} ${phName(s.phase)}`}</div>
                  {nextPhase && perms.canModifyServices && (
                    <button
                      onClick={() => onAdvancePhase(s.id)}
                      style={{ fontSize: 12, padding: "5px 12px", borderRadius: 999, background: nextPhase.color, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
                    >
                      {nextPhase.icon} → {nextPhase.name}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>}
    </div>
  );
}

const STORED_PASSWORD_KEY = "cwb_admin_pwd";
const getAdminPassword = () => localStorage.getItem(STORED_PASSWORD_KEY) || "capital2024";

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"request" | "verify" | "newpwd">("request");
  const [generatedCode, setGeneratedCode] = useState("");
  const [enteredCode, setEnteredCode] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const sendCode = async () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);
    setLoading(true);
    setMsg("");
    try {
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        { email: ADMIN_EMAIL, code, app_name: "Capital Wo-Man Bikes" },
        EMAILJS_PUBLIC_KEY
      );
      setStep("verify");
      setMsg("Código enviado a tu correo.");
    } catch {
      setMsg("Error al enviar el correo. Verifica la configuración de EmailJS.");
    }
    setLoading(false);
  };

  const verifyCode = () => {
    if (enteredCode === generatedCode) {
      setStep("newpwd");
      setMsg("");
    } else {
      setMsg("Código incorrecto. Inténtalo de nuevo.");
    }
  };

  const savePassword = () => {
    if (newPwd.length < 6) { setMsg("La contraseña debe tener al menos 6 caracteres."); return; }
    if (newPwd !== confirmPwd) { setMsg("Las contraseñas no coinciden."); return; }
    localStorage.setItem(STORED_PASSWORD_KEY, newPwd);
    saveShopData({ adminPassword: newPwd });
    setMsg("¡Contraseña cambiada con éxito!");
    setTimeout(onClose, 1500);
  };

  const inp: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #4a2a4a", background: "#2d1a2d", color: "#e8d5e8", fontSize: 14, marginBottom: 8, boxSizing: "border-box" };
  const btn: React.CSSProperties = { width: "100%", padding: "10px 0", borderRadius: 8, background: "#6c1f6e", color: "#fff", border: "none", fontFamily: "monospace", fontSize: 13, letterSpacing: 1, cursor: "pointer", marginTop: 4 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0008", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#221222", borderRadius: 16, padding: 32, width: "100%", maxWidth: 340, textAlign: "center", boxShadow: "0 4px 32px #0008" }}>
        <div style={{ color: "#c8a8c8", fontFamily: "monospace", fontSize: 12, letterSpacing: 2, marginBottom: 20 }}>CAMBIAR CONTRASEÑA</div>

        {step === "request" && <>
          <p style={{ color: "#c8a8c8", fontSize: 13, marginBottom: 16 }}>Te enviaremos un código de seguridad a <strong style={{ color: "#e8d5e8" }}>{ADMIN_EMAIL}</strong></p>
          <button onClick={sendCode} disabled={loading} style={btn}>{loading ? "Enviando..." : "ENVIAR CÓDIGO"}</button>
        </>}

        {step === "verify" && <>
          <p style={{ color: "#c8a8c8", fontSize: 13, marginBottom: 12 }}>Ingresa el código de 6 dígitos que llegó a tu correo:</p>
          <input style={inp} type="text" maxLength={6} placeholder="000000" value={enteredCode} onChange={e => setEnteredCode(e.target.value)} autoFocus />
          <button onClick={verifyCode} style={btn}>VERIFICAR</button>
          <button onClick={sendCode} disabled={loading} style={{ ...btn, background: "none", border: "1px solid #4a2a4a", color: "#c8a8c8", marginTop: 8 }}>Reenviar código</button>
        </>}

        {step === "newpwd" && <>
          <input style={inp} type="password" placeholder="Nueva contraseña (mín. 6 caracteres)" value={newPwd} onChange={e => setNewPwd(e.target.value)} autoFocus />
          <input style={inp} type="password" placeholder="Confirmar contraseña" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
          <button onClick={savePassword} style={btn}>GUARDAR CONTRASEÑA</button>
        </>}

        {msg && <div style={{ color: msg.includes("éxito") ? "#5cc8e8" : "#e05555", fontSize: 12, marginTop: 10 }}>{msg}</div>}
        <button onClick={onClose} style={{ marginTop: 14, background: "none", border: "none", color: "#6a4a6a", fontSize: 12, cursor: "pointer", fontFamily: "monospace" }}>cancelar</button>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, loading = false }: { onLogin: (session: Session) => void; loading?: boolean }) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);

  const handleLogin = () => {
    if (loading) return;
    if (pwd === getAdminPassword()) {
      const s: Session = { type: "admin" };
      sessionStorage.setItem("cwb_session", JSON.stringify(s));
      onLogin(s);
      return;
    }
    // Check employee PINs — try cache first, then fall back to cwb_ext + cwb_team directly
    try {
      const empCache: Array<{ id: string; name: string; role: string; pin: string }> =
        JSON.parse(localStorage.getItem("cwb_emp_cache") || "[]");
      let emp = empCache.find(e => e.pin && e.pin === pwd);
      if (!emp) {
        const extD: any = JSON.parse(localStorage.getItem("cwb_ext") || "null") || {};
        const teamD: any[] = JSON.parse(localStorage.getItem("cwb_team") || "null") || [];
        const m = teamD.find((t: any) => extD[t.id]?.pin && extD[t.id].pin === pwd);
        if (m) emp = { id: m.id, name: m.name, role: m.role, pin: extD[m.id].pin };
      }
      if (emp) {
        const s: Session = { type: "employee", id: emp.id, name: emp.name, role: emp.role };
        sessionStorage.setItem("cwb_session", JSON.stringify(s));
        onLogin(s);
        return;
      }
    } catch {}
    setError(true);
    setPwd("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#1a0d1a", padding: 16 }}>
      <style>{CSS}</style>
      <div style={{ background: "#221222", borderRadius: 16, padding: 40, width: "100%", maxWidth: 360, textAlign: "center", boxShadow: "0 4px 32px #0006" }}>
        <Logo height={48} />
        <div style={{ marginTop: 24, marginBottom: 16, color: "#c8a8c8", fontFamily: "monospace", fontSize: 12, letterSpacing: 3 }}>ACCESO ADMINISTRACIÓN</div>
        {loading ? (
          <div style={{ color: "#6a4a6a", fontFamily: "monospace", fontSize: 12, padding: "20px 0", letterSpacing: 2 }}>CARGANDO...</div>
        ) : (
          <>
            <input
              type="password"
              value={pwd}
              onChange={e => { setPwd(e.target.value); setError(false); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Contraseña / PIN"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: error ? "1px solid #e05555" : "1px solid #4a2a4a", background: "#2d1a2d", color: "#e8d5e8", fontSize: 14, marginBottom: 8, boxSizing: "border-box" as const }}
              autoFocus
            />
            {error && <div style={{ color: "#e05555", fontSize: 12, marginBottom: 8 }}>Contraseña o PIN incorrecto</div>}
            <button
              onClick={handleLogin}
              style={{ width: "100%", padding: "10px 0", borderRadius: 8, background: "#6c1f6e", color: "#fff", border: "none", fontFamily: "monospace", fontSize: 13, letterSpacing: 1, cursor: "pointer", marginTop: 4 }}
            >
              ENTRAR
            </button>
            <button
              onClick={() => setShowChangePwd(true)}
              style={{ marginTop: 16, background: "none", border: "none", color: "#6a4a6a", fontSize: 12, cursor: "pointer", fontFamily: "monospace", textDecoration: "underline" }}
            >
              Cambiar contraseña
            </button>
          </>
        )}
      </div>
      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </div>
  );
}

const DEFAULT_PERMISSIONS = { canScheduleServices: true, canEditAppointments: true, canRegisterBikes: true, canModifyServices: true };
const DEFAULT_EXT = {
  s: { salario: "", direccion: "", documento: "", eps: "", horasSemana: "40", pin: "", permissions: { ...DEFAULT_PERMISSIONS } },
  c: { salario: "", direccion: "", documento: "", eps: "", horasSemana: "40", pin: "", permissions: { ...DEFAULT_PERMISSIONS } },
};

export default function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try { return JSON.parse(sessionStorage.getItem("cwb_session") || "null"); } catch { return null; }
  });
  const [section, setSection] = useState("dash");
  const [showNewService, setShowNewService] = useState(false);
  const [showAssignTask, setShowAssignTask] = useState(false);
  const [services, setServices] = useState<BikeService[]>(() => {
    try { return JSON.parse(localStorage.getItem("cwb_services") || "[]"); } catch { return []; }
  });
  const [tasks, setTasks] = useState<AppTask[]>(() => {
    try { return JSON.parse(localStorage.getItem("cwb_tasks") || "[]"); } catch { return []; }
  });
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    try { return JSON.parse(localStorage.getItem("cwb_appointments") || "[]"); } catch { return []; }
  });
  const [showApptModal, setShowApptModal] = useState(false);
  const [dashTab, setDashTab] = useState("lista");
  const [lunch, setLunch] = useState(false);
  const [empLunch, setEmpLunch] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem("cwb_emp_lunch") || "null") || {}; } catch { return {}; }
  });
  const [shift, setShift] = useState<Record<string, boolean | string>>(() => {
    try { return JSON.parse(localStorage.getItem("cwb_shift") || "null") || { s: false, c: false }; } catch { return { s: false, c: false }; }
  });
  const [team, setTeam] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cwb_team") || "null") || INITIAL_TEAM; } catch { return INITIAL_TEAM; }
  });
  const [showModal, setShowModal] = useState(false);
  const [serviceModalDate, setServiceModalDate] = useState<string | undefined>(undefined);
  const [extendedData, setExtendedData] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cwb_ext") || "null") || DEFAULT_EXT; } catch { return DEFAULT_EXT; }
  });

  // ── Firebase sync ─────────────────────────────────────────────────────────
  const fbReady = useRef(false);
  const [fbLoading, setFbLoading] = useState(true);

  useEffect(() => {
    loadShopDataOnce().then(data => {
      if (!data) {
        // First time — migrate existing localStorage data to Firestore
        saveShopData({ adminPassword: getAdminPassword(), team, extendedData, services, tasks, shift, appointments, empLunch });
        // Rebuild PIN cache from localStorage data
        const cache = team.map(m => ({ id: m.id, name: m.name, role: m.role, pin: (extendedData as any)[m.id]?.pin || "" }));
        localStorage.setItem("cwb_emp_cache", JSON.stringify(cache));
      } else {
        // Restore from Firestore (cloud takes priority over cached localStorage)
        if (Array.isArray(data.team) && data.team.length) setTeam(data.team);
        if (data.extendedData && Object.keys(data.extendedData).length) setExtendedData(data.extendedData);
        if (Array.isArray(data.services)) setServices(data.services);
        if (Array.isArray(data.tasks)) setTasks(data.tasks);
        if (Array.isArray(data.appointments)) setAppointments(data.appointments);
        if (data.shift && typeof data.shift === "object") setShift(data.shift);
        if (data.empLunch && typeof data.empLunch === "object") setEmpLunch(data.empLunch);
        if (data.adminPassword) localStorage.setItem(STORED_PASSWORD_KEY, data.adminPassword);
        // Rebuild PIN cache from Firestore data
        const extD: any = data.extendedData || {};
        const cache = (data.team || []).map((m: any) => ({ id: m.id, name: m.name, role: m.role, pin: extD[m.id]?.pin || "" }));
        localStorage.setItem("cwb_emp_cache", JSON.stringify(cache));
      }
      fbReady.current = true;
      setFbLoading(false);
    }).catch(() => { fbReady.current = true; setFbLoading(false); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addMember = ({ name, role, initials }) => {
    const id = name.toLowerCase().replace(/\s+/g, "").slice(0, 4) + Date.now().toString().slice(-3);
    setTeam(t => [...t, { id, name, role, initials }]);
    setShift(s => ({ ...s, [id]: false }));
  };
  const removeMember = (id) => {
    setTeam(t => t.filter(p => p.id !== id));
    setShift(s => { const n = { ...s }; delete n[id]; return n; });
  };
  const updateMemberData = (id, data) => {
    const initials = data.name.trim().split(" ").map(w => w[0] || "").join("").toUpperCase().slice(0, 2);
    setTeam(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, name: data.name, role: data.role, initials } : p);
      // Update employee PIN cache for login
      setExtendedData(d => {
        return { ...d, [id]: { salario: data.salario, direccion: data.direccion, documento: data.documento, eps: data.eps, horasSemana: data.horasSemana, pin: data.pin || "", permissions: data.permissions || DEFAULT_PERMISSIONS } };
      });
      return updated;
    });
  };

  useEffect(() => {
    localStorage.setItem("cwb_services", JSON.stringify(services));
    if (fbReady.current) saveShopData({ services }).catch(e => console.error("Firestore services:", e));
  }, [services]);
  useEffect(() => {
    localStorage.setItem("cwb_tasks", JSON.stringify(tasks));
    if (fbReady.current) saveShopData({ tasks }).catch(e => console.error("Firestore tasks:", e));
  }, [tasks]);
  useEffect(() => {
    localStorage.setItem("cwb_team", JSON.stringify(team));
    if (fbReady.current) saveShopData({ team }).catch(e => console.error("Firestore team:", e));
  }, [team]);
  useEffect(() => {
    localStorage.setItem("cwb_shift", JSON.stringify(shift));
    if (fbReady.current) saveShopData({ shift }).catch(e => console.error("Firestore shift:", e));
  }, [shift]);
  useEffect(() => {
    localStorage.setItem("cwb_emp_lunch", JSON.stringify(empLunch));
    if (fbReady.current) saveShopData({ empLunch });
  }, [empLunch]);
  useEffect(() => {
    localStorage.setItem("cwb_ext", JSON.stringify(extendedData));
    const cache = team.map(m => ({ id: m.id, name: m.name, role: m.role, pin: (extendedData as any)[m.id]?.pin || "" }));
    localStorage.setItem("cwb_emp_cache", JSON.stringify(cache));
    if (fbReady.current) saveShopData({ extendedData });
  }, [extendedData, team]);

  const addService      = (s: BikeService) => setServices(prev => [s, ...prev]);
  const updateService   = (id: string, changes: Partial<BikeService>) => setServices(prev => prev.map(s => s.id === id ? { ...s, ...changes } : s));
  const deleteService   = (id: string) => setServices(prev => prev.filter(s => s.id !== id));
  const advancePhase = (id: string) => {
    setServices(prev => {
      const now = new Date().toISOString();
      const updated = prev.map(s => {
        if (s.id !== id || s.phase >= 4) return s;
        const newPhase = s.phase + 1;
        return { ...s, phase: newPhase, ...(newPhase === 4 ? { completedAt: now } : {}) };
      });
      const svc = updated.find(s => s.id === id);
      if (svc && svc.phase > 0) {
        const ph = PHASES.find(p => p.id === svc.phase)!;
        const phaseMessage = svc.phase === 4
          ? `Tu bicicleta ya está lista para entrega 🚴‍♂️\n\nPuedes acercarte a recogerla en nuestro taller en el horario habitual.\n\nTe recordamos que cuentas con 5 días calendario para recogerla. Pasado este tiempo, se empezará a generar un cobro por bodegaje de $4.000 COP por día, según nuestras políticas.\n\nSi tienes alguna duda o necesitas coordinar la entrega, puedes escribirnos.`
          : ph.msg;
        emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_SERVICE_TEMPLATE_ID, {
          email: svc.clientEmail,
          client_email: svc.clientEmail,
          client_name: svc.clientName,
          bike_description: svc.bikeDescription,
          phase_name: ph.name,
          phase_icon: ph.icon,
          phase_message: phaseMessage,
          tracking_link: buildTrackingUrl(svc),
        }, EMAILJS_PUBLIC_KEY).catch((err: any) => {
          alert(`❌ No se pudo enviar el email al cliente.\n\nDetalle: ${err?.text || err?.message || err}`);
        });
      }
      return updated;
    });
  };
  const addTask         = (t: AppTask) => setTasks(prev => [t, ...prev]);
  const toggleTask      = (id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const addAppointment  = (a: Appointment) => setAppointments(prev => [a, ...prev]);
  const logout = () => { sessionStorage.removeItem("cwb_session"); setSession(null); };

  useEffect(() => {
    localStorage.setItem("cwb_appointments", JSON.stringify(appointments));
    if (fbReady.current) saveShopData({ appointments });
  }, [appointments]);

  const titles: Record<string, string> = { dash: "Mi equipo", servicios: "Servicios", lunch: "Almuerzo / No molestar", turno: "Fichajes y turnos", perfil: "Perfil del equipo", tareas: "Tareas y proyectos", cal: "Calendario", ops: "1:1 y Onboarding" };
  const breadcrumbs: Record<string, string> = { dash: "HOY · " + _fmtDate(new Date()), servicios: "BICICLETAS · SERVICIO", lunch: "FEATURE · NO MOLESTAR", turno: "FICHAJES · HOY", perfil: "EQUIPO › PERFIL", tareas: "TAREAS · " + _fmtDate(new Date()), cal: "CALENDARIO · SEMANA ACTUAL", ops: "PLANTILLAS" };

  const trackParam = new URLSearchParams(window.location.search).get("track");
  if (trackParam) {
    try {
      const data = JSON.parse(decodeURIComponent(atob(trackParam)));
      return <CustomerTrackingView data={data} />;
    } catch {}
  }

  if (!session) return <LoginScreen onLogin={(s) => setSession(s)} loading={fbLoading} />;
  if (session.type === "employee") return (
    <>
      <EmployeeDashboard
        session={session} team={team} shift={shift} setShift={setShift}
        extendedData={extendedData}
        tasks={tasks} onToggleTask={toggleTask}
        appointments={appointments} onNewAppointment={() => setShowApptModal(true)}
        services={services} onNewService={() => { setServiceModalDate(undefined); setShowNewService(true); }}
        onAdvancePhase={advancePhase}
        onLogout={logout}
        setTasks={fn => setTasks(fn)}
        setAppointments={fn => setAppointments(fn)}
        onNewBikeService={date => { setServiceModalDate(date); setShowNewService(true); }}
        empLunch={empLunch}
        setEmpLunch={fn => setEmpLunch(fn)}
        onUpdateService={updateService}
      />
      {showApptModal && (
        <AppointmentModal team={team} initialDate={_fmtDate(new Date())}
          onClose={() => setShowApptModal(false)}
          onAdd={appt => { addAppointment(appt); setShowApptModal(false); }} />
      )}
      {showNewService && <NewServiceModal team={team} initialDate={serviceModalDate} onClose={() => { setShowNewService(false); setServiceModalDate(undefined); }} onAdd={addService} />}
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="app-layout">
        {/* Sidebar */}
        <nav className="nav">
          <div className="nav-brand"><Logo height={32} /></div>
          <div style={{ marginTop: 8 }}>
            {NAV.map(item => (
              <div key={item.id} className={"nav-item" + (section === item.id ? " active" : "")} onClick={() => setSection(item.id)}>
                <Icon d={I[item.icon]} size={15} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "auto", padding: "16px 0" }}>
            <div className="nav-section row between" style={{ paddingRight: 12 }}>
              <span>EQUIPO</span>
              <button className="action" style={{ fontSize: 11, padding: "1px 8px", lineHeight: 1.4 }} onClick={() => setShowModal(true)}>+ añadir</button>
            </div>
            {team.map(p => (
              <div key={p.id} className="nav-item" onClick={() => setSection("perfil")}>
                <Av p={p} size="xs" state={shift[p.id] ? (lunch && p.id === "s" ? "lunch" : "busy") : null} />
                <div className="stack" style={{ gap: 0 }}>
                  <span style={{ fontSize: 13 }}>{p.name}</span>
                  <span className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                    {!shift[p.id] ? "fuera" : lunch && p.id === "s" ? "almuerzo" : "en turno"}
                  </span>
                </div>
                <button onClick={e => { e.stopPropagation(); removeMember(p.id); }}
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 14, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
                  title="Eliminar miembro">×</button>
              </div>
            ))}
            <div style={{ borderTop: "1.4px dashed var(--line)", margin: "12px 0" }} />
            <div className="nav-item">
              <Av p={{ initials: "M" }} size="xs" />
              <div className="stack" style={{ gap: 0 }}>
                <span style={{ fontSize: 13 }}>Julieth</span>
                <span className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>jefa</span>
              </div>
            </div>
          </div>
        </nav>

        {/* Main */}
        <div className="main-content">
          {/* Banners */}
          {team.some(p => empLunch[p.id] && shift[p.id]) && (
            <div className="notif-banner">
              <Icon d={I.lunch} size={18} />
              <div>
                <div className="sk-title" style={{ fontSize: 15, color: "#fff" }}>
                  {team.filter(p => empLunch[p.id] && shift[p.id]).map(p => p.name).join(", ")} en almuerzo
                </div>
                <div className="sk-mono" style={{ fontSize: 11, opacity: .9 }}>marcaron inicio de almuerzo desde su dispositivo</div>
              </div>
            </div>
          )}
          {team.some(p => shift[p.id]) && !team.some(p => empLunch[p.id] && shift[p.id]) && (
            <div className="notif-banner in-banner">
              <Icon d={I.in} size={18} />
              <div className="sk-mono" style={{ fontSize: 12, color: "#fff" }}>
                {(() => { const names = team.filter(p => shift[p.id]).map(p => p.name); return names.join(" y ") + (names.length === 1 ? " está en turno" : " están en turno"); })()}
                {" · "}turno activo
              </div>
            </div>
          )}

          {/* AppBar */}
          <AppBar title={titles[section]} breadcrumb={breadcrumbs[section]}>
            {section === "dash" && <>
              <span className="chip"><span className="dot g" />{[shift.s, shift.c].filter(Boolean).length}/2 en turno</span>
              {lunch && shift.s && <span className="chip lunch"><span className="dot" style={{ background: "#fff" }} />1 almuerzo</span>}
              <button className="action ink" onClick={() => setShowAssignTask(true)}><Icon d={I.plus} size={14} /> Añadir tarea</button>
            </>}
            {section === "tareas" && (
              <span className="sk-mono text-xs muted">
                {tasks.filter(t => !t.done).length} pendientes · {tasks.filter(t => t.done).length} completadas
              </span>
            )}
            {section === "cal" && (
              <span className="sk-mono text-xs muted">
                {appointments.filter(a => a.date === _fmtDate(new Date())).length} servicios hoy
              </span>
            )}
          </AppBar>

          {/* Sub-tabs dashboard */}
          {section === "dash" && (
            <div className="section-tabs">
              {DASH_TABS.map(t => (
                <div key={t.id} className={"section-tab" + (dashTab === t.id ? " active" : "")} onClick={() => setDashTab(t.id)}>{t.label}</div>
              ))}
            </div>
          )}

          {/* Contenido */}
          <div className="content-area">
            <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
              {section === "servicios" && <ServiceSection services={services} onAdvancePhase={advancePhase} onNewService={() => { setServiceModalDate(undefined); setShowNewService(true); }} onUpdateService={updateService} onDeleteService={deleteService} team={team} />}
              {section === "dash" && dashTab === "lista" && <DashLista lunchState={lunch} shiftState={shift} team={team} onRemove={removeMember} />}
              {section === "dash" && dashTab === "kanban" && <DashKanban />}
              {section === "dash" && dashTab === "timeline" && <DashTimeline />}
              {section === "dash" && dashTab === "mapa" && <DashMapa lunchState={lunch} shiftState={shift} team={team} />}
              {section === "lunch" && <LunchSection lunchState={lunch} setLunchState={setLunch} shiftState={shift} team={team} />}
              {section === "turno" && <ShiftSection shiftState={shift} setShiftState={setShift} lunchState={lunch} team={team} />}
              {section === "perfil" && <ProfileSection team={team} extendedData={extendedData} onEditMember={updateMemberData} />}
              {section === "tareas" && <TasksSection tasks={tasks} team={team} onToggle={toggleTask} onAssign={() => setShowAssignTask(true)} />}
              {section === "cal" && <CalendarSection tasks={tasks} appointments={appointments} services={services} setTasks={fn => setTasks(fn)} setAppointments={fn => setAppointments(fn)} onNewBikeService={date => { setServiceModalDate(date); setShowNewService(true); }} team={team} onUpdateService={updateService} />}
              {section === "ops" && <OpsSection />}
            </div>
          </div>
        </div>
      </div>
      {/* Barra de navegación móvil */}
      <nav className="mobile-nav">
        {NAV.map(item => (
          <div key={item.id} className={"mobile-nav-item" + (section === item.id ? " active" : "")} onClick={() => setSection(item.id)}>
            <Icon d={I[item.icon]} size={20} />
            <span>{item.label.split(" ")[0]}</span>
          </div>
        ))}
      </nav>

      {showModal && <MemberModal onClose={() => setShowModal(false)} onAdd={addMember} />}
      {showNewService && <NewServiceModal team={team} initialDate={serviceModalDate} onClose={() => { setShowNewService(false); setServiceModalDate(undefined); }} onAdd={addService} />}
      {showAssignTask && <AssignTaskModal team={team} onAdd={addTask} onClose={() => setShowAssignTask(false)} />}
      {showApptModal && <AppointmentModal team={team} initialDate={_fmtDate(new Date())} onClose={() => setShowApptModal(false)} onAdd={appt => { addAppointment(appt); setShowApptModal(false); }} />}
    </>
  );
}
