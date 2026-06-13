import { useState, useEffect, useMemo, useRef } from "react";
import type { ShopData } from './firebase';

// ─── Configuración EmailJS (cámbiala desde la interfaz o aquí) ───────────────
const EMAILJS_SERVICE_ID          = "service_dzchw0a";
const EMAILJS_TEMPLATE_ID         = "2ux0vlp";
const EMAILJS_SERVICE_TEMPLATE_ID = "template_fcgenmc";
const EMAILJS_PUBLIC_KEY          = "UgKvCtUeZVka8ji8t";
const ADMIN_EMAIL                 = "capital.woman.bikes@gmail.com";

const loadShopDataOnce = async () => (await import("./firebase")).loadShopDataOnce();
const saveShopData = async (data: Partial<ShopData>) => (await import("./firebase")).saveShopData(data);
const sendEmail = async (
  serviceId: string,
  templateId: string,
  params: Record<string, unknown>,
  publicKey: string
) => {
  const emailjs = (await import("@emailjs/browser")).default;
  return emailjs.send(serviceId, templateId, params, publicKey);
};

// ─── Fases del servicio de bici ──────────────────────────────────────────────
const PHASES = [
  { id: 1, name: "Desarme",            icon: "🔧", color: "#e8a020", msg: "Tu bici está siendo desarmada para su revisión." },
  { id: 2, name: "Lavado",             icon: "💧", color: "#5cc8e8", msg: "Tu bici está siendo limpiada a fondo." },
  { id: 3, name: "Ensamble",           icon: "⚙️", color: "#9c4a9e", msg: "Tu bici está siendo ensamblada y ajustada." },
  { id: 4, name: "Lista para recoger", icon: "✅", color: "#4caf50", msg: "¡Tu bici está lista! Puedes pasar a recogerla." },
];

// Fases internas del taller según formato físico de ingreso
const WORKSHOP_PHASES = [
  { key: "diagnostico" as const, label: "Diagnóstico",   color: "#e8a020" },
  { key: "autorizada"  as const, label: "Autorizada ✅", color: "#4caf50" },
  { key: "desarme"     as const, label: "Desarme",        color: "#e8a020" },
  { key: "limpieza"    as const, label: "Limpieza",      color: "#5cc8e8" },
  { key: "inspeccion"  as const, label: "Inspección",    color: "#5cc8e8" },
  { key: "ensamble"    as const, label: "Ensamble",      color: "#9c4a9e" },
  { key: "detalle"     as const, label: "Detalle",       color: "#9c4a9e" },
  { key: "prueba"      as const, label: "Prueba",        color: "#6c1f6e" },
  { key: "terminada"   as const, label: "Listo entregar",color: "#4caf50" },
];

interface QuotedPart {
  id: string;
  sku?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice?: number;
  discountPercent?: number;
  installed?: boolean;
  installedAt?: string;
  installedBy?: string;
  loyverseItemId?: string;
  loyverseVariantId?: string;
}
type IntakeChecklistStatus = "ok" | "attention" | "missing" | "na";
interface IntakeChecklistItem {
  key: string;
  label: string;
  status: IntakeChecklistStatus;
  note?: string;
}
interface ProcessChecklistItem {
  key: string;
  label: string;
  done: boolean;
  note?: string;
  completedAt?: string;
  completedById?: string;
  completedByName?: string;
  updatedAt?: string;
}
interface DiagnosticUpdate {
  id: string; date: string;
  estado: string; hallazgos: string; problemas: string; recomendaciones: string;
  partes: string[];
  labor?: string;
}
interface ServiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice?: number;
  discountPercent?: number;
  type: "repuesto" | "mano_obra" | "servicio";
  sku?: string;
  loyverseItemId?: string;
  loyverseVariantId?: string;
}
interface ServiceBilling {
  parts: ServiceLineItem[];
  labor: ServiceLineItem[];
  subtotal: number;
  advance: number;
  total: number;
  balance: number;
  paymentStatus: "pendiente" | "pagado" | "adelanto";
  closedAt?: string;
  cashierId?: string;
  notes?: string;
  loyverseReceiptId?: string;
  loyverseSyncedAt?: string;
}
interface BikeService {
  id: string; clientName: string; clientEmail: string;
  bikeDescription: string; date: string; phase: number;
  createdAt: string; notes: string;
  clientPhone?: string;
  clientDocument?: string;
  loyverseCustomerId?: string;
  intakeCondition?: string;
  intakeAccessories?: string[];
  intakeReportedIssue?: string;
  intakeSignatureName?: string;
  intakeChecklist?: IntakeChecklistItem[];
  processChecklist?: ProcessChecklistItem[];
  processChecklistUpdatedAt?: string;
  workshopStatus?: "ingresada" | "diagnostico" | "desarme" | "limpieza" | "inspeccion" | "ensamble" | "detalle" | "prueba" | "autorizada" | "terminada" | "entregada";
  workshopStartDate?: string;
  pauseNotes?: string;
  quotedParts?: QuotedPart[];
  serviceType?: string;
  startTime?: string; endTime?: string; technicianId?: string;
  paymentStatus?: "pendiente" | "pagado" | "adelanto";
  paymentAmount?: number;
  deliveryStatus?: "en_taller" | "lista" | "entregada";
  deliverySignatureName?: string;
  deliverySignedAt?: string;
  deliveryAcceptanceText?: string;
  deliveredAt?: string;
  neededByDate?: string;
  completedAt?: string;
  diagnosticUpdates?: DiagnosticUpdate[];
  finalBilling?: ServiceBilling;
  excludedBillingItemIds?: string[];
  scheduledDate?: string;
  clientId?: string;
  bikeId?: string;
  updatedAt?: string;
}
interface ClientBike {
  id: string;
  description: string;
  brand?: string;
  serial?: string;
  notes?: string;
}
interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  document?: string;
  loyverseCustomerId?: string;
  bikes: ClientBike[];
  createdAt: string;
  notes?: string;
}
interface AppTask {
  id: string; title: string; assignedTo: string;
  tag: string; done: boolean; createdAt: string;
  description?: string;
  date?: string; hasTime?: boolean; startTime?: string; endTime?: string;
  dueDate?: string;
  priority?: "baja" | "media" | "alta";
  points?: number;
  evidence?: string;
  qualityStatus?: "pendiente" | "aprobado" | "correccion" | "no_aprobado";
  completedAt?: string;
}
interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  entryTime: string;
  exitTime?: string;
  hoursWorked: number;
  status: "abierto" | "cerrado_manual" | "cerrado_automatico";
  observations?: string;
  correctedBy?: string;
  correctedAt?: string;
  createdAt: string;
  updatedAt?: string;
}
interface LunchRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  startTime: string;
  endTime?: string;
  minutes: number;
  status: "abierto" | "cerrado";
  observations?: string;
  correctedBy?: string;
  correctedAt?: string;
  createdAt: string;
  updatedAt?: string;
}
type PayrollPeriod = "q1" | "q2";
interface PayrollConfirmation {
  id: string;
  employeeId: string;
  employeeName?: string;
  month: string;
  period: PayrollPeriod;
  fromDate: string;
  toDate: string;
  hours: number;
  lunchMinutes: number;
  hourlyRate: number;
  amount: number;
  status: "confirmada" | "requiere_revision";
  confirmedAt: string;
  confirmedBy?: string;
  updatedAt?: string;
  notes?: string;
}
interface Appointment {
  id: string; client: string; service: string; assignedTo: string;
  date: string; startTime: string; endTime: string; notes: string; createdAt: string;
}
interface MembershipUse {
  id: string; date: string; note: string; createdAt: string;
}
interface Membership {
  id: string;
  clientName: string;
  clientPhone: string;
  planName: string;
  price: number;
  startDate: string;
  endDate: string;
  includedUses: number;
  usedUses: number;
  notes: string;
  loyverseReceipt?: string;
  createdAt: string;
  uses: MembershipUse[];
}
interface Session {
  type: "admin" | "employee";
  id?: string; name?: string; role?: string;
}
type MessageArea = "grupo" | "caja" | "taller" | "redes";
type MessageTone = "directo" | "amable" | "seguimiento";
interface MessageBrief {
  source: string;
  action: string;
  detail: string;
  responsible?: string;
  urgency?: "hoy" | "manana" | "semana" | "normal";
}
type OrganizedMessages = Record<MessageArea, MessageBrief[]>;
interface AiTask { titulo: string; descripcion?: string; asignadoAId: string; area: MessageArea; urgencia: "hoy" | "manana" | "semana" | "normal"; }
type AiOrganizedMessages = Record<MessageArea, string> & { dudas: string[]; tareas: AiTask[] };

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
const _addDaysTo = (date: string, n: number): string => {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + n);
  return _fmtDate(d);
};
const AUTO_SHIFT_CLOSE_TIME = "17:00";
const AUTO_SHIFT_CLOSE_TRIGGER_TIME = "23:59";
const parseLocalDateTime = (date: string, time: string): Date => new Date(`${date}T${time}:00`);
const hoursBetween = (startIso: string, endIso?: string): number => {
  if (!endIso) return 0;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round((ms / 3600000) * 100) / 100);
};
const fmtHours = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
};
const minutesBetween = (startIso: string, endIso?: string): number => {
  if (!endIso) return 0;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round(ms / 60000));
};
const fmtMinutes = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
};
const taskDueDate = (task: AppTask): string => task.dueDate || task.date || "";
const taskPoints = (task: AppTask): number => Math.max(1, Number(task.points) || 1);
const taskPriority = (task: AppTask): "baja" | "media" | "alta" => task.priority || "media";
const taskQuality = (task: AppTask): "pendiente" | "aprobado" | "correccion" | "no_aprobado" => task.qualityStatus || "pendiente";
const isTaskOverdue = (task: AppTask, today = _fmtDate(new Date())): boolean => !task.done && !!taskDueDate(task) && taskDueDate(task) < today;
const taskStatusLabel = (task: AppTask, today = _fmtDate(new Date())) =>
  task.done ? "completada" : isTaskOverdue(task, today) ? "vencida" : "pendiente";
function productivityRows(team: any[], tasks: AppTask[], attendance: AttendanceRecord[], filters: { from: string; to: string; personId?: string }) {
  const inRange = (date?: string) => !!date && date >= filters.from && date <= filters.to;
  return team
    .filter(p => !filters.personId || p.id === filters.personId)
    .map(person => {
      const personTasks = tasks.filter(t => t.assignedTo === person.id && inRange(taskDueDate(t) || (t.createdAt || "").slice(0, 10)));
      const assignedPoints = personTasks.reduce((s, t) => s + taskPoints(t), 0);
      const completedTasks = personTasks.filter(t => t.done);
      const completedPoints = completedTasks.reduce((s, t) => s + taskPoints(t), 0);
      const overdueTasks = personTasks.filter(t => isTaskOverdue(t, filters.to));
      const onTimeTasks = completedTasks.filter(t => !taskDueDate(t) || (t.completedAt || t.date || t.createdAt || "").slice(0, 10) <= taskDueDate(t));
      const qualityReviewed = completedTasks.filter(t => taskQuality(t) !== "pendiente");
      const qualityGood = completedTasks.filter(t => taskQuality(t) === "aprobado");
      const hoursWorked = attendance.filter(a => a.employeeId === person.id && inRange(a.date)).reduce((s, a) => s + (Number(a.hoursWorked) || 0), 0);
      const compliance = assignedPoints ? (completedPoints / assignedPoints) * 100 : 0;
      const punctuality = completedTasks.length ? (onTimeTasks.length / completedTasks.length) * 100 : (personTasks.length ? 0 : 100);
      const quality = qualityReviewed.length ? (qualityGood.length / qualityReviewed.length) * 100 : (completedTasks.length ? 70 : 100);
      const productivityPerHour = hoursWorked > 0 ? completedPoints / hoursWorked : 0;
      const prodHourScore = Math.min(100, productivityPerHour * 25);
      const score = Math.round((compliance * 0.4) + (punctuality * 0.25) + (quality * 0.25) + (prodHourScore * 0.1));
      const generalStatus = score >= 85 ? "excelente" : score >= 70 ? "bueno" : score >= 50 ? "normal" : "bajo";
      return {
        person,
        hoursWorked,
        assigned: personTasks.length,
        completed: completedTasks.length,
        pending: personTasks.filter(t => !t.done && !isTaskOverdue(t, filters.to)).length,
        overdue: overdueTasks.length,
        compliance,
        punctuality,
        quality,
        productivityPerHour,
        completedPoints,
        assignedPoints,
        score,
        generalStatus,
      };
    });
}
const MONTH_NAMES_ES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
const DAY_NAMES_ES = ["DOMINGO", "LUNES", "MARTES", "MIERCOLES", "JUEVES", "VIERNES", "SABADO"];
const monthDates = (monthKey: string): string[] => {
  const [year, month] = monthKey.split("-").map(Number);
  const last = new Date(year, month, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`);
};
const chunkWeeks = <T,>(items: T[]): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += 7) chunks.push(items.slice(i, i + 7));
  return chunks;
};
const dateLabelEs = (date: string): string => {
  const d = parseLocalDateTime(date, "12:00");
  return `${d.getDate()} DE ${MONTH_NAMES_ES[d.getMonth()]}`;
};
const dayLabelEs = (date: string): string => DAY_NAMES_ES[parseLocalDateTime(date, "12:00").getDay()];
const payrollPeriodLabel = (period: PayrollPeriod) => period === "q1" ? "Corte 1" : "Corte 2";
const payrollPeriodRange = (monthKey: string, period: PayrollPeriod) => {
  const dates = monthDates(monthKey);
  const periodDates = dates.filter(d => period === "q1" ? Number(d.slice(8, 10)) <= 15 : Number(d.slice(8, 10)) > 15);
  return {
    fromDate: periodDates[0] || `${monthKey}-01`,
    toDate: periodDates[periodDates.length - 1] || `${monthKey}-01`,
  };
};
const payrollConfirmationId = (employeeId: string, month: string, period: PayrollPeriod) => `${employeeId}-${month}-${period}`;
const payrollConfirmationFor = (items: PayrollConfirmation[], employeeId: string, month: string, period: PayrollPeriod) =>
  items.find(c => c.id === payrollConfirmationId(employeeId, month, period) || (c.employeeId === employeeId && c.month === month && c.period === period));

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
const SERVICE_VALUE_BY_CODE = new Map(SERVICES_FLAT.map(item => [item.code, `${item.code} - ${item.name}`]));
const SERVICE_PREFILL_KEY = "cwb_new_service_prefill";

function normalizeLookup(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
}

function resolveServiceValue(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  const exactCode = SERVICE_VALUE_BY_CODE.get(raw.toUpperCase());
  if (exactCode) return exactCode;

  const query = normalizeLookup(raw);
  const match = SERVICES_FLAT.find(item => {
    const code = normalizeLookup(item.code);
    const name = normalizeLookup(item.name);
    const value = normalizeLookup(`${item.code} ${item.name}`);
    return code === query || code.startsWith(query) || name.includes(query) || value.includes(query);
  });

  return match ? `${match.code} - ${match.name}` : raw;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function splitMessageNotes(input: string): string[] {
  return input
    .replace(/\r/g, "")
    .split(/\n+|;|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ0-9])/)
    .map(line => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function areaForNote(note: string): MessageArea {
  const n = normalizeText(note);
  const has = (words: string[]) => words.some(word => n.includes(word));

  if (has(["instagram", "insta", "reel", "historia", "historias", "post", "foto", "video", "redes", "contenido", "publicar", "publicacion", "whatsapp estado"])) return "redes";
  if (has(["caja", "pago", "pagado", "abono", "adelanto", "transferencia", "efectivo", "factura", "recibo", "cobrar", "precio", "valor", "venta", "cliente debe", "deuda"])) return "caja";
  if (has(["taller", "mecanico", "mecanica", "bici", "bicicleta", "freno", "cadena", "cassette", "rin", "rueda", "llanta", "mantenimiento", "revision", "repuesto", "alistamiento", "lavado", "entrega", "recoger", "servicio", "diagnostico"])) return "taller";

  return "grupo";
}

function tonePrefix(area: MessageArea, tone: MessageTone): string {
  const names: Record<MessageArea, string> = { grupo: "Equipo", caja: "Caja", taller: "Taller", redes: "Redes" };
  if (tone === "directo") return `${names[area]}:`;
  if (tone === "seguimiento") return `${names[area]}, por favor revisar y confirmar:`;
  return `${names[area]}, porfa:`;
}

function detectResponsible(note: string): string | undefined {
  const words = note.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.replace(/[:,.]/g, "");
  // nombre propio al inicio (mayúscula + minúsculas) o todo mayúsculas corto
  if (first && (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(first) || /^[A-ZÁÉÍÓÚÑ]{2,8}$/.test(first))) return first;
  // "para X", "con X", "que X haga", etc.
  const match = note.match(/\b(?:para|con|que|avisar a|decirle a|pedirle a)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+)/i);
  return match?.[1];
}

function matchMemberByName(name: string | undefined, team: any[]): any | undefined {
  if (!name) return undefined;
  const n = normalizeText(name);
  return team.find(m => {
    const mn = normalizeText(m.name || "");
    const mr = normalizeText(m.role || "");
    return mn === n || mn.startsWith(n) || n.startsWith(mn) || mr.includes(n) || n.includes(mr);
  });
}

function autoAssignByArea(area: MessageArea, note: string, team: any[]): any | undefined {
  // 1. Nombre o rol explícito en la nota
  const explicit = matchMemberByName(detectResponsible(note), team);
  if (explicit) return explicit;
  // 2. Por área → buscar rol del equipo que encaje
  const roleKeywords: Record<MessageArea, string[]> = {
    taller:  ["mecanico", "tecnico", "taller", "servicio"],
    caja:    ["caja", "cajero", "cajera", "admin", "administrador", "administradora", "gerente", "director"],
    redes:   ["redes", "marketing", "community", "social", "publicidad", "contenido"],
    grupo:   [],
  };
  const keys = roleKeywords[area];
  return team.find(m => keys.some(k => normalizeText(m.role || "").includes(k)));
}

const areaTagMap: Record<MessageArea, string> = {
  taller: "TALLER", caja: "CAJA", redes: "REDES", grupo: "GENERAL",
};

function detectUrgency(note: string): MessageBrief["urgency"] {
  const n = normalizeText(note);
  if (n.includes("hoy") || n.includes("urgente") || n.includes("ya")) return "hoy";
  if (n.includes("manana") || n.includes("mañana")) return "manana";
  if (n.includes("semana") || n.includes("viernes") || n.includes("sabado") || n.includes("lunes")) return "semana";
  return "normal";
}

function cleanActionText(note: string, responsible?: string): string {
  let text = note.replace(/\s+/g, " ").trim();
  if (responsible) text = text.replace(new RegExp(`^${responsible}[,:]?\\s*`, "i"), "");
  return text.replace(/^(porfa|por favor|favor|hay que|toca|pendiente|recordar|revisar que)\s+/i, "").trim();
}

function verbForArea(area: MessageArea, note: string): string {
  const n = normalizeText(note);
  if (area === "caja") {
    if (n.includes("transferencia") || n.includes("abono") || n.includes("pago")) return "confirmar el pago";
    if (n.includes("factura") || n.includes("recibo")) return "dejar soporte de caja";
    if (n.includes("cobrar")) return "gestionar el cobro";
    return "revisar el movimiento de caja";
  }
  if (area === "taller") {
    if (n.includes("entrega") || n.includes("recoger") || n.includes("lista")) return "preparar la entrega";
    if (n.includes("repuesto") || n.includes("cadena") || n.includes("freno") || n.includes("cassette")) return "validar repuestos y avance";
    if (n.includes("diagnostico") || n.includes("revision")) return "hacer revisión y diagnóstico";
    return "revisar el trabajo de taller";
  }
  if (area === "redes") {
    if (n.includes("foto") || n.includes("video")) return "capturar material";
    if (n.includes("historia") || n.includes("reel") || n.includes("post")) return "armar contenido para publicar";
    return "preparar contenido de redes";
  }
  return "alinear al equipo";
}

function buildBrief(note: string): { area: MessageArea; brief: MessageBrief } {
  const area = areaForNote(note);
  const responsible = detectResponsible(note);
  const detail = cleanActionText(note, responsible);
  return {
    area,
    brief: {
      source: note,
      action: verbForArea(area, note),
      detail,
      responsible,
      urgency: detectUrgency(note),
    },
  };
}

function organizeMessage(input: string, tone: MessageTone): OrganizedMessages {
  const grouped: OrganizedMessages = { grupo: [], caja: [], taller: [], redes: [] };
  splitMessageNotes(input).forEach(note => {
    const { area, brief } = buildBrief(note);
    grouped[area].push(brief);
  });

  return grouped;
}

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function formatBriefLine(brief: MessageBrief, area: MessageArea): string {
  const urgency = brief.urgency === "hoy" ? " hoy" : brief.urgency === "manana" ? " mañana" : "";
  const owner = brief.responsible ? `${brief.responsible}: ` : "";
  const detail = sentenceCase(brief.detail).replace(/[.!?]+$/, "");
  if (area === "redes") return `${owner}${brief.action}${urgency}: ${detail}.`;
  if (area === "caja") return `${owner}${brief.action}${urgency}: ${detail}.`;
  if (area === "taller") return `${owner}${brief.action}${urgency}: ${detail}.`;
  return `${owner}${detail}.`;
}

function closingForArea(area: MessageArea, tone: MessageTone): string {
  if (tone === "directo") return "Confirmen cuando quede listo.";
  if (tone === "seguimiento") return "Me responden con avance, bloqueo o confirmacion cuando lo tengan.";
  if (area === "grupo") return "Gracias, así todos quedamos alineados.";
  return "Me confirman apenas quede hecho, porfa.";
}

function buildAreaMessage(area: MessageArea, items: MessageBrief[], tone: MessageTone): string {
  if (!items.length) return "";
  const lines = items.map(item => `- ${formatBriefLine(item, area)}`);
  if (items.length === 1) return `${tonePrefix(area, tone)} ${formatBriefLine(items[0], area)}\n${closingForArea(area, tone)}`;
  return `${tonePrefix(area, tone)}\n${lines.join("\n")}\n${closingForArea(area, tone)}`;
}

function buildTrackingUrl(service: BikeService): string {
  return `${window.location.origin}${window.location.pathname}?track=${service.id}`;
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

const money = (value: number | undefined) => `$${(value || 0).toLocaleString("es-CO")}`;
const formatDateTimeEs = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
};
const deliveryDateLabel = (s: Pick<BikeService, "deliveredAt" | "deliverySignedAt">) =>
  formatDateTimeEs(s.deliveredAt || s.deliverySignedAt);
const splitLines = (value: string) => value.split("\n").map(v => v.trim()).filter(Boolean);
const INTAKE_CHECKLIST_TEMPLATE: { key: string; label: string }[] = [
  { key: "marco", label: "Marco / pintura" },
  { key: "tenedor", label: "Tenedor / dirección" },
  { key: "ruedas", label: "Ruedas / rines" },
  { key: "llantas", label: "Llantas" },
  { key: "frenos", label: "Frenos" },
  { key: "cambios", label: "Cambios / mando" },
  { key: "transmision", label: "Transmisión" },
  { key: "sillin", label: "Sillín / poste" },
  { key: "pedales", label: "Pedales / bielas" },
  { key: "accesorios", label: "Accesorios" },
  { key: "limpieza", label: "Limpieza / estado general" },
];
const CHECKLIST_STATUS_LABELS: Record<IntakeChecklistStatus, string> = {
  ok: "OK",
  attention: "Revisar",
  missing: "Falta",
  na: "N/A",
};
function buildIntakeChecklist(existing?: IntakeChecklistItem[]): IntakeChecklistItem[] {
  const byKey = new Map((existing || []).map(item => [item.key, item]));
  return INTAKE_CHECKLIST_TEMPLATE.map(base => {
    const saved = byKey.get(base.key);
    return {
      key: base.key,
      label: saved?.label || base.label,
      status: saved?.status || "ok",
      note: saved?.note || "",
    };
  });
}
function normalizeIntakeChecklist(items?: IntakeChecklistItem[]): IntakeChecklistItem[] {
  return buildIntakeChecklist(items).map(item => ({
    key: item.key,
    label: item.label,
    status: item.status,
    note: item.note?.trim() || undefined,
  }));
}
function intakeChecklistSummary(items?: IntakeChecklistItem[]): string {
  const list = normalizeIntakeChecklist(items);
  const flagged = list.filter(item => item.status !== "ok" || item.note);
  if (!flagged.length) return "Todo marcado OK";
  return flagged.map(item => `${item.label}: ${CHECKLIST_STATUS_LABELS[item.status]}${item.note ? ` (${item.note})` : ""}`).join(" · ");
}
const PROCESS_CHECKLIST_GROUPS: { title: string; items: { key: string; label: string }[] }[] = [
  {
    title: "Ingreso y revisión",
    items: [
      { key: "revision_inicial", label: "Revisión inicial completa" },
      { key: "fotos_ingreso", label: "Fotos de ingreso guardadas" },
      { key: "video_falla", label: "Video de falla / estado inicial" },
      { key: "diagnostico_cliente", label: "Diagnóstico comunicado al cliente" },
    ],
  },
  {
    title: "Desarme",
    items: [
      { key: "desarme", label: "Desarme realizado" },
      { key: "evidencia_desarme", label: "Fotos/video de desarme" },
      { key: "repuestos_confirmados", label: "Repuestos confirmados" },
    ],
  },
  {
    title: "Trabajo técnico",
    items: [
      { key: "limpieza", label: "Limpieza realizada" },
      { key: "inspeccion", label: "Inspección de componentes" },
      { key: "ensamble", label: "Ensamble y torque" },
      { key: "ajustes", label: "Ajustes finales" },
    ],
  },
  {
    title: "Cierre",
    items: [
      { key: "prueba", label: "Prueba de funcionamiento" },
      { key: "chequeo_aire", label: "Chequeo de aire realizado" },
      { key: "torque_bielas", label: "Torque de bielas verificado" },
      { key: "torque_potencia", label: "Torque de potencia verificado" },
      { key: "ajuste_tuercas", label: "Ajuste general de tuercas" },
      { key: "revision_general_bici", label: "Revisión general de la bici" },
      { key: "video_final", label: "Video/fotos finales" },
      { key: "facturacion", label: "Trabajo listo para factura" },
      { key: "entrega", label: "Entrega confirmada" },
    ],
  },
];
const DELIVERY_SAFETY_CHECK_KEYS = ["prueba", "chequeo_aire", "torque_bielas", "torque_potencia", "ajuste_tuercas", "revision_general_bici"];
const DELIVERY_ACCEPTANCE_TEXT = "Declaro que recibo la bicicleta en buen estado, con revisión final realizada, y acepto la entrega conforme.";
const REVIEW_CHECKLIST_KEYS = ["revision_inicial", "fotos_ingreso", "video_falla", "diagnostico_cliente"];
function buildProcessChecklist(existing?: ProcessChecklistItem[]): ProcessChecklistItem[] {
  const byKey = new Map((existing || []).map(item => [item.key, item]));
  return PROCESS_CHECKLIST_GROUPS.flatMap(group => group.items.map(base => {
    const saved = byKey.get(base.key);
    return {
      key: base.key,
      label: saved?.label || base.label,
      done: !!saved?.done,
      note: saved?.note || "",
      completedAt: saved?.completedAt,
      completedById: saved?.completedById,
      completedByName: saved?.completedByName,
      updatedAt: saved?.updatedAt,
    };
  }));
}
function normalizeProcessChecklist(items?: ProcessChecklistItem[]): ProcessChecklistItem[] {
  return buildProcessChecklist(items).map(item => ({
    key: item.key,
    label: item.label,
    done: !!item.done,
    note: item.note || undefined,
    completedAt: item.done ? item.completedAt : undefined,
    completedById: item.done ? item.completedById : undefined,
    completedByName: item.done ? item.completedByName : undefined,
    updatedAt: item.updatedAt,
  }));
}
function processChecklistProgress(items?: ProcessChecklistItem[]): { done: number; total: number; label: string } {
  const list = normalizeProcessChecklist(items);
  const done = list.filter(item => item.done).length;
  return { done, total: list.length, label: `${done}/${list.length}` };
}
function missingReadyChecklistItems(service: BikeService): ProcessChecklistItem[] {
  return buildProcessChecklist(service.processChecklist).filter(item => item.key !== "entrega" && !item.done);
}
function readyChecklistError(service: BikeService): string {
  const missing = missingReadyChecklistItems(service);
  if (!missing.length) return "";
  return `Antes de marcar como lista para recoger completa el checklist de proceso:\n\n${missing.map(item => `• ${item.label}`).join("\n")}`;
}
const serviceStatusLabel = (s: BikeService) => {
  if (s.deliveryStatus === "entregada" || s.workshopStatus === "entregada") return "🏠 Entregada";
  if (s.phase >= 4 || s.workshopStatus === "terminada") return "✅ Lista para recoger";
  const wsLabels: Record<string, string> = {
    prueba: "🚲 En prueba",
    detalle: "✨ Detalle final",
    ensamble: "⚙️ Ensamble",
    inspeccion: "🔍 Inspección",
    limpieza: "💧 Limpieza",
    desarme: "🔧 Desarme",
    autorizada: "✅ Autorizada",
    diagnostico: "🔬 Diagnóstico",
  };
  if (s.workshopStatus && wsLabels[s.workshopStatus]) return wsLabels[s.workshopStatus];
  if (s.phase > 0) return "En proceso";
  if ((s.diagnosticUpdates || []).length > 0) return "🔬 Diagnóstico";
  return "📋 Ingresada";
};
const blankBilling = (paymentStatus: ServiceBilling["paymentStatus"] = "pendiente", advance = 0): ServiceBilling => ({
  parts: [],
  labor: [],
  subtotal: 0,
  advance,
  total: 0,
  balance: 0,
  paymentStatus,
  notes: "",
});
const clampDiscount = (value: number | undefined) => Math.min(100, Math.max(0, Number(value) || 0));
const discountedUnitPrice = (item: Pick<ServiceLineItem, "unitPrice" | "originalUnitPrice" | "discountPercent">) => {
  const base = Number(item.originalUnitPrice ?? item.unitPrice) || 0;
  const discount = clampDiscount(item.discountPercent);
  return Math.max(0, Math.round(base * (1 - discount / 100)));
};
const calcBilling = (billing: ServiceBilling): ServiceBilling => {
  const normalizeItem = (i: ServiceLineItem): ServiceLineItem => {
    const discountPercent = clampDiscount(i.discountPercent);
    const originalUnitPrice = Number(i.originalUnitPrice ?? i.unitPrice) || 0;
    return {
      ...i,
      quantity: Number(i.quantity) || 0,
      originalUnitPrice: discountPercent > 0 ? originalUnitPrice : undefined,
      discountPercent: discountPercent > 0 ? discountPercent : undefined,
      unitPrice: discountPercent > 0 ? discountedUnitPrice({ ...i, originalUnitPrice, discountPercent }) : originalUnitPrice,
    };
  };
  const parts = billing.parts.map(normalizeItem);
  const labor = billing.labor.map(normalizeItem);
  const subtotal = [...parts, ...labor].reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const advance = Number(billing.advance) || 0;
  return { ...billing, parts, labor, subtotal, total: subtotal, advance, balance: Math.max(0, subtotal - advance) };
};
const billingFromService = (s: BikeService): ServiceBilling => calcBilling(s.finalBilling || blankBilling(s.paymentStatus || "pendiente", s.paymentAmount || 0));
function quotedPartToLineItem(part: QuotedPart): ServiceLineItem {
  return {
    id: `quoted-${part.id}`,
    description: part.description,
    quantity: part.quantity,
    unitPrice: part.unitPrice,
    originalUnitPrice: part.originalUnitPrice,
    discountPercent: part.discountPercent,
    type: "repuesto",
    sku: part.sku,
    loyverseItemId: part.loyverseItemId,
    loyverseVariantId: part.loyverseVariantId,
  };
}
function serviceCatalogLine(serviceType: string | undefined, discountPercent = 0): ServiceLineItem | null {
  const resolved = resolveServiceValue(serviceType || "");
  if (!resolved) return null;
  const code = resolved.split(" - ")[0]?.trim().toUpperCase();
  const catalog = SERVICES_FLAT.find(item => item.code.toUpperCase() === code);
  if (!catalog || catalog.price <= 0) return null;
  const discount = clampDiscount(discountPercent);
  return {
    id: `service-${catalog.code}`,
    description: `${catalog.code} - ${catalog.name}`,
    quantity: 1,
    originalUnitPrice: discount ? catalog.price : undefined,
    discountPercent: discount || undefined,
    unitPrice: discount ? discountedUnitPrice({ unitPrice: catalog.price, originalUnitPrice: catalog.price, discountPercent: discount }) : catalog.price,
    type: "servicio",
  };
}
async function serviceCatalogLineWithLoyverse(serviceType: string | undefined, discountPercent = 0, token = ""): Promise<ServiceLineItem | null> {
  const localLine = serviceCatalogLine(serviceType, discountPercent);
  if (!localLine || !token) return localLine;
  const code = localLine.id.replace(/^service-/, "");
  const result = await lookupLoyverseSKU(code, token).catch(error => {
    console.warn("[Loyverse] No se pudo vincular el servicio del catalogo:", loyverseErrorMessage(error));
    return null;
  });
  if (!result) return localLine;
  const discount = clampDiscount(discountPercent);
  const basePrice = Number(result.price) || localLine.unitPrice || 0;
  return {
    ...localLine,
    description: `${code} - ${result.name}`,
    sku: code,
    originalUnitPrice: discount ? basePrice : undefined,
    discountPercent: discount || undefined,
    unitPrice: discount ? discountedUnitPrice({ unitPrice: basePrice, originalUnitPrice: basePrice, discountPercent: discount }) : basePrice,
    loyverseItemId: result.itemId,
    loyverseVariantId: result.variantId,
  };
}
function billingWithServiceLine(s: BikeService): ServiceBilling {
  const current = billingFromService(s);
  const serviceLine = serviceCatalogLine(s.serviceType);
  const excludedIds = new Set(s.excludedBillingItemIds || []);
  const quotedLines = (s.quotedParts || [])
    .filter(part => part.installed)
    .map(quotedPartToLineItem)
    .filter(line => !excludedIds.has(line.id));
  const currentWithQuoted = quotedLines.reduce((billing, quoted) => {
    const exists = billing.parts.some(item => item.id === quoted.id || (quoted.sku && item.sku === quoted.sku) || item.description.toLowerCase() === quoted.description.toLowerCase());
    return exists ? billing : calcBilling({ ...billing, parts: [...billing.parts, quoted] });
  }, current);
  if (!serviceLine || excludedIds.has(serviceLine.id)) return currentWithQuoted;
  const hasService = currentWithQuoted.labor.some(item =>
    item.type === "servicio" &&
    (item.id === serviceLine.id || item.description.toLowerCase().includes(serviceLine.description.toLowerCase()) || item.description.toLowerCase().includes(serviceLine.id.replace("service-", "").toLowerCase()))
  );
  return hasService ? currentWithQuoted : calcBilling({ ...currentWithQuoted, labor: [serviceLine, ...currentWithQuoted.labor] });
}
function ticketSummary(service: BikeService | any): { serviceTotal: number; productsTotal: number; subtotal: number; advance: number; balance: number; billing: ServiceBilling } {
  const billing = "clientName" in service ? billingWithServiceLine(service as BikeService) : calcBilling(service.finalBilling || blankBilling(service.paymentStatus || "pendiente", service.paymentAmount || 0));
  const serviceTotal = billing.labor.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const productsTotal = billing.parts.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return { serviceTotal, productsTotal, subtotal: billing.total, advance: billing.advance, balance: billing.balance, billing };
}
const hasFinalBilling = (s: BikeService) => {
  const billing = billingWithServiceLine(s);
  const hasItems = [...billing.parts, ...billing.labor].some(i => i.description.trim() && i.quantity > 0 && i.unitPrice >= 0);
  return hasItems && billing.total >= 0 && !!billing.paymentStatus;
};
const isWorkshopResponsible = (member: any) => {
  const role = normalizeText(member?.role || "");
  return ["mecanico", "tecnico", "taller", "responsable de taller", "servicio"].some(key => role.includes(key));
};
const workshopResponsibles = (team: any[]) => team.filter(isWorkshopResponsible);

// ─── Loyverse API helpers ────────────────────────────────────────────────────
type LoyverseLookupResult = { name: string; price: number; itemId: string; variantId?: string };

class LoyverseApiError extends Error {
  status?: number;
  detail?: unknown;
  constructor(message: string, status?: number, detail?: unknown) {
    super(message);
    this.name = "LoyverseApiError";
    this.status = status;
    this.detail = detail;
  }
}

function normalizeLoyverseToken(token: string): string {
  return String(token || "").trim().replace(/^Bearer\s+/i, "").trim();
}

function loyverseErrorMessage(error: any): string {
  if (error instanceof LoyverseApiError) return error.message;
  return error?.message || "No se pudo conectar con Loyverse.";
}

function formatLoyverseError(data: any, status: number, fallbackText = ""): string {
  const parts: string[] = [];
  if (typeof data?.message === "string") parts.push(data.message);
  if (typeof data?.error === "string") parts.push(data.error);
  if (typeof data?.detail === "string") parts.push(data.detail);
  if (Array.isArray(data?.errors)) {
    parts.push(
      data.errors
        .map((e: any) => e?.detail || e?.message || e?.code || JSON.stringify(e))
        .filter(Boolean)
        .join("; ")
    );
  }
  const cleanFallback = String(fallbackText || "").trim();
  if (!parts.length && cleanFallback && !cleanFallback.startsWith("<")) parts.push(cleanFallback.slice(0, 240));
  const prefix = status === 401 || status === 403 ? "Token de Loyverse rechazado" : `Loyverse HTTP ${status}`;
  return parts.filter(Boolean).length ? `${prefix}: ${parts.filter(Boolean).join(" - ")}` : `${prefix}: respuesta no valida.`;
}

async function fetchLoyverseJson(path: string, token: string, init: RequestInit = {}): Promise<any> {
  const cleanToken = normalizeLoyverseToken(token);
  if (!cleanToken) throw new LoyverseApiError("Token de Loyverse no configurado.");

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${cleanToken}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const res = await fetch(path, { ...init, headers });
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  const trimmed = text.trim();
  let data: any = null;

  if (trimmed) {
    const looksJson = contentType.includes("application/json") || /^[\[{]/.test(trimmed);
    if (!looksJson) {
      throw new LoyverseApiError(
        "El proxy /api/loyverse no devolvio JSON. En desarrollo local revisa el proxy de Vite o usa Firebase Hosting.",
        res.status,
        trimmed.slice(0, 300)
      );
    }
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new LoyverseApiError(`Respuesta JSON invalida de Loyverse (HTTP ${res.status}).`, res.status, trimmed.slice(0, 300));
    }
  }

  if (!res.ok) throw new LoyverseApiError(formatLoyverseError(data, res.status, text), res.status, data || text);
  return data ?? {};
}

async function testLoyverseConnection(token: string): Promise<{ success: true; count: number } | { success: false; error: string }> {
  try {
    const data = await fetchLoyverseJson("/api/loyverse/items?limit=1", token);
    return { success: true, count: Array.isArray(data.items) ? data.items.length : 0 };
  } catch (error: any) {
    return { success: false, error: loyverseErrorMessage(error) };
  }
}

async function lookupLoyverseSKU(sku: string, token: string): Promise<LoyverseLookupResult | null> {
  const normalized = sku.trim().toLowerCase();
  const matchesCode = (value: unknown) => {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return false;
    if (text === normalized) return true;
    if (!text.startsWith(normalized)) return false;
    const next = text.charAt(normalized.length);
    return !next || /[\s\-_./|:]/.test(next);
  };

  const findInItems = (items: any[]) => {
    for (const item of items) {
      // REF a nivel de item (reference_id, reference, handle)
      if ([item.reference_id, item.reference, item.handle, item.sku, item.item_name, item.name].some(matchesCode)) {
        const variant = (item.variants || [])[0];
        return {
          name: item.item_name || item.name || "",
          price: Number(variant?.default_price ?? variant?.price ?? 0) || 0,
          itemId: item.id,
          variantId: variant?.variant_id || variant?.id,
        };
      }
      // REF / SKU / barcode a nivel de variante
      const variant = (item.variants || []).find((v: any) =>
        [v.reference_id, v.sku, v.barcode, v.variant_id, v.id, v.name, v.option1_value, v.option2_value, v.option3_value].some(matchesCode)
      );
      if (variant) {
        return {
          name: item.item_name || item.name || variant.name || "",
          price: Number(variant.default_price ?? variant.price ?? 0) || 0,
          itemId: item.id,
          variantId: variant.variant_id || variant.id,
        };
      }
    }
    return null;
  };

  let cursor: string | undefined;
  let firstItemLogged = false;
  do {
      const url = `/api/loyverse/items?limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const data = await fetchLoyverseJson(url, token);
      const items: any[] = data.items || [];
      // Log del primer item para diagnóstico de campos
      if (!firstItemLogged && items.length > 0) {
        firstItemLogged = true;
        const sample = items[0];
      console.log("[Loyverse] Buscando REF:", sku, "| Campos del primer item:", Object.keys(sample));
      }
      const match = findInItems(items);
      if (match) return match;
      cursor = data.cursor || data.next_cursor || data.nextCursor || undefined;
  } while (cursor);
  return null;
}

function normalizeDocument(value: string): string {
  return value.replace(/\D/g, "");
}

async function lookupLoyverseCustomerByDocument(document: string, token: string): Promise<{ id: string; name: string; email?: string; phone?: string; document?: string; note?: string } | null> {
  const normalized = normalizeDocument(document);
  if (!normalized) return null;

  const matchesCustomer = (customer: any) => {
    const fields = [
      customer.customer_code,
      customer.phone_number,
      customer.note,
      customer.email,
      customer.name,
    ].map(value => normalizeDocument(String(value || "")));
    return fields.some(value => value === normalized || value.includes(normalized));
  };
  const mapCustomer = (customer: any) => ({
    id: customer.id,
    name: customer.name || "",
    email: customer.email || "",
    phone: customer.phone_number || "",
    document: customer.customer_code || normalized,
    note: customer.note || "",
  });

  const directUrl = `/api/loyverse/customers?limit=250&customer_code=${encodeURIComponent(document.trim())}`;
  try {
    const directData = await fetchLoyverseJson(directUrl, token);
    const directMatch = (directData.customers || []).find(matchesCustomer);
    if (directMatch) return mapCustomer(directMatch);
  } catch (error: any) {
    if (error?.status === 401 || error?.status === 403) throw error;
    console.warn("[Loyverse Customers] Busqueda directa no disponible, se intenta listado general:", loyverseErrorMessage(error));
  }

  let cursor: string | undefined;
  do {
    const url = `/api/loyverse/customers?limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const data = await fetchLoyverseJson(url, token);
    const customers: any[] = data.customers || [];
    const match = customers.find(matchesCustomer);
    if (match) return mapCustomer(match);
    cursor = data.cursor || data.next_cursor || data.nextCursor || undefined;
  } while (cursor);
  return null;
}

async function sendBillingToLoyverse(
  billing: ServiceBilling,
  service: BikeService,
  token: string
): Promise<{ success: true; receiptId: string; receiptNumber?: string } | { success: false; error: string }> {
  try {
    const allItems = [...billing.parts, ...billing.labor];
    const missingVariant = allItems.filter(i => i.loyverseItemId && !i.loyverseVariantId);
    if (missingVariant.length > 0) {
      return { success: false, error: "Hay items antiguos vinculados a Loyverse sin variante. Vuelve a buscarlos por codigo antes de enviar." };
    }
    const lineItems = allItems
      .filter(i => i.loyverseVariantId && i.description.trim() && i.quantity > 0)
      .map(i => ({
        variant_id: i.loyverseVariantId,
        quantity: Number(i.quantity) || 1,
        price: Number(i.unitPrice) || 0,
        line_note: [i.sku ? `SKU ${i.sku}` : "", i.description].filter(Boolean).join(" - ").slice(0, 255),
      }));
    if (lineItems.length === 0) return { success: false, error: "No hay items con codigo y variante Loyverse para enviar." };
    const serviceLine = serviceCatalogLine(service.serviceType);
    if (serviceLine && !lineItems.length) {
      return { success: false, error: "El mantenimiento quedó en la cuenta local, pero para enviarlo a Loyverse necesita estar asociado a un código/item de Loyverse." };
    }
    const body = {
      receipt_date: new Date().toISOString(),
      source: "Capital Wo-Man Bikes",
      note: `Taller · ${service.clientName} · ${service.bikeDescription}`,
      ...(service.loyverseCustomerId ? { customer_id: service.loyverseCustomerId } : {}),
      line_items: lineItems,
      payments: [],
    };
    const responseData = await fetchLoyverseJson("/api/loyverse/receipts", token, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { success: true, receiptId: responseData.id || responseData.receipt_number, receiptNumber: responseData.receipt_number };
  } catch (e: any) {
    return { success: false, error: loyverseErrorMessage(e) };
  }
}

// ─── Colores de marca Capital Wo-Man Bikes ───────────────────────────────────
// Morado: #6c1f6e  |  Cyan: #5cc8e8

const LOGO_SRC = "/logos/negativo.png";
const LOGO_DARK_BG_SRC = "/logos/principal-1.png";
const LOGO_START_SRC = "/logos/inicio-w.svg";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&family=Caveat:wght@400;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
  :root {
    --ink: #1c1720;
    --ink-2: #3a3140;
    --ink-3: #74677a;
    --paper: #fffbff;
    --paper-2: #f7f0f8;
    --line: #321d33;
    --capital-purple: #6c1f6e;
    --capital-purple-dark: #431046;
    --capital-purple-soft: #f4e5f3;
    --capital-cyan: #5cc8e8;
    --capital-cyan-soft: #e8f8fc;
    --capital-amber: #e8a020;
    --capital-amber-soft: #fff4d8;
    --capital-green: #3a8a3a;
    --capital-green-soft: #eaf6ea;
    --capital-red: #c0392b;
    --capital-red-soft: #fdebea;
    --accent: var(--capital-purple);
    --accent-soft: var(--capital-purple-soft);
    --accent-2: var(--capital-cyan);
    --accent-2-soft: var(--capital-cyan-soft);
    --lunch: var(--capital-cyan);
    --lunch-soft: var(--capital-cyan-soft);
    --done: var(--capital-green);
    --mono: "JetBrains Mono", ui-monospace, monospace;
    --hand: "Kalam", cursive;
    --title: "Caveat", cursive;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  html,body,#root{width:100%;min-width:0;background:#f7f0f8;}
  body{background:#f7f0f8;color:var(--ink);font-family:var(--hand);}
  input,textarea,select{
    color:var(--ink);
    background-color:var(--paper);
    -webkit-text-fill-color:currentColor;
    caret-color:currentColor;
    opacity:1;
  }
  input::placeholder,textarea::placeholder{
    color:var(--ink-3);
    -webkit-text-fill-color:var(--ink-3);
    opacity:.85;
  }
  input:disabled,textarea:disabled,select:disabled{
    -webkit-text-fill-color:currentColor;
    opacity:.65;
  }

  .sk-box{border:1.6px solid rgba(50,29,51,.88);border-radius:14px 10px 12px 11px/11px 13px 10px 12px;background:var(--paper);position:relative;box-shadow:0 8px 20px rgba(67,16,70,.045);}
  .sk-box.tight{border-radius:8px 6px 7px 6px/6px 8px 6px 7px;}
  .sk-box.dashed{border-style:dashed;}
  .sk-box.fill{background:var(--paper-2);}
  .sk-box.ink{background:var(--ink);color:var(--paper);border-color:var(--ink);}
  .sk-box.accent{background:var(--accent);color:#fff;border-color:var(--ink);}
  .sk-hr{height:0;border:0;border-top:1.4px solid var(--line);margin:10px 0;}
  .sk-hr.dashed{border-top-style:dashed;}
  .sk-hr.wavy{border:0;height:8px;background-image:radial-gradient(circle at 4px 4px,transparent 2px,var(--line) 2.2px,transparent 2.6px);background-size:10px 8px;opacity:.7;}

  .chip{display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border:1.3px solid rgba(50,29,51,.75);border-radius:999px;font-size:12px;font-family:var(--mono);background:var(--paper);white-space:nowrap;}
  .chip.ink{background:var(--ink);color:var(--paper);border-color:var(--ink);}
  .chip.accent{background:var(--capital-purple);color:#fff;border-color:var(--capital-purple-dark);}
  .chip.lunch{background:var(--capital-cyan);color:#072d38;border-color:#2797b6;}
  .chip.dash{border-style:dashed;}
  .chip.done-chip{background:var(--capital-green);color:#fff;border-color:var(--capital-green);}

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
  .avatar.lunch{border-color:var(--capital-cyan);background:var(--capital-cyan-soft);box-shadow:0 0 0 4px rgba(92,200,232,.18);}
  .avatar.busy{border-color:var(--capital-purple);background:var(--capital-purple-soft);box-shadow:0 0 0 4px rgba(108,31,110,.12);}

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

  .nav{width:210px;min-width:210px;background:linear-gradient(180deg,#fffaff 0%,#f4e5f3 100%);border-right:1.4px solid rgba(108,31,110,.45);display:flex;flex-direction:column;transition:width .18s ease,min-width .18s ease;min-height:0;overflow:hidden;}
  .nav.collapsed{width:64px;min-width:64px;}
  .nav-brand{padding:16px 18px;border-bottom:1.4px dashed rgba(108,31,110,.45);display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(108,31,110,.06);}
  .nav-brand img{width:100%;max-width:160px;display:block;}
  .nav.collapsed .nav-brand{padding:14px 10px;justify-content:center;flex-direction:column;}
  .nav.collapsed .nav-brand img{max-width:38px;}
  .nav-item{display:flex;align-items:center;gap:10px;padding:9px 18px;font-size:13px;cursor:pointer;border-left:3px solid transparent;transition:all .15s;white-space:nowrap;}
  .nav-item:hover{background:rgba(108,31,110,.08);}
  .nav-item.active{border-left-color:var(--capital-purple);background:#fff;color:var(--capital-purple-dark);box-shadow:inset 4px 0 0 var(--capital-purple);}
  .nav-section{font-family:var(--mono);font-size:10px;letter-spacing:.8px;color:var(--ink-3);padding:14px 18px 4px;text-transform:uppercase;}
  .nav.collapsed .nav-item{justify-content:center;padding:10px 0;gap:0;}
  .nav.collapsed .nav-label,.nav.collapsed .nav-section,.nav.collapsed .nav-member-meta,.nav.collapsed .nav-logout-text,.nav.collapsed .nav-remove{display:none!important;}
  .nav.collapsed .nav-bottom{padding:10px 0!important;}
  .nav.collapsed .nav-admin-card{justify-content:center;}
  .nav-toggle{width:28px;height:28px;border:1.3px solid var(--line);border-radius:999px;background:var(--paper);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--ink);font-family:var(--mono);font-size:13px;flex-shrink:0;}
  .nav-toggle:hover{background:var(--accent-soft);}
  .nav-scroll{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding-bottom:14px;-webkit-overflow-scrolling:touch;}
  .nav-scroll::-webkit-scrollbar{width:4px;}
  .nav-scroll::-webkit-scrollbar-thumb{background:rgba(108,31,110,.28);border-radius:999px;}

  .app-layout{display:flex;height:100vh;overflow:hidden;background:var(--paper);}
  .main-content{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;background:var(--paper);}
  .content-area{flex:1;overflow-y:auto;background:var(--paper);}
  .mobile-only{display:none;}

  .app-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 18px;border-bottom:1.4px solid rgba(108,31,110,.32);background:linear-gradient(90deg,#fffaff 0%,#f4e5f3 58%,#e8f8fc 100%);flex-shrink:0;gap:14px;position:relative;}
  .app-bar::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:3px;background:linear-gradient(90deg,var(--capital-purple),var(--capital-cyan),var(--capital-amber));}
  .app-bar-left{display:flex;align-items:center;gap:12px;min-width:0;flex:1;}
  .app-bar-divider{width:1px;height:30px;background:var(--line);opacity:.4;flex-shrink:0;}

  .section-tabs{display:flex;border-bottom:1.4px solid rgba(108,31,110,.28);background:var(--paper-2);flex-shrink:0;overflow-x:auto;}
  .section-tab{padding:9px 16px;font-family:var(--mono);font-size:11px;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;border-right:1.2px solid var(--line);border-bottom:2px solid transparent;transition:all .15s;white-space:nowrap;}
  .section-tab:hover{background:rgba(0,0,0,.04);}
  .section-tab.active{border-bottom-color:var(--capital-purple);background:var(--paper);color:var(--capital-purple-dark);}

  .list-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1.2px dashed var(--line);}
  .list-row:last-child{border-bottom:none;}
  .task-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1.2px dashed var(--line);transition:background .12s;}
  .task-item:hover{background:var(--paper-2);}
  .kcard{padding:12px;border-radius:8px 6px 7px 6px/6px 8px 6px 7px;background:var(--paper);border:1.4px solid var(--line);transition:transform .15s;cursor:default;}
  .kcard:hover{transform:translateY(-1px);}
  .tblock{position:absolute;top:6px;bottom:6px;border:1.4px solid var(--line);border-radius:6px 4px 7px 5px/5px 7px 4px 6px;padding:3px 8px;font-family:var(--mono);font-size:11px;display:flex;align-items:center;overflow:hidden;white-space:nowrap;}
  .calendar-week{background:var(--paper);}
  .cal-day{flex:1;border-right:1.2px dashed var(--line);padding:8px;min-width:0;background:var(--paper);position:relative;}
  .cal-day:last-child{border-right:none;}
  .cal-event{padding:4px 6px;font-size:11px;border:1.3px solid var(--line);border-radius:6px 4px 7px 5px/5px 7px 4px 6px;margin-bottom:6px;background:var(--paper);}
  .cal-hour-row{display:grid;grid-template-columns:42px minmax(0,1fr);gap:6px;min-height:36px;border-top:1px dotted rgba(42,38,31,.35);padding:4px 0;}
  .cal-hour-label{font-family:var(--mono);font-size:9px;color:var(--ink-3);padding-top:3px;text-align:right;white-space:nowrap;}
  .cal-hour-lane{min-width:0;}
  .cal-hour-empty{height:22px;opacity:.35;}
  .cal-untimed{border:1px dashed var(--line);background:var(--paper-2);border-radius:7px;padding:5px;margin:5px 0 8px;}
  .lunch-bar{height:8px;background:var(--paper-2);border:1.3px solid var(--line);border-radius:4px;position:relative;overflow:hidden;margin-top:4px;}
  .lunch-bar-fill{position:absolute;left:0;top:0;bottom:0;background:var(--lunch);border-radius:3px;transition:width 1s linear;}
  .prog-bar{height:8px;background:var(--paper-2);border:1.3px solid var(--line);border-radius:4px;position:relative;overflow:hidden;}
  .prog-bar-fill{position:absolute;left:0;top:0;bottom:0;background:var(--accent);border-radius:3px;}

  button.action{appearance:none;-webkit-appearance:none;background:var(--paper);color:var(--ink);border:1.3px solid var(--line);border-radius:999px;padding:4px 12px;font-family:var(--hand);font-size:13px;cursor:pointer;transition:all .15s;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:5px;text-align:center;}
  button.action:hover{background:var(--paper-2);}
  button.action:disabled{opacity:.45;cursor:not-allowed;color:var(--ink-3);}
  button.action.ink{background:var(--ink);color:var(--paper);border-color:var(--ink);}
  button.action.ink:hover{opacity:.85;}
  button.action.accent{background:var(--capital-purple);color:#fff;border-color:var(--capital-purple);}
  button.action.lunch-btn{background:var(--capital-cyan);color:#062f3b;border-color:#2797b6;}

  .notif-banner{background:var(--capital-cyan);color:#062f3b;padding:10px 18px;display:flex;align-items:center;gap:12px;border-bottom:1.4px solid rgba(39,151,182,.65);flex-shrink:0;}
  .notif-banner.in-banner{background:var(--capital-purple);color:#fff;border-bottom-color:var(--capital-purple-dark);}

  .capital-status-card{position:relative;overflow:hidden;transition:border-color .16s,background .16s,box-shadow .16s,transform .16s;}
  .capital-status-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--line);opacity:.9;}
  .capital-status-card.state-in{background:var(--capital-purple-soft)!important;border-color:var(--capital-purple)!important;box-shadow:0 10px 22px rgba(108,31,110,.10);}
  .capital-status-card.state-in::before{background:var(--capital-purple);}
  .capital-status-card.state-lunch{background:var(--capital-cyan-soft)!important;border-color:var(--capital-cyan)!important;box-shadow:0 10px 22px rgba(92,200,232,.16);}
  .capital-status-card.state-lunch::before{background:var(--capital-cyan);}
  .capital-status-card.state-off{background:#fff!important;border-color:rgba(50,29,51,.32)!important;}
  .capital-status-card.state-off::before{background:rgba(50,29,51,.35);}
  .capital-status-card.state-alert{background:var(--capital-red-soft)!important;border-color:var(--capital-red)!important;}
  .capital-status-card.state-alert::before{background:var(--capital-red);}
  .capital-status-card.state-done{background:var(--capital-green-soft)!important;border-color:var(--capital-green)!important;}
  .capital-status-card.state-done::before{background:var(--capital-green);}
  .capital-section-title{color:var(--capital-purple-dark);}
  .capital-meter{height:7px;border-radius:999px;background:linear-gradient(90deg,var(--capital-purple),var(--capital-cyan));box-shadow:inset 0 0 0 1px rgba(50,29,51,.18);}

  .payroll-mobile-panel,.payroll-mobile-days{display:none;}
  .payroll-control-grid{display:grid;grid-template-columns:minmax(160px,1fr) 138px 120px;gap:8px;align-items:center;}
  .payroll-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0 12px;}
  .payroll-stat-card{border:1.3px solid rgba(50,29,51,.22);border-radius:10px;background:#fff;padding:10px 11px;min-width:0;}
  .payroll-stat-card.primary{background:var(--capital-purple-soft);border-color:rgba(108,31,110,.45);}
  .payroll-stat-card.lunch{background:var(--capital-cyan-soft);border-color:rgba(92,200,232,.7);}
  .payroll-stat-label{font-family:var(--mono);font-size:9px;letter-spacing:.5px;text-transform:uppercase;color:var(--ink-3);margin-bottom:3px;}
  .payroll-stat-value{font-family:var(--mono);font-size:16px;font-weight:800;color:var(--ink);}
  .payroll-stat-note{font-size:11px;color:var(--ink-3);margin-top:2px;}
  .payroll-cut-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0 12px;}
  .payroll-cut-card{border:1.4px solid rgba(50,29,51,.28);border-radius:12px;background:#fff;padding:12px;box-shadow:0 8px 18px rgba(67,16,70,.05);}
  .payroll-cut-card.confirmed{background:var(--capital-green-soft);border-color:var(--capital-green);}
  .payroll-cut-card.review{background:var(--capital-amber-soft);border-color:var(--capital-amber);}
  .payroll-cut-title{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;}
  .payroll-cut-title strong{font-size:15px;}
  .payroll-cut-meta{font-family:var(--mono);font-size:10px;color:var(--ink-3);}
  .payroll-cut-lines{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:8px 0 10px;}
  .payroll-cut-line{border:1px dashed rgba(50,29,51,.24);border-radius:8px;padding:7px;background:rgba(255,255,255,.62);}
  .payroll-week-card{border:1.4px solid rgba(50,29,51,.22);border-radius:12px;background:#fff;margin-bottom:12px;overflow:hidden;}
  .payroll-week-head{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;background:linear-gradient(90deg,var(--capital-purple-soft),var(--capital-cyan-soft));border-bottom:1px solid rgba(50,29,51,.18);}
  .payroll-day-card{display:grid;grid-template-columns:1fr auto;gap:10px;padding:10px 12px;border-bottom:1px dashed rgba(50,29,51,.24);align-items:center;}
  .payroll-day-card:last-child{border-bottom:0;}
  .payroll-day-card.has-hours{background:#fff;}
  .payroll-day-date{font-weight:800;font-size:13px;}
  .payroll-day-meta{font-family:var(--mono);font-size:10px;color:var(--ink-3);margin-top:2px;}
  .payroll-day-values{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;}

  @keyframes fadeIn{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);}}
  .fade-in{animation:fadeIn .2s ease;}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:.6;}}
  .pulse{animation:pulse 2s ease-in-out infinite;}

  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:rgba(0,0,0,.2);border-radius:2px;}

  /* ── Barra de navegación móvil (oculta en escritorio) ── */
  .mobile-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--paper-2);border-top:1.4px solid var(--line);z-index:200;padding:4px 6px env(safe-area-inset-bottom,0);overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;justify-content:flex-start;gap:2px;box-shadow:0 -8px 18px rgba(0,0,0,.08);touch-action:pan-x;scroll-snap-type:x proximity;}
  .mobile-nav::-webkit-scrollbar{display:none;}
  .mobile-nav-item{flex:0 0 76px;min-width:76px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 2px;cursor:pointer;color:var(--ink-3);font-family:var(--mono);font-size:9px;letter-spacing:.3px;text-transform:uppercase;border-top:2px solid transparent;transition:color .15s,border-color .15s;-webkit-tap-highlight-color:transparent;scroll-snap-align:start;border-radius:8px 8px 0 0;}
  .mobile-nav-item.active{color:var(--accent);border-top-color:var(--accent);}
  .mobile-nav-item span{max-width:52px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;text-align:center;}
  .mobile-nav-exit{color:#c0392b;}

  /* ── Responsive ── */
  @media (max-width:768px){
    html,body,#root{min-height:100%;min-height:100dvh;max-width:100%;overflow:hidden;}
    body{overscroll-behavior-y:none;-webkit-text-size-adjust:100%;position:fixed;inset:0;width:100%;}
    input,textarea,select{font-size:16px!important;}
    .nav{display:none!important;}
    .mobile-nav{display:flex!important;}
    .app-layout{flex-direction:column;height:100dvh;overflow:hidden;background:var(--paper);}
    .main-content{height:100dvh;min-height:0;background:var(--paper);}
    .content-area{padding-bottom:calc(92px + env(safe-area-inset-bottom,0));-webkit-overflow-scrolling:touch;background:var(--paper);min-height:0;overscroll-behavior:contain;}
    .content-area > *{min-width:0;}
    .app-bar{padding:9px 12px;gap:8px;align-items:flex-start;position:relative;z-index:2;}
    .app-bar-left{gap:8px;width:100%;}
    .app-bar-divider{display:none;}
    .app-bar > .row{flex-wrap:wrap;justify-content:flex-end;gap:6px;}
    .app-bar .chip{display:none;}
    .app-bar .sk-title{font-size:22px!important;line-height:1.05;}
    .app-bar .sk-mono{font-size:10px!important;}
    .section-tabs{overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
    .section-tabs::-webkit-scrollbar{display:none;}
    .section-tab{padding:10px 14px;font-size:10px;flex-shrink:0;}
    .list-row{flex-wrap:wrap;gap:6px;align-items:flex-start;}
    .kcard,.sk-box,.serv-card-emp{max-width:100%;overflow-wrap:anywhere;}
    .kcard{touch-action:manipulation;}
    .task-item{padding:12px 10px;align-items:flex-start;flex-wrap:wrap;}
    .cal-day{min-width:120px;}
    .text-3xl{font-size:22px;}
    .text-2xl{font-size:18px;}
    .text-xl{font-size:16px;}
    .phone{width:100%;max-width:260px;}
    button.action{min-height:38px;padding:7px 12px;white-space:normal;line-height:1.15;}
    .mobile-nav-item{padding:8px 2px;}
    .mobile-only{display:block;}
    .desktop-only{display:none!important;}
    [style*="grid-template-columns"]{grid-template-columns:1fr!important;}
    .mobile-stack,
    .dash-list-grid,
    .dash-kanban-grid,
    .dash-map-grid,
    .lunch-admin-grid,
    .shift-grid,
    .shift-phone-grid,
    .profile-grid,
    .tasks-grid,
    .calendar-grid,
    .ops-grid,
    .service-grid{display:flex!important;flex-direction:column!important;grid-template-columns:1fr!important;gap:12px!important;padding:12px!important;}
    .dash-kanban-grid > *,
    .dash-map-grid > *,
    .lunch-admin-grid > *,
    .shift-grid > *,
    .profile-grid > *,
    .tasks-grid > *,
    .calendar-grid > *,
    .ops-grid > *,
    .service-grid > *{width:100%!important;min-width:0!important;}
    .row{min-width:0;}
    .row.mobile-wrap,
    .sk-box .row.between{flex-wrap:wrap;gap:8px;}
    .chip{font-size:10px;padding:2px 7px;}
    .avatar.lg{width:44px;height:44px;font-size:22px;}
    .avatar.xl{width:64px;height:64px;font-size:30px;}
    .p-4{padding:12px;}.p-5{padding:14px;}
    .notif-banner{padding:9px 12px;}
    .cal-day{min-width:210px;}
    .calendar-week{overflow-x:auto!important;-webkit-overflow-scrolling:touch;background:var(--paper);}
    .service-section{padding:12px!important;max-width:100%!important;}
    .modal-overlay{align-items:flex-start;justify-content:center;overflow-y:auto;padding:10px 10px calc(94px + env(safe-area-inset-bottom,0));}
    .modal-box{width:100%;max-width:520px;max-height:calc(100dvh - 24px);padding:18px;border-radius:14px;}
    .field-group{margin-bottom:10px;}
    .placeholder{min-height:88px;text-align:center;padding:16px;}
    .payroll-mobile-panel,.payroll-mobile-days{display:block;}
    .payroll-table-scroll{display:none!important;}
    .payroll-control-grid{grid-template-columns:1fr;}
    .payroll-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr));}
    .payroll-stat-card{padding:10px;}
    .payroll-stat-value{font-size:15px;}
    .payroll-cut-grid{grid-template-columns:1fr;gap:8px;}
    .payroll-cut-card{padding:11px;}
    .payroll-cut-lines{grid-template-columns:repeat(2,minmax(0,1fr));}
    .payroll-day-card{grid-template-columns:1fr;gap:7px;}
    .payroll-day-values{justify-content:flex-start;}
  }
  @media (max-width:480px){
    .app-bar{flex-direction:column;}
    .app-bar-left{width:100%;}
    .app-bar .action{display:none;}
    .nav-section span:last-child{display:none;}
    button.action{min-height:42px;}
    .section-tab{padding:10px 12px;}
    .mobile-nav-item{flex-basis:72px;min-width:72px;}
    .mobile-nav-item span{max-width:48px;font-size:8px;}
  }

  /* ── Calendario: tipo de evento ── */
  .cal-event.ev-service{background:#fff9c4;border-color:#c8a800;}
  .cal-event.ev-task{background:#dbeafe;border-color:#3b82f6;}
  .cal-event.ev-bici{background:#f6eaf5;border-color:#6c1f6e;}
  .cal-event.ev-appt{background:#e9f7ee;border-color:#22844a;}
  .cal-day.is-today{background:#fbf5fb;}
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
  .employee-header{background:var(--paper-2);border-bottom:1.4px solid var(--line);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
  .employee-header-left{display:flex;align-items:center;gap:12px;min-width:0;}
  .employee-header-actions{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto;}
  .employee-tabs{display:flex;border-bottom:1.4px solid var(--line);background:var(--paper-2);flex-shrink:0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
  .employee-tabs::-webkit-scrollbar{display:none;}
  .employee-tab{flex:0 0 auto;padding:11px 22px;font-family:var(--mono);font-size:11px;letter-spacing:.5px;text-transform:uppercase;cursor:pointer;border-bottom:2px solid transparent;color:var(--ink-3);transition:color .15s,border-color .15s;-webkit-tap-highlight-color:transparent;}
  .employee-tab.active{border-bottom-color:var(--accent);color:var(--accent);}
  .serv-card-emp{padding:14px;border:1.5px solid #c8a800;border-radius:12px;background:#fffdf0;margin-bottom:10px;}
  .service-actions{display:flex;gap:8px;flex-wrap:wrap;}
  .service-actions .action{min-width:132px;justify-content:center;text-align:center;}
  .maint-card{padding:12px;border:1.3px dashed var(--line);border-radius:10px;background:var(--paper);cursor:pointer;transition:background .12s;}
  .maint-card:hover{background:var(--accent-soft);}
  .employee-home{flex:1;overflow-y:auto;padding:16px 16px 80px;max-width:680px;margin:0 auto;width:100%;box-sizing:border-box;}
  .employee-hero-card{padding:20px 18px 18px!important;margin-bottom:14px!important;text-align:left!important;}
  .employee-hero-top{display:flex;align-items:center;gap:12px;margin-bottom:14px;}
  .employee-status-orb{width:42px;height:42px;border-radius:999px;border:2px solid var(--line);display:flex;align-items:center;justify-content:center;background:#fff;box-shadow:0 0 0 6px rgba(108,31,110,.06);flex-shrink:0;}
  .employee-status-orb.active{border-color:var(--capital-purple);background:var(--capital-purple);box-shadow:0 0 0 6px rgba(108,31,110,.12);}
  .employee-status-orb.lunch{border-color:var(--capital-cyan);background:var(--capital-cyan);box-shadow:0 0 0 6px rgba(92,200,232,.18);}
  .employee-status-orb span{width:13px;height:13px;border-radius:999px;background:currentColor;color:var(--ink);}
  .employee-status-orb.active span,.employee-status-orb.lunch span{background:#fff;}
  .employee-time-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0 14px;}
  .employee-time-card{border:1.2px solid rgba(50,29,51,.22);border-radius:10px;background:rgba(255,255,255,.68);padding:10px;}
  .employee-time-label{font-family:var(--mono);font-size:9px;letter-spacing:.5px;text-transform:uppercase;color:var(--ink-3);margin-bottom:3px;}
  .employee-time-value{font-family:var(--mono);font-size:16px;font-weight:900;color:var(--ink);}
  .employee-action-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;}
  .employee-primary-action,.employee-secondary-action{width:100%;min-height:44px!important;font-weight:800!important;}
  .employee-payroll-card{border:1.5px solid rgba(108,31,110,.35)!important;border-radius:14px!important;background:linear-gradient(180deg,#fffaff 0%,#f7f0f8 100%)!important;padding:16px!important;margin-bottom:18px!important;}
  .employee-payroll-cuts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:10px 0;}
  .employee-payroll-cut{border:1.2px solid rgba(50,29,51,.22);border-radius:11px;background:#fff;padding:10px;}
  .employee-payroll-cut.confirmed{background:var(--capital-green-soft);border-color:var(--capital-green);}
  .employee-payroll-cut.review{background:var(--capital-amber-soft);border-color:var(--capital-amber);}
  @media(max-width:768px){
    .employee-header{padding:10px 12px;align-items:flex-start;}
    .employee-header-left{flex:1 1 170px;}
    .employee-header-left img{height:24px;}
    .employee-header-actions{width:100%;display:grid;grid-template-columns:1fr 1fr;margin-left:0;}
    .employee-header-actions .action{width:100%;font-size:12px!important;}
    .employee-tab{padding:10px 18px;font-size:10px;}
    .modal-box{padding:18px;}
    .field-input{font-size:15px;}
    .service-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;}
    .service-actions .action{width:100%;min-width:0;white-space:normal;line-height:1.2;color:var(--ink);}
    .service-actions .action.accent,.service-actions .action.ink{color:#fff;}
    .service-actions .action:first-child{grid-column:1 / -1;}
    .employee-home{padding:12px 12px 96px!important;max-width:100%;}
    .employee-hero-card{padding:18px 14px!important;border-radius:16px!important;}
    .employee-hero-top{align-items:flex-start;}
    .employee-time-grid{grid-template-columns:1fr 1fr;}
    .employee-action-row{grid-template-columns:1fr;}
    .employee-payroll-cuts{grid-template-columns:1fr;}
  }

  /* ── Impresión de recibo ── */
  @media print {
    body > * { display: none !important; }
    .print-receipt { display: block !important; position: fixed; inset: 0; background: #fff; z-index: 99999; overflow: auto; }
  }
  .print-receipt { display: none; }
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
  const roles = ["Responsable de taller", "Mecánico", "Tienda/Caja", "Administración", "Reparto", "Otro"];
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
function EditMemberModal({ person, extData = {}, onClose, onSave, isPinAvailable = () => true }) {
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
  const [permissions, setPermissions] = useState({ ...DEFAULT_PERMISSIONS, ...(extData.permissions || {}) });
  const roles = ["Responsable de taller", "Mecánico", "Tienda/Caja", "Administración", "Reparto", "Otro"];
  const verifyPin = () => {
    if (pin === ADMIN_PIN) { setPinOk(true); setPinError(""); }
    else setPinError("PIN incorrecto. Solo administración puede editar.");
  };
  const save = () => {
    if (employeePin && !isPinAvailable(employeePin, person.id)) {
      setPinError("Esa clave ya la usa otro colaborador. Elige una diferente.");
      return;
    }
    onSave({ ...extData, name, role, salario, direccion, documento, eps, horasSemana, pin: employeePin, permissions, pinUpdatedAt: extData.pinUpdatedAt, pinChangeLog: extData.pinChangeLog || [] });
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
              <Field label="REFERENCIA DE PAGO" value={salario} onChange={setSalario} placeholder="1.850" />
              <Field label="TIEMPO REFERENCIA SEMANAL" value={horasSemana} onChange={setHorasSemana} placeholder="40" />
              <hr className="sk-hr dashed" />
              <Field label="PIN DE ACCESO COLABORADOR (4 dígitos)" value={employeePin} onChange={setEmployeePin} placeholder="1234" />
              <hr className="sk-hr dashed" />
              <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 10 }}>PERMISOS</div>
              {([
                { key: "canViewServices", label: "Ver módulo de servicios" },
                { key: "canViewGeneralCalendar", label: "Ver calendario general del equipo" },
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
function Logo({ height = 28, darkBg = false }: { height?: number; darkBg?: boolean }) {
  return <img src={darkBg ? LOGO_DARK_BG_SRC : LOGO_SRC} alt="Capital Wo-Man Bikes" style={{ height, display: "block", objectFit: "contain" }} />;
}

function Av({ p, size = "sm", state }) {
  const cls = ["avatar", size, state === "lunch" ? "lunch" : state === "busy" ? "busy" : ""].filter(Boolean).join(" ");
  return <div className={cls}>{p.initials}</div>;
}

function StatusPill({ state }) {
  if (state === "lunch") return <span className="chip lunch"><span className="dot" style={{ background: "#fff" }} />ALMUERZO</span>;
  if (state === "busy") return <span className="chip accent"><span className="dot" style={{ background: "#fff" }} />EN TAREA</span>;
  if (state === "in") return <span className="chip accent"><span className="dot" style={{ background: "#fff" }} />DÍA INICIADO</span>;
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
  message: <><path d="M4 5h16v11H8l-4 4V5Z" /><path d="M8 9h8M8 12h5" /></>,
  in: <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></>,
  out: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
  wrench: <><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
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
    { id: 6, who: "c", label: "Pagos + 3", done: false },
  ]);
  const toggle = id => setTasks(t => t.map(x => x.id === id ? { ...x, done: !x.done } : x));
  const done = tasks.filter(t => t.done).length;

  return (
    <div className="fade-in dash-list-grid" style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 18, padding: 18, flex: 1 }}>
      <div className="stack gap-3">
        <div className="sk-mono text-xs tracked muted">PERSONAS (2)</div>

        {team.map((p, idx) => {
          const inShift = !!shiftState[p.id];
          const isLunch = inShift && lunchState && p.id === "s";
          const pStatus = !inShift ? "off" : isLunch ? "lunch" : "ok";
          const statusClass = isLunch ? "state-lunch" : inShift ? "state-in" : "state-off";
          return (
            <div key={p.id} className={`sk-box p-4 capital-status-card ${statusClass}`}>
              <div className="row between">
                <div className="row gap-3">
                  <Av p={p} size="lg" state={isLunch ? "lunch" : inShift ? "busy" : null} />
                  <div className="stack" style={{ gap: 4 }}>
                    <div className="text-lg" style={{ fontWeight: 700 }}>{p.name} · {p.role}</div>
                    <StatusPill state={pStatus} />
                    {inShift && isLunch && <div className="sk-mono text-xs muted">en almuerzo · no molestar</div>}
                    {inShift && !isLunch && <div className="sk-mono text-xs muted">día iniciado</div>}
                    {!inShift && <div className="sk-mono text-xs muted">día sin iniciar</div>}
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
            <div className="list-row"><span>Día iniciado</span><span className="sk-mono">{team.filter(p => shiftState[p.id]).length}/{team.length}</span></div>
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
            {team.filter(p => shiftState[p.id]).length === 0 && <div className="text-sm muted">Nadie ha iniciado el día hoy</div>}
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
    <div className="fade-in dash-kanban-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, padding: 14, flex: 1 }}>
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
      <div className="dash-map-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: lunchState && shiftState.s ? 80 : 16 }}>
        <div className="sk-box fill p-4" style={lunchState && shiftState.s ? { borderColor: "var(--lunch)", borderWidth: 2 } : shiftState.s ? { borderColor: "var(--accent)", borderWidth: 2 } : {}}>
          <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 16 }}>ZONA · TALLER</div>
          <div className="stack gap-2" style={{ alignItems: "center" }}>
            <Av p={team[0] || INITIAL_TEAM[0]} size="xl" state={lunchState && shiftState.s ? "lunch" : shiftState.s ? "busy" : null} />
            <div className="sk-title text-xl">{(team[0] || INITIAL_TEAM[0]).name}</div>
            <StatusPill state={!shiftState.s ? "off" : lunchState ? "lunch" : "ok"} />
            {shiftState.s && lunchState && <div className="sk-mono text-xs muted">empezó 13:58 · ~22 min</div>}
            {shiftState.s && !lunchState && <div className="sk-mono text-xs muted">montaje #115 en curso</div>}
            {!shiftState.s && <div className="sk-mono text-xs muted">sin iniciar hoy</div>}
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
function BusinessDashboard({ view, services, tasks, appointments, memberships, team, shift, empLunch, attendanceRecords = [] }: {
  view: string;
  services: BikeService[];
  tasks: AppTask[];
  appointments: Appointment[];
  memberships: Membership[];
  team: any[];
  shift: Record<string, boolean | string>;
  empLunch: Record<string, boolean>;
  attendanceRecords?: AttendanceRecord[];
}) {
  const today = _fmtDate(new Date());
  const tomorrow = _addDays(1);
  const monthKey = today.slice(0, 7);
  const activeServices = services.filter(s => s.phase < 4 && s.deliveryStatus !== "entregada");
  const readyServices = services.filter(s => s.phase >= 4 && s.deliveryStatus !== "entregada");
  const deliveredThisMonth = services.filter(s => (s.deliveredAt || s.completedAt || "").slice(0, 7) === monthKey);
  const todayServices = services.filter(s => (s.scheduledDate || s.date) === today && s.phase < 4);
  const tomorrowServices = services.filter(s => (s.scheduledDate || s.date) === tomorrow && s.phase < 4);
  const overdue = activeServices.filter(s => s.neededByDate && s.neededByDate < today);
  const todayMs = new Date(today + "T00:00:00").getTime();
  const readyOverFive = readyServices.filter(s => s.completedAt && Math.floor((todayMs - new Date(s.completedAt).setHours(0,0,0,0)) / 86400000) >= 5);
  const summaries = services.map(s => ({ service: s, summary: ticketSummary(s) }));
  const receivable = summaries.reduce((sum, row) => sum + Math.max(0, row.summary.balance || 0), 0);
  const activePipeline = summaries.filter(row => row.service.deliveryStatus !== "entregada").reduce((sum, row) => sum + row.summary.subtotal, 0);
  const monthRevenue = summaries.filter(row => (row.service.completedAt || row.service.deliveredAt || row.service.createdAt || "").slice(0, 7) === monthKey).reduce((sum, row) => sum + row.summary.subtotal, 0);
  const paidMonth = summaries.filter(row => (row.service.completedAt || row.service.deliveredAt || row.service.createdAt || "").slice(0, 7) === monthKey && row.service.paymentStatus === "pagado").reduce((sum, row) => sum + row.summary.subtotal, 0);
  const pendingTasks = tasks.filter(t => !t.done);
  const todayPendingTasks = pendingTasks.filter(t => !t.date || t.date === today);
  const todayAppointments = appointments.filter(a => a.date === today);
  const activeMemberships = memberships.filter(m => m.endDate >= today && m.usedUses < m.includedUses);
  const availableUses = memberships.reduce((sum, m) => sum + Math.max(0, m.includedUses - m.usedUses), 0);
  const inShift = team.filter(p => !!shift[p.id]);
  const inLunch = team.filter(p => !!shift[p.id] && !!empLunch[p.id]);
  const bottlenecks = WORKSHOP_PHASES.map(w => ({ ...w, count: activeServices.filter(s => s.workshopStatus === w.key).length })).filter(w => w.count > 0).sort((a, b) => b.count - a.count);
  const topReceivables = summaries.filter(row => row.service.deliveryStatus !== "entregada" && row.summary.balance > 0).sort((a, b) => b.summary.balance - a.summary.balance).slice(0, 6);
  const urgentServices = [...overdue, ...readyOverFive, ...activeServices.filter(s => s.neededByDate === today)].filter((s, i, arr) => arr.findIndex(x => x.id === s.id) === i).slice(0, 8);
  const teamLoad = team.map(p => {
    const assigned = activeServices.filter(s => s.technicianId === p.id);
    const taskCount = pendingTasks.filter(t => t.assignedTo === p.id).length;
    return { person: p, assigned, taskCount, score: assigned.length + taskCount };
  }).sort((a, b) => b.score - a.score);
  const closeRate = services.length ? Math.round((services.filter(s => s.deliveryStatus === "entregada").length / services.length) * 100) : 0;
  const weekStart = (() => { const d = new Date(); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); return _fmtDate(d); })();
  const teamProductivity = productivityRows(team, tasks, attendanceRecords, { from: weekStart, to: today }).sort((a, b) => b.score - a.score);
  const avgProductivity = teamProductivity.length ? Math.round(teamProductivity.reduce((sum, row) => sum + row.score, 0) / teamProductivity.length) : 0;
  const recommendations = [
    receivable > 0 ? `Cobrar saldos pendientes: hay ${money(receivable)} por recuperar.` : "Cartera limpia: no hay saldos pendientes registrados.",
    readyServices.length ? `Mover entregas: ${readyServices.length} bici(s) listas ocupando espacio.` : "No hay bicis listas pendientes por entregar.",
    overdue.length ? `Prioridad taller: ${overdue.length} servicio(s) vencidos frente a fecha acordada.` : "Fechas acordadas bajo control.",
    avgProductivity < 70 ? `Productividad semanal en ${avgProductivity}%. Revisa bloqueos, calidad y tareas vencidas.` : `Productividad semanal en ${avgProductivity}%. Mantener ritmo y cierre de calidad.`,
    todayAppointments.length + todayServices.length > Math.max(1, inShift.length) * 3 ? "Agenda cargada: reparte trabajo o limita nuevos ingresos hoy." : "Capacidad del día se ve manejable.",
  ];
  const Metric = ({ label, value, hint, tone = "default" }: { label: string; value: string | number; hint?: string; tone?: string }) => (
    <div className="sk-box p-4" style={tone === "risk" ? { borderColor: "#c0392b", borderWidth: 2 } : tone === "good" ? { borderColor: "#4caf50", borderWidth: 2 } : {}}>
      <div className="sk-mono text-xs tracked muted">{label}</div>
      <div className="sk-title text-2xl" style={{ marginTop: 4 }}>{value}</div>
      {hint && <div className="text-xs muted" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );
  const ServiceRow = ({ service, right }: { service: BikeService; right?: string }) => {
    const deliveredDate = deliveryDateLabel(service);
    return (
    <div className="list-row" style={{ gap: 10 }}>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 700, fontSize: 13 }}>{service.clientName}</span>
        <span className="sk-mono" style={{ display: "block", fontSize: 10, color: "var(--ink-3)" }}>{serviceStatusLabel(service)} · {service.deliveryStatus === "entregada" && deliveredDate ? `Entregada ${deliveredDate}` : (service.scheduledDate || service.date)}</span>
      </span>
      {right && <span className="sk-mono" style={{ fontSize: 11, color: "#6c1f6e", flexShrink: 0 }}>{right}</span>}
    </div>
    );
  };

  if (view === "kanban") {
    return (
      <div className="fade-in" style={{ padding: 18 }}>
        <div className="dash-kanban-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
          {[{ title: "Riesgo", items: urgentServices, color: "#c0392b" }, { title: "En proceso", items: activeServices.slice(0, 10), color: "#6c1f6e" }, { title: "Listas para entregar", items: readyServices.slice(0, 10), color: "#4caf50" }].map(col => (
            <div key={col.title} className="sk-box p-4">
              <div className="row between" style={{ marginBottom: 10 }}><div className="sk-title text-xl">{col.title}</div><span className="chip" style={{ color: col.color }}>{col.items.length}</span></div>
              {col.items.length ? col.items.map(s => <ServiceRow key={s.id} service={s} right={money(ticketSummary(s).balance)} />) : <div className="placeholder" style={{ padding: 22, borderRadius: 8 }}>Sin casos</div>}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === "timeline") {
    return (
      <div className="fade-in" style={{ padding: 18 }}>
        <div className="sk-box p-4" style={{ marginBottom: 14 }}>
          <div className="sk-title text-xl">Agenda comercial del día</div>
          <div className="sk-mono text-xs muted" style={{ marginTop: 4 }}>{todayServices.length} bicis hoy · {todayAppointments.length} agendamientos · {todayPendingTasks.length} tareas pendientes</div>
        </div>
        <div className="dash-kanban-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="sk-box p-4">
            <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 8 }}>HOY</div>
            {todayServices.length ? todayServices.map(s => <ServiceRow key={s.id} service={s} />) : <div className="placeholder" style={{ padding: 24, borderRadius: 8 }}>Sin bicis programadas hoy</div>}
            {todayAppointments.map(a => <div key={a.id} className="list-row"><span>{a.client}</span><span className="sk-mono text-xs">{a.startTime} · {a.service}</span></div>)}
          </div>
          <div className="sk-box p-4">
            <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 8 }}>MAÑANA</div>
            {tomorrowServices.length ? tomorrowServices.map(s => <ServiceRow key={s.id} service={s} />) : <div className="placeholder" style={{ padding: 24, borderRadius: 8 }}>Sin bicis programadas</div>}
          </div>
        </div>
      </div>
    );
  }

  if (view === "mapa") {
    return (
      <div className="fade-in" style={{ padding: 18 }}>
        <div className="dash-map-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
          <div className="sk-box p-4">
            <div className="sk-title text-xl">Carga del equipo</div><hr className="sk-hr dashed" />
            {teamLoad.map(row => <div key={row.person.id} className="list-row"><span className="row gap-2"><Av p={row.person} size="sm" state={shift[row.person.id] ? (empLunch[row.person.id] ? "lunch" : "busy") : null} />{row.person.name}</span><span className="sk-mono text-xs">{row.assigned.length} bicis · {row.taskCount} tareas</span></div>)}
          </div>
          <div className="sk-box p-4">
            <div className="sk-title text-xl">Cuellos de botella</div><hr className="sk-hr dashed" />
            {bottlenecks.length ? bottlenecks.map(b => <div key={b.key} className="list-row"><span>{b.label}</span><span className="chip">{b.count}</span></div>) : <div className="placeholder" style={{ padding: 24, borderRadius: 8 }}>Sin acumulaciones fuertes</div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ padding: 18 }}>
      <div className="dashboard-metrics" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 14 }}>
        <Metric label="Pipeline activo" value={money(activePipeline)} hint={`${activeServices.length} servicios abiertos`} />
        <Metric label="Cartera por cobrar" value={money(receivable)} hint={`${topReceivables.length} casos prioritarios`} tone={receivable > 0 ? "risk" : "good"} />
        <Metric label="Ventas mes" value={money(monthRevenue)} hint={`Pagado: ${money(paidMonth)}`} />
        <Metric label="Entrega efectiva" value={`${closeRate}%`} hint={`${deliveredThisMonth.length} entregas este mes`} tone={closeRate >= 70 ? "good" : "default"} />
      </div>
      <div className="dash-list-grid" style={{ display: "grid", gridTemplateColumns: "1.3fr .9fr", gap: 14 }}>
        <div className="stack gap-3">
          <div className="sk-box p-4"><div className="sk-title text-xl">Acciones que mueven caja</div><hr className="sk-hr dashed" />{recommendations.map((r, i) => <div key={i} className="list-row"><span>{r}</span></div>)}</div>
          <div className="sk-box p-4">
            <div className="row between" style={{ marginBottom: 8 }}><div className="sk-title text-xl">Cobros prioritarios</div><span className="chip">{money(receivable)}</span></div>
            {topReceivables.length ? topReceivables.map(row => <ServiceRow key={row.service.id} service={row.service} right={money(row.summary.balance)} />) : <div className="placeholder" style={{ padding: 24, borderRadius: 8 }}>Sin saldos pendientes</div>}
          </div>
        </div>
        <div className="stack gap-3">
          <div className="sk-box p-4"><div className="sk-title text-xl">Operación hoy</div><hr className="sk-hr wavy" /><div className="list-row"><span>Servicios hoy</span><span className="sk-mono">{todayServices.length}</span></div><div className="list-row"><span>Agendamientos hoy</span><span className="sk-mono">{todayAppointments.length}</span></div><div className="list-row"><span>Tareas pendientes</span><span className="sk-mono">{todayPendingTasks.length}</span></div><div className="list-row"><span>Día iniciado</span><span className="sk-mono">{inShift.length}/{team.length}</span></div><div className="list-row"><span>En almuerzo</span><span className="sk-mono">{inLunch.length}</span></div></div>
          <div className="sk-box p-4">
            <div className="row between" style={{ marginBottom: 8 }}>
              <div className="sk-title text-xl">Productividad semanal</div>
              <span className="chip">{avgProductivity}%</span>
            </div>
            <hr className="sk-hr wavy" />
            {teamProductivity.length ? teamProductivity.slice(0, 5).map(row => (
              <div key={row.person.id} className="list-row" style={{ gap: 10 }}>
                <span className="row gap-2" style={{ minWidth: 0 }}><Av p={row.person} size="sm" state={shift[row.person.id] ? "busy" : null} />{row.person.name}</span>
                <span className="sk-mono text-xs" style={{ flexShrink: 0 }}>{row.score}% · {fmtHours(row.hours)} · {row.completedTasks}/{row.assignedTasks}</span>
              </div>
            )) : <div className="placeholder" style={{ padding: 18, borderRadius: 8 }}>Sin datos de asistencia o tareas</div>}
          </div>
          <div className="sk-box p-4"><div className="sk-title text-xl">Membresías</div><hr className="sk-hr wavy" /><div className="list-row"><span>Activas</span><span className="sk-mono">{activeMemberships.length}</span></div><div className="list-row"><span>Usos disponibles</span><span className="sk-mono">{availableUses}</span></div></div>
          <div className="sk-box p-4"><div className="sk-title text-xl">Riesgos</div><hr className="sk-hr wavy" /><div className="list-row"><span>Vencidos</span><span className="sk-mono">{overdue.length}</span></div><div className="list-row"><span>Listas +5 días</span><span className="sk-mono">{readyOverFive.length}</span></div><div className="list-row"><span>Listas por entregar</span><span className="sk-mono">{readyServices.length}</span></div></div>
        </div>
      </div>
    </div>
  );
}

function LunchSection({ lunchState, setLunchState, shiftState, team = INITIAL_TEAM, empLunch = {}, setEmpLunch, lunchRecords = [], onStartLunch, onEndLunch, onCorrectLunchEnd }: {
  lunchState: boolean;
  setLunchState: any;
  shiftState: Record<string, boolean | string>;
  team?: any[];
  empLunch?: Record<string, boolean>;
  setEmpLunch?: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  lunchRecords?: LunchRecord[];
  onStartLunch?: (member: any) => void;
  onEndLunch?: (member: any) => void;
  onCorrectLunchEnd?: (recordId: string, endTime: string) => void;
}) {
  const activeLunch = team.filter(p => !!shiftState[p.id] && !!empLunch[p.id]);
  const available = team.filter(p => !!shiftState[p.id] && !empLunch[p.id]);
  const offShift = team.filter(p => !shiftState[p.id]);
  const legacySergioLunch = !!lunchState && !!shiftState.s && !empLunch.s;
  const lunchCount = activeLunch.length + (legacySergioLunch ? 1 : 0);
  const shiftCount = team.filter(p => !!shiftState[p.id]).length;
  const setLunchFor = (id: string, next: boolean) => {
    if (next && !shiftState[id]) return;
    const member = team.find(p => p.id === id);
    if (member && next && onStartLunch) return onStartLunch(member);
    if (member && !next && onEndLunch) return onEndLunch(member);
    setEmpLunch?.((prev: Record<string, boolean>) => ({ ...prev, [id]: next }));
    if (id === "s") setLunchState(next);
  };
  const stateFor = (id: string) => !shiftState[id] ? "off" : empLunch[id] ? "lunch" : "ok";
  const lunchList = activeLunch.length ? activeLunch : legacySergioLunch ? [team.find(p => p.id === "s") || INITIAL_TEAM[0]] : [];
  const today = _fmtDate(new Date());
  const todayRecords = lunchRecords.filter(r => r.date === today);
  const todayMinutes = todayRecords.reduce((sum, r) => sum + (Number(r.minutes) || (r.status === "abierto" ? minutesBetween(r.startTime, new Date().toISOString()) : 0)), 0);
  const fmtHour = (iso?: string) => iso ? new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--";

  return (
    <div className="fade-in" style={{ padding: 18 }}>
      <div className="row between" style={{ marginBottom: 16, alignItems: "flex-start" }}>
        <div>
          <div className="sk-mono text-xs tracked muted">CONTROL DE ALMUERZOS / NO MOLESTAR</div>
          <div className="sk-title text-2xl" style={{ marginTop: 4 }}>Estado del equipo en tiempo real</div>
        </div>
        <div className="row gap-2">
          <span className="chip accent"><span className="dot" style={{ background: "#fff" }} />{shiftCount} con día iniciado</span>
          <span className="chip lunch"><span className="dot" style={{ background: "#fff" }} />{lunchCount} en almuerzo</span>
          <span className="chip">{fmtMinutes(todayMinutes)} hoy</span>
        </div>
      </div>

      <div className="lunch-admin-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr .9fr", gap: 16, alignItems: "start" }}>
        <div className="sk-box p-4">
          <div className="row between" style={{ marginBottom: 12 }}>
            <div>
              <div className="sk-mono text-xs tracked muted">EQUIPO</div>
              <div className="text-sm sub">Inicia o termina almuerzo por persona.</div>
            </div>
            <button className="action lunch-btn" disabled={!available.length} onClick={() => available[0] && setLunchFor(available[0].id, true)}>
              <Icon d={I.lunch} size={14} /> Iniciar siguiente
            </button>
          </div>

          <div className="stack" style={{ gap: 10 }}>
            {team.map(p => {
              const isLunch = !!shiftState[p.id] && !!empLunch[p.id];
              const isIn = !!shiftState[p.id];
              return (
                <div key={p.id} className={`sk-box p-3 capital-status-card ${isLunch ? "state-lunch" : isIn ? "state-in" : "state-off"}`}>
                  <div className="row between" style={{ gap: 12 }}>
                    <div className="row gap-3" style={{ minWidth: 0 }}>
                      <Av p={p} size="lg" state={isLunch ? "lunch" : isIn ? "busy" : null} />
                      <div className="stack" style={{ gap: 3, minWidth: 0 }}>
                        <div className="text-sm" style={{ fontWeight: 800 }}>{p.name}</div>
                        <div className="sk-mono text-xs muted">{p.role || "Equipo"} - {isIn ? "día iniciado" : "día sin iniciar"}</div>
                      </div>
                    </div>
                    <div className="row gap-2" style={{ flexShrink: 0 }}>
                      <StatusPill state={stateFor(p.id)} />
                      {isLunch ? (
                        <button className="action" onClick={() => setLunchFor(p.id, false)}>Terminar</button>
                      ) : (
                        <button className="action lunch-btn" disabled={!isIn} onClick={() => setLunchFor(p.id, true)}>
                          <Icon d={I.lunch} size={14} /> Iniciar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className={`sk-box p-4 capital-status-card ${lunchCount ? "state-lunch" : "state-off"}`}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div className="sk-mono text-xs tracked muted">AHORA EN ALMUERZO</div>
              <span className="chip lunch">{lunchCount}</span>
            </div>
            {lunchList.length ? (
              <div className="stack" style={{ gap: 10 }}>
                {lunchList.map(p => (
                  <div key={p.id} className="row between">
                    <div className="row gap-2">
                      <Av p={p} size="sm" state="lunch" />
                      <div>
                        <div className="text-sm" style={{ fontWeight: 800 }}>{p.name}</div>
                        <div className="sk-mono text-xs muted">No molestar activo</div>
                      </div>
                    </div>
                    <button className="action" onClick={() => setLunchFor(p.id, false)}>Volvió</button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="sk-box dashed p-4" style={{ textAlign: "center" }}>
                <div className="sk-title text-xl">Nadie está almorzando</div>
                <div className="text-sm sub" style={{ marginTop: 4 }}>Cuando alguien marque almuerzo, aparecerá aquí y en el banner superior.</div>
              </div>
            )}
          </div>

          <div className="sk-box p-4">
            <div className="row between" style={{ marginBottom: 10 }}>
              <div>
                <div className="sk-mono text-xs tracked muted">HISTORIAL DE HOY</div>
                <div className="text-sm sub">{todayRecords.length} registro(s) · {fmtMinutes(todayMinutes)} acumulados</div>
              </div>
            </div>
            {todayRecords.length ? (
              <div className="stack" style={{ gap: 8 }}>
                {todayRecords.map(r => (
                  <div key={r.id} className={`sk-box p-3 capital-status-card ${r.status === "abierto" ? "state-lunch" : "state-done"}`}>
                    <div className="row between" style={{ gap: 10, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0 }}>
                        <div className="text-sm" style={{ fontWeight: 800 }}>{r.employeeName || team.find(p => p.id === r.employeeId)?.name || "Equipo"}</div>
                        <div className="sk-mono text-xs muted">
                          {fmtHour(r.startTime)} → {fmtHour(r.endTime)} · {fmtMinutes(r.status === "abierto" ? minutesBetween(r.startTime, new Date().toISOString()) : r.minutes)}
                        </div>
                      </div>
                      <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                        <span className={r.status === "abierto" ? "chip lunch" : "chip"}>{r.status === "abierto" ? "en almuerzo" : "cerrado"}</span>
                        {r.status === "abierto" ? (
                          <button className="action" onClick={() => {
                            const member = team.find(p => p.id === r.employeeId) || { id: r.employeeId, name: r.employeeName };
                            setLunchFor(member.id, false);
                          }}>Terminar</button>
                        ) : onCorrectLunchEnd && (
                          <input
                            type="time"
                            className="field-input"
                            style={{ width: 116, padding: "5px 8px", fontSize: 12 }}
                            defaultValue={r.endTime ? fmtHour(r.endTime) : ""}
                            onBlur={e => e.currentTarget.value && onCorrectLunchEnd(r.id, e.currentTarget.value)}
                            title="Corregir hora de regreso"
                          />
                        )}
                      </div>
                    </div>
                    {r.observations && <div className="sk-mono text-xs muted" style={{ marginTop: 6 }}>{r.observations}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="placeholder" style={{ padding: 18, borderRadius: 8 }}>Sin almuerzos registrados hoy</div>
            )}
          </div>

          <div className="sk-box p-4">
            <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 10 }}>DISPONIBLES CON DÍA INICIADO</div>
            {available.length ? available.map(p => (
              <div key={p.id} className="row between" style={{ padding: "8px 0", borderBottom: "1px dashed var(--line)" }}>
                <div className="row gap-2">
                  <Av p={p} size="sm" state="busy" />
                  <div className="text-sm" style={{ fontWeight: 700 }}>{p.name}</div>
                </div>
                <button className="action lunch-btn" onClick={() => setLunchFor(p.id, true)}>Enviar</button>
              </div>
            )) : (
              <div className="text-sm sub">No hay personas disponibles con día iniciado.</div>
            )}
          </div>

          <div className="sk-box p-4">
            <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 10 }}>DÍA SIN INICIAR</div>
            {offShift.length ? offShift.map(p => (
              <div key={p.id} className="row between" style={{ padding: "6px 0" }}>
                <div className="row gap-2">
                  <Av p={p} size="xs" />
                  <div className="text-sm">{p.name}</div>
                </div>
                <StatusPill state="off" />
              </div>
            )) : (
              <div className="text-sm sub">Todo el equipo tiene día iniciado.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

}

function ShiftSection({ shiftState, setShiftState, lunchState, team = INITIAL_TEAM, attendanceRecords = [], lunchRecords = [], empLunch = {}, payrollConfirmations = [], onStartAttendance, onCloseAttendance, onCorrectAttendanceExit, onSaveAttendanceRecord, onSaveLunchRecord, onConfirmPayroll }: {
  shiftState: Record<string, boolean | string>;
  setShiftState: any;
  lunchState: boolean;
  team?: any[];
  attendanceRecords?: AttendanceRecord[];
  lunchRecords?: LunchRecord[];
  empLunch?: Record<string, boolean>;
  payrollConfirmations?: PayrollConfirmation[];
  onStartAttendance?: (member: any) => void;
  onCloseAttendance?: (member: any) => void;
  onCorrectAttendanceExit?: (recordId: string, exitTime: string) => void;
  onSaveAttendanceRecord?: (record: AttendanceRecord) => void;
  onSaveLunchRecord?: (record: LunchRecord) => void;
  onConfirmPayroll?: (confirmation: PayrollConfirmation) => void;
}) {
  const [, setTick] = useState(0);
  const [timesheetPersonId, setTimesheetPersonId] = useState(() => team[0]?.id || "");
  const [timesheetMonth, setTimesheetMonth] = useState(() => _fmtDate(new Date()).slice(0, 7));
  const [hourlyRateInput, setHourlyRateInput] = useState("6000");
  const [editingDate, setEditingDate] = useState("");
  const [manualEntry, setManualEntry] = useState("08:00");
  const [manualExit, setManualExit] = useState("17:00");
  const [manualLunchStart, setManualLunchStart] = useState("13:00");
  const [manualLunchEnd, setManualLunchEnd] = useState("14:00");
  const [manualObservation, setManualObservation] = useState("");
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
  const today = _fmtDate(new Date());
  const todayRecords = attendanceRecords.filter(r => r.date === today);
  const lunchMinutesFromRecords = (records: LunchRecord[]) => records.reduce((sum, r) => sum + (Number(r.minutes) || (r.status === "abierto" ? minutesBetween(r.startTime, new Date().toISOString()) : 0)), 0);
  const netHours = (grossHours: number, lunchMinutes: number) => Math.max(0, Math.round((grossHours - (lunchMinutes / 60)) * 100) / 100);
  const todayLunchMinutes = lunchMinutesFromRecords(lunchRecords.filter(r => r.date === today));
  const todayPresenceHours = netHours(todayRecords.reduce((sum, r) => sum + (r.status === "abierto" ? hoursBetween(r.entryTime, new Date().toISOString()) : (Number(r.hoursWorked) || 0)), 0), todayLunchMinutes);
  const todayAutoClosed = todayRecords.filter(r => r.status === "cerrado_automatico").length;
  const weekStart = (() => { const d = new Date(); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); return _fmtDate(d); })();
  const weeklyRecords = attendanceRecords.filter(r => r.date >= weekStart && r.date <= today);
  const selectedTimesheetPerson = team.find(p => p.id === timesheetPersonId) || team[0];
  const selectedPersonId = selectedTimesheetPerson?.id || "";
  const timesheetDates = monthDates(timesheetMonth);
  const timesheetWeeks = chunkWeeks(timesheetDates);
  const timesheetRecords = attendanceRecords.filter(r => r.employeeId === selectedPersonId && r.date.startsWith(timesheetMonth));
  const timesheetLunchRecords = lunchRecords.filter(r => r.employeeId === selectedPersonId && r.date.startsWith(timesheetMonth));
  const recordHours = (r: AttendanceRecord) => r.status === "abierto" ? hoursBetween(r.entryTime, new Date().toISOString()) : (Number(r.hoursWorked) || 0);
  const grossHoursForDate = (date: string) => timesheetRecords.filter(r => r.date === date).reduce((sum, r) => sum + recordHours(r), 0);
  const lunchMinutesForDate = (date: string) => lunchMinutesFromRecords(timesheetLunchRecords.filter(r => r.date === date));
  const hoursForDate = (date: string) => netHours(grossHoursForDate(date), lunchMinutesForDate(date));
  const recordsForDate = (date: string) => timesheetRecords.filter(r => r.date === date).sort((a, b) => a.entryTime.localeCompare(b.entryTime));
  const q1Hours = timesheetDates.filter(d => Number(d.slice(8, 10)) <= 15).reduce((sum, d) => sum + hoursForDate(d), 0);
  const q2Hours = timesheetDates.filter(d => Number(d.slice(8, 10)) > 15).reduce((sum, d) => sum + hoursForDate(d), 0);
  const q1LunchMinutes = timesheetDates.filter(d => Number(d.slice(8, 10)) <= 15).reduce((sum, d) => sum + lunchMinutesForDate(d), 0);
  const q2LunchMinutes = timesheetDates.filter(d => Number(d.slice(8, 10)) > 15).reduce((sum, d) => sum + lunchMinutesForDate(d), 0);
  const monthHours = q1Hours + q2Hours;
  const monthLunchMinutes = q1LunchMinutes + q2LunchMinutes;
  const hourlyRate = Math.max(0, Number(hourlyRateInput) || 0);
  const confirmationFor = (period: PayrollPeriod) => payrollConfirmationFor(payrollConfirmations, selectedPersonId, timesheetMonth, period);
  const timeValue = (iso?: string) => iso ? new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  const saveAttendanceTime = (record: AttendanceRecord, field: "entryTime" | "exitTime", value: string) => {
    if (!value || !onSaveAttendanceRecord) return;
    const next = { ...record, [field]: parseLocalDateTime(record.date, value).toISOString() } as AttendanceRecord;
    if (next.exitTime && new Date(next.exitTime).getTime() < new Date(next.entryTime).getTime()) {
      alert("La salida no puede quedar antes de la entrada.");
      return;
    }
    onSaveAttendanceRecord(next);
  };
  const saveAttendanceHours = (record: AttendanceRecord, value: string) => {
    if (!onSaveAttendanceRecord) return;
    const hours = Math.max(0, Number(value) || 0);
    const exit = new Date(record.entryTime);
    exit.setMinutes(exit.getMinutes() + Math.round(hours * 60));
    onSaveAttendanceRecord({ ...record, exitTime: exit.toISOString(), hoursWorked: hours, status: "cerrado_manual" });
  };
  const saveLunchTime = (record: LunchRecord, field: "startTime" | "endTime", value: string) => {
    if (!value || !onSaveLunchRecord) return;
    const next = { ...record, [field]: parseLocalDateTime(record.date, value).toISOString() } as LunchRecord;
    if (next.endTime && new Date(next.endTime).getTime() < new Date(next.startTime).getTime()) {
      alert("El regreso de almuerzo no puede quedar antes del inicio.");
      return;
    }
    onSaveLunchRecord(next);
  };
  const saveLunchMinutes = (record: LunchRecord, value: string) => {
    if (!onSaveLunchRecord) return;
    const minutes = Math.max(0, Number(value) || 0);
    const end = new Date(record.startTime);
    end.setMinutes(end.getMinutes() + minutes);
    onSaveLunchRecord({ ...record, endTime: end.toISOString(), minutes, status: "cerrado" });
  };
  const createManualAttendance = () => {
    if (!editingDate || !selectedTimesheetPerson || !onSaveAttendanceRecord) return;
    const entryTime = parseLocalDateTime(editingDate, manualEntry).toISOString();
    const exitTime = parseLocalDateTime(editingDate, manualExit).toISOString();
    if (new Date(exitTime).getTime() < new Date(entryTime).getTime()) {
      alert("La salida no puede quedar antes de la entrada.");
      return;
    }
    const nowIso = new Date().toISOString();
    onSaveAttendanceRecord({
      id: `${selectedPersonId}-${editingDate}-manual-${Date.now().toString(36)}`,
      employeeId: selectedPersonId,
      employeeName: selectedTimesheetPerson.name,
      date: editingDate,
      entryTime,
      exitTime,
      hoursWorked: hoursBetween(entryTime, exitTime),
      status: "cerrado_manual",
      observations: manualObservation || "Registro creado por admin",
      correctedBy: "admin",
      correctedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    setManualObservation("");
  };
  const createManualLunch = () => {
    if (!editingDate || !selectedTimesheetPerson || !onSaveLunchRecord) return;
    const startTime = parseLocalDateTime(editingDate, manualLunchStart).toISOString();
    const endTime = parseLocalDateTime(editingDate, manualLunchEnd).toISOString();
    if (new Date(endTime).getTime() < new Date(startTime).getTime()) {
      alert("El regreso de almuerzo no puede quedar antes del inicio.");
      return;
    }
    const nowIso = new Date().toISOString();
    onSaveLunchRecord({
      id: `${selectedPersonId}-lunch-${editingDate}-manual-${Date.now().toString(36)}`,
      employeeId: selectedPersonId,
      employeeName: selectedTimesheetPerson.name,
      date: editingDate,
      startTime,
      endTime,
      minutes: minutesBetween(startTime, endTime),
      status: "cerrado",
      observations: manualObservation || "Almuerzo creado por admin",
      correctedBy: "admin",
      correctedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    setManualObservation("");
  };
  const confirmPeriod = (period: PayrollPeriod) => {
    if (!selectedTimesheetPerson || !onConfirmPayroll) return;
    if (!hourlyRate) {
      alert("Define primero el valor de referencia para confirmar el corte.");
      return;
    }
    const { fromDate, toDate } = payrollPeriodRange(timesheetMonth, period);
    const dates = timesheetDates.filter(d => d >= fromDate && d <= toDate);
    const hours = dates.reduce((sum, date) => sum + hoursForDate(date), 0);
    const lunchMinutes = dates.reduce((sum, date) => sum + lunchMinutesForDate(date), 0);
    const amount = Math.round(hours * hourlyRate);
    if (!window.confirm(`Confirmar ${payrollPeriodLabel(period)} de ${selectedTimesheetPerson.name}: ${fmtHours(hours)} por ${money(amount)}?`)) return;
    const nowIso = new Date().toISOString();
    onConfirmPayroll({
      id: payrollConfirmationId(selectedPersonId, timesheetMonth, period),
      employeeId: selectedPersonId,
      employeeName: selectedTimesheetPerson.name,
      month: timesheetMonth,
      period,
      fromDate,
      toDate,
      hours,
      lunchMinutes,
      hourlyRate,
      amount,
      status: "confirmada",
      confirmedAt: nowIso,
      confirmedBy: "admin",
      updatedAt: nowIso,
    });
  };
  const timesheetMonthLabel = `${MONTH_NAMES_ES[Number(timesheetMonth.slice(5, 7)) - 1]} ${timesheetMonth.slice(0, 4)}`;
  const monthRegisteredDays = timesheetDates.filter(d => recordsForDate(d).length || lunchMinutesForDate(d)).length;
  const payrollCuts: Array<{ period: PayrollPeriod; label: string; hours: number; lunchMinutes: number; amount: number; confirmation?: PayrollConfirmation; fromDate: string; toDate: string }> = (["q1", "q2"] as PayrollPeriod[]).map(period => {
    const range = payrollPeriodRange(timesheetMonth, period);
    const hours = period === "q1" ? q1Hours : q2Hours;
    const lunchMinutes = period === "q1" ? q1LunchMinutes : q2LunchMinutes;
    return {
      period,
      label: payrollPeriodLabel(period),
      hours,
      lunchMinutes,
      amount: Math.round(hours * hourlyRate),
      confirmation: confirmationFor(period),
      ...range,
    };
  });

  return (
    <div className="fade-in" style={{ padding: 18 }}>
      <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 16 }}>INICIO DÍA · REGISTROS DE ACTIVIDAD</div>
      <div className="shift-grid" style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 14 }}>
        <div className="stack gap-3">

          <div className="sk-box p-4">
            <div className="row between" style={{ gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <div className="sk-mono text-xs tracked muted">RESUMEN MENSUAL</div>
                <div className="sk-title text-xl">{selectedTimesheetPerson?.name || "Equipo"} · {MONTH_NAMES_ES[Number(timesheetMonth.slice(5, 7)) - 1]} {timesheetMonth.slice(0, 4)}</div>
              </div>
              <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                <select className="field-input" value={selectedPersonId} onChange={e => setTimesheetPersonId(e.target.value)} style={{ minWidth: 150, padding: "6px 10px" }}>
                  {team.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input className="field-input" type="month" value={timesheetMonth} onChange={e => setTimesheetMonth(e.target.value)} style={{ width: 138, padding: "6px 10px" }} />
                <input className="field-input" type="number" min={0} inputMode="numeric" value={hourlyRateInput} onChange={e => setHourlyRateInput(e.target.value)} style={{ width: 110, padding: "6px 10px" }} title="Valor referencia" />
              </div>
            </div>
            <div className="payroll-mobile-panel">
              <div style={{ marginBottom: 8 }}>
                <div className="sk-mono text-xs tracked muted">Nómina móvil</div>
                <div className="sk-title text-xl">{selectedTimesheetPerson?.name || "Equipo"} · {timesheetMonthLabel}</div>
              </div>
              <div className="payroll-stat-grid">
                <div className="payroll-stat-card primary">
                  <div className="payroll-stat-label">Neto mes</div>
                  <div className="payroll-stat-value">{fmtHours(monthHours)}</div>
                  <div className="payroll-stat-note">{monthRegisteredDays} dia(s) con registro</div>
                </div>
                <div className="payroll-stat-card lunch">
                  <div className="payroll-stat-label">Almuerzos</div>
                  <div className="payroll-stat-value">{fmtMinutes(monthLunchMinutes)}</div>
                  <div className="payroll-stat-note">Descontado del tiempo</div>
                </div>
                <div className="payroll-stat-card">
                  <div className="payroll-stat-label">Valor referencia</div>
                  <div className="payroll-stat-value">{money(hourlyRate)}</div>
                  <div className="payroll-stat-note">Por hora</div>
                </div>
              </div>
              <div className="payroll-cut-grid">
                {payrollCuts.map(cut => {
                  const conf = cut.confirmation;
                  const review = conf?.status === "requiere_revision";
                  return (
                    <div key={cut.period} className={`payroll-cut-card ${conf?.status === "confirmada" ? "confirmed" : review ? "review" : ""}`}>
                      <div className="payroll-cut-title">
                        <div>
                          <strong>{cut.label}</strong>
                          <div className="payroll-cut-meta">{cut.fromDate} a {cut.toDate}</div>
                        </div>
                        <span className={conf?.status === "confirmada" ? "chip done-chip" : review ? "chip" : "chip dash"} style={{ fontSize: 10 }}>
                          {conf?.status === "confirmada" ? "confirmado" : review ? "revisar" : "pendiente"}
                        </span>
                      </div>
                      <div className="payroll-cut-lines">
                        <div className="payroll-cut-line">
                          <div className="payroll-stat-label">Horas</div>
                          <div className="sk-mono" style={{ fontWeight: 800 }}>{fmtHours(cut.hours)}</div>
                        </div>
                        <div className="payroll-cut-line">
                          <div className="payroll-stat-label">Almuerzo</div>
                          <div className="sk-mono" style={{ fontWeight: 800 }}>{fmtMinutes(cut.lunchMinutes)}</div>
                        </div>
                        <div className="payroll-cut-line">
                          <div className="payroll-stat-label">Total</div>
                          <div className="sk-mono" style={{ fontWeight: 800 }}>{money(cut.amount)}</div>
                        </div>
                        <div className="payroll-cut-line">
                          <div className="payroll-stat-label">Guardado</div>
                          <div className="sk-mono" style={{ fontWeight: 800 }}>{conf ? money(conf.amount) : "--"}</div>
                        </div>
                      </div>
                      <button className="action accent" style={{ width: "100%", fontSize: 12 }} onClick={() => confirmPeriod(cut.period)}>
                        Confirmar {cut.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="payroll-mobile-days">
              {timesheetWeeks.map((week, wi) => {
                const weekHours = week.reduce((sum, date) => sum + hoursForDate(date), 0);
                const weekLunch = week.reduce((sum, date) => sum + lunchMinutesForDate(date), 0);
                return (
                  <div key={`mobile-${week[0]}`} className="payroll-week-card">
                    <div className="payroll-week-head">
                      <div>
                        <div className="sk-mono text-xs tracked muted">Semana {wi + 1}</div>
                        <div style={{ fontWeight: 800 }}>{dateLabelEs(week[0])} - {dateLabelEs(week[week.length - 1])}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="sk-mono" style={{ fontWeight: 900 }}>{fmtHours(weekHours)}</div>
                        <div className="sk-mono text-xs muted">{fmtMinutes(weekLunch)} almuerzo</div>
                      </div>
                    </div>
                    {week.map(date => {
                      const dayRecords = recordsForDate(date);
                      const first = dayRecords[0];
                      const last = dayRecords[dayRecords.length - 1];
                      const dayHours = hoursForDate(date);
                      const lunchMinutes = lunchMinutesForDate(date);
                      return (
                        <div key={`mobile-${date}`} className={`payroll-day-card ${dayHours ? "has-hours" : ""}`}>
                          <div>
                            <div className="payroll-day-date">{dateLabelEs(date)} - {dayLabelEs(date)}</div>
                            <div className="payroll-day-meta">
                              Inicio {first ? fmtHour(first.entryTime) : "--"} · Cierre {last?.exitTime ? fmtHour(last.exitTime) : first?.status === "abierto" ? "abierto" : "--"}
                            </div>
                          </div>
                          <div className="payroll-day-values">
                            <span className={dayHours ? "chip accent" : "chip dash"}>{dayHours ? fmtHours(dayHours) : "sin horas"}</span>
                            {!!lunchMinutes && <span className="chip lunch">{fmtMinutes(lunchMinutes)}</span>}
                            <button className="action" style={{ fontSize: 11, minHeight: 30, padding: "4px 10px" }} onClick={() => setEditingDate(date)}>Editar</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
            <div className="payroll-table-scroll" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <div style={{ minWidth: 720 }}>
                <div className="row gap-2" style={{ marginBottom: 10, flexWrap: "wrap" }}>
                  <span className="chip">NETO MES {fmtHours(monthHours)}</span>
                  <span className="chip lunch">ALMUERZO {monthLunchMinutes} min</span>
                  <span className="chip" style={{ background: "#d9ead3", borderColor: "#93c47d", color: "#274e13" }}>CORTE 1 NETO {fmtHours(q1Hours)} · {q1LunchMinutes} min almuerzo · {money(q1Hours * hourlyRate)}</span>
                  <span className="chip" style={{ background: "#ead1dc", borderColor: "#c27ba0", color: "#741b47" }}>CORTE 2 NETO {fmtHours(q2Hours)} · {q2LunchMinutes} min almuerzo · {money(q2Hours * hourlyRate)}</span>
                </div>
                <div className="row gap-2" style={{ marginBottom: 12, flexWrap: "wrap" }}>
                  {(["q1", "q2"] as PayrollPeriod[]).map(period => {
                    const conf = confirmationFor(period);
                    return (
                      <div key={period} className="row gap-2" style={{ flexWrap: "wrap" }}>
                        <button className="action accent" style={{ fontSize: 11 }} onClick={() => confirmPeriod(period)}>
                          Confirmar {period === "q1" ? "Q1" : "Q2"}
                        </button>
                        <span className="chip" style={{
                          background: conf?.status === "confirmada" ? "rgba(76,175,80,.12)" : conf?.status === "requiere_revision" ? "rgba(232,160,32,.16)" : "var(--paper-2)",
                          borderColor: conf?.status === "confirmada" ? "#4caf50" : conf?.status === "requiere_revision" ? "#e8a020" : "var(--line)",
                          color: conf?.status === "confirmada" ? "#2e7d32" : conf?.status === "requiere_revision" ? "#9a5a00" : "var(--ink-3)",
                        }}>
                          {period === "q1" ? "Q1" : "Q2"} {conf ? `${conf.status === "confirmada" ? "confirmada" : "revisar"} - ${fmtHours(conf.hours)} - ${money(conf.amount)}` : "sin confirmar"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {timesheetWeeks.map((week, wi) => {
                  const firstDay = Number(week[0].slice(8, 10));
                  const secondHalf = firstDay > 15;
                  const weekHours = week.reduce((sum, date) => sum + hoursForDate(date), 0);
                  const headerBg = secondHalf ? "#d5a6bd" : "#f9cb9c";
                  const weekBg = secondHalf ? "#ff00ff" : "#00ff00";
                  const dateBg = secondHalf ? "#93c47d" : "#a4c2f4";
                  return (
                    <div key={week[0]} style={{ marginBottom: 12, border: "1.4px solid #111", background: "#fff" }}>
                      <div className="sk-mono" style={{ background: weekBg, color: "#111", fontWeight: 900, padding: "5px 8px", borderBottom: "1.4px solid #111" }}>SEMANA {wi + 1}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr .8fr .8fr .85fr .7fr .7fr .65fr", borderBottom: "1.4px solid #111" }}>
                        {["FECHA", "DIA", "INICIO", "CIERRE", "ALMUERZO MIN", "TIEMPO NETO", "TOTAL", "EDITAR"].map(label => (
                          <div key={label} className="sk-mono text-xs" style={{ background: headerBg, color: "#111", fontWeight: 900, padding: "6px 8px", borderRight: "1.2px solid #111", textAlign: "center" }}>{label}</div>
                        ))}
                      </div>
                      {week.map((date, di) => {
                        const dayRecords = recordsForDate(date);
                        const first = dayRecords[0];
                        const last = dayRecords[dayRecords.length - 1];
                        const dayHours = hoursForDate(date);
                        const lunchMinutes = lunchMinutesForDate(date);
                        const isSunday = dayLabelEs(date) === "DOMINGO";
                        return (
                          <div key={date} style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr .8fr .8fr .85fr .7fr .7fr .65fr", minHeight: 34, borderBottom: di === week.length - 1 ? 0 : "1px solid #111", outline: editingDate === date ? "2px solid var(--accent)" : "none", outlineOffset: -2 }}>
                            <div className="sk-mono text-xs" style={{ background: dateBg, color: "#111", fontWeight: 800, padding: "7px 8px", borderRight: "1px solid #111" }}>{dateLabelEs(date)}</div>
                            <div className="sk-mono text-xs" style={{ background: isSunday ? "#d9d2e9" : "#fff", color: "#111", padding: "7px 8px", borderRight: "1px solid #111", textAlign: "center" }}>{dayLabelEs(date)}</div>
                            <div className="sk-mono text-xs" style={{ color: "#111", padding: "7px 8px", borderRight: "1px solid #111", textAlign: "center" }}>{first ? fmtHour(first.entryTime) : ""}</div>
                            <div className="sk-mono text-xs" style={{ color: "#111", padding: "7px 8px", borderRight: "1px solid #111", textAlign: "center" }}>{last?.exitTime ? fmtHour(last.exitTime) : first?.status === "abierto" ? "ABIERTO" : ""}</div>
                            <div className="sk-mono text-xs" style={{ color: "#111", padding: "7px 8px", borderRight: "1px solid #111", textAlign: "center", fontWeight: lunchMinutes ? 800 : 500 }}>{lunchMinutes || ""}</div>
                            <div className="sk-mono text-xs" style={{ color: "#111", padding: "7px 8px", borderRight: "1px solid #111", textAlign: "center", fontWeight: 800 }}>{dayHours ? dayHours.toFixed(1) : ""}</div>
                            <div className="sk-mono text-xs" style={{ color: "#111", padding: "7px 8px", textAlign: "center", fontWeight: di === week.length - 1 ? 900 : 500 }}>{di === week.length - 1 ? weekHours.toFixed(1) : ""}</div>
                            <div className="sk-mono text-xs" style={{ color: "#111", padding: "4px 6px", textAlign: "center" }}>
                              <button className="action" style={{ fontSize: 10, padding: "2px 7px" }} onClick={() => setEditingDate(date)}>editar</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {editingDate && (
                  <div className="sk-box p-3" style={{ marginTop: 12, borderColor: "var(--accent)", borderWidth: 2, background: "var(--paper-2)" }}>
                    <div className="row between" style={{ gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                      <div>
                        <div className="sk-mono text-xs tracked muted">EDITOR DE CORTE</div>
                        <div className="sk-title text-lg">{selectedTimesheetPerson?.name} - {dateLabelEs(editingDate)} - {dayLabelEs(editingDate)}</div>
                      </div>
                      <button className="action" style={{ fontSize: 11 }} onClick={() => setEditingDate("")}>Cerrar</button>
                    </div>
                    <div className="stack gap-2">
                      {recordsForDate(editingDate).length ? recordsForDate(editingDate).map(r => (
                        <div key={`${r.id}-${r.updatedAt || r.exitTime || r.entryTime}`} className="row gap-2" style={{ flexWrap: "wrap", alignItems: "center", padding: "8px 0", borderBottom: "1px dashed var(--line)" }}>
                          <span className="sk-mono text-xs" style={{ minWidth: 78 }}>Registro</span>
                          <label className="sk-mono text-xs">Inicio <input type="time" defaultValue={timeValue(r.entryTime)} onBlur={e => saveAttendanceTime(r, "entryTime", e.target.value)} style={{ width: 86, marginLeft: 4, padding: "4px 6px" }} /></label>
                          <label className="sk-mono text-xs">Cierre <input type="time" defaultValue={timeValue(r.exitTime)} onBlur={e => saveAttendanceTime(r, "exitTime", e.target.value)} style={{ width: 86, marginLeft: 4, padding: "4px 6px" }} /></label>
                          <label className="sk-mono text-xs">Tiempo <input type="number" min={0} step="0.25" defaultValue={recordHours(r).toFixed(2)} onBlur={e => saveAttendanceHours(r, e.target.value)} style={{ width: 76, marginLeft: 4, padding: "4px 6px" }} /></label>
                          <span className="chip" style={{ fontSize: 11 }}>{r.status === "abierto" ? "abierto" : fmtHours(recordHours(r))}</span>
                          {r.correctedAt && <span className="sk-mono text-xs muted">corregido {new Date(r.correctedAt).toLocaleDateString("es-CO")}</span>}
                        </div>
                      )) : (
                        <div className="placeholder" style={{ padding: 12, borderRadius: 8 }}>Sin registro para este dia.</div>
                      )}
                      {timesheetLunchRecords.filter(r => r.date === editingDate).length ? timesheetLunchRecords.filter(r => r.date === editingDate).map(r => (
                        <div key={`${r.id}-${r.updatedAt || r.endTime || r.startTime}`} className="row gap-2" style={{ flexWrap: "wrap", alignItems: "center", padding: "8px 0", borderBottom: "1px dashed var(--line)" }}>
                          <span className="sk-mono text-xs" style={{ minWidth: 78 }}>Almuerzo</span>
                          <label className="sk-mono text-xs">Inicio <input type="time" defaultValue={timeValue(r.startTime)} onBlur={e => saveLunchTime(r, "startTime", e.target.value)} style={{ width: 86, marginLeft: 4, padding: "4px 6px" }} /></label>
                          <label className="sk-mono text-xs">Regreso <input type="time" defaultValue={timeValue(r.endTime)} onBlur={e => saveLunchTime(r, "endTime", e.target.value)} style={{ width: 86, marginLeft: 4, padding: "4px 6px" }} /></label>
                          <label className="sk-mono text-xs">Min <input type="number" min={0} step="5" defaultValue={r.status === "abierto" ? minutesBetween(r.startTime, new Date().toISOString()) : (Number(r.minutes) || 0)} onBlur={e => saveLunchMinutes(r, e.target.value)} style={{ width: 70, marginLeft: 4, padding: "4px 6px" }} /></label>
                          <span className={r.status === "abierto" ? "chip lunch" : "chip"} style={{ fontSize: 11 }}>{r.status === "abierto" ? "abierto" : fmtMinutes(Number(r.minutes) || 0)}</span>
                        </div>
                      )) : (
                        <div className="sk-mono text-xs muted">Sin almuerzo registrado para este dia.</div>
                      )}
                      <div className="sk-box tight p-3" style={{ marginTop: 8 }}>
                        <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 8 }}>CREAR REGISTRO MANUAL</div>
                        <div className="row gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                          <label className="sk-mono text-xs">Inicio <input type="time" value={manualEntry} onChange={e => setManualEntry(e.target.value)} style={{ width: 86, marginLeft: 4, padding: "4px 6px" }} /></label>
                          <label className="sk-mono text-xs">Cierre <input type="time" value={manualExit} onChange={e => setManualExit(e.target.value)} style={{ width: 86, marginLeft: 4, padding: "4px 6px" }} /></label>
                          <button className="action ink" style={{ fontSize: 11 }} onClick={createManualAttendance}>Crear registro</button>
                          <label className="sk-mono text-xs">Almuerzo <input type="time" value={manualLunchStart} onChange={e => setManualLunchStart(e.target.value)} style={{ width: 86, marginLeft: 4, padding: "4px 6px" }} /></label>
                          <label className="sk-mono text-xs">Regreso <input type="time" value={manualLunchEnd} onChange={e => setManualLunchEnd(e.target.value)} style={{ width: 86, marginLeft: 4, padding: "4px 6px" }} /></label>
                          <button className="action lunch-btn" style={{ fontSize: 11 }} onClick={createManualLunch}>Crear almuerzo</button>
                          <input className="field-input" value={manualObservation} onChange={e => setManualObservation(e.target.value)} placeholder="Nota del ajuste" style={{ minWidth: 190, flex: 1, padding: "5px 8px" }} />
                        </div>
                        <div className="text-xs muted" style={{ marginTop: 8 }}>Si una quincena ya estaba confirmada, cualquier ajuste la marca como pendiente de revision para reconfirmarla.</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ahora mismo */}
          <div className="sk-box p-4">
            <div className="row between">
              <div className="sk-title text-xl">Ahora mismo</div>
              <span className="sk-mono text-xs muted">{nowStr}</span>
            </div>
            <hr className="sk-hr wavy" />
            <div className="row gap-3" style={{ flexWrap: "wrap" }}>
              {team.map(p => {
                const isIn = !!shiftState[p.id];
                const isOnLunch = isIn && (!!empLunch[p.id] || (!!lunchState && p.id === "s"));
                return (
                <div key={p.id} className={`sk-box tight p-3 capital-status-card ${isOnLunch ? "state-lunch" : isIn ? "state-in" : "state-off"}`} style={{ flex: 1, minWidth: 160 }}>
                  <div className="row gap-2">
                    <Av p={p} size="sm" state={isIn ? (isOnLunch ? "lunch" : "busy") : null} />
                    <div className="stack" style={{ gap: 0 }}>
                      <span className="text-sm" style={{ fontWeight: 700 }}>{p.name}</span>
                      <span className="sk-mono text-xs muted">
                        {isIn ? (isOnLunch ? "almuerzo" : `${fmtTime(getElapsed(shiftState[p.id]))} registradas`) : "día sin iniciar"}
                      </span>
                    </div>
                  </div>
                  <hr className="sk-hr dashed" />
                  <div className="sk-mono text-xs muted">
                    {typeof shiftState[p.id] === "string" ? `INICIO ${fmtHour(shiftState[p.id] as string)}` : "— sin iniciar —"}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {!isIn ? (
                      <button className="action accent" style={{ width: "100%", fontSize: 12 }} onClick={() => onStartAttendance ? onStartAttendance(p) : setShiftState(s => ({ ...s, [p.id]: new Date().toISOString() }))}>
                        <Icon d={I.in} size={14} /> INICIAR DÍA
                      </button>
                    ) : (
                      <button className="action ink" style={{ width: "100%", fontSize: 12 }} onClick={() => onCloseAttendance ? onCloseAttendance(p) : setShiftState(s => ({ ...s, [p.id]: false }))}>
                        <Icon d={I.out} size={14} /> CERRAR DÍA
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          </div>

          {/* Eventos del día */}
          <div className="sk-box p-4">
            <div className="row between">
              <div className="sk-title text-xl">Registros de hoy</div>
              <span className="sk-mono text-xs muted">{new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}</span>
            </div>
            <hr className="sk-hr dashed" />
            {team.filter(p => shiftState[p.id]).length === 0 && todayRecords.length === 0 && (
              <div className="sk-mono text-xs muted" style={{ padding: "12px 0" }}>— Nadie ha iniciado el día hoy —</div>
            )}
            {todayRecords.filter(r => r.status !== "abierto").map(r => {
              const p = team.find(m => m.id === r.employeeId) || { id: r.employeeId, name: r.employeeName || r.employeeId };
              const isAuto = r.status === "cerrado_automatico";
              return (
                <div key={r.id} className="row gap-3" style={{ padding: "10px 0", borderBottom: "1.2px dashed var(--line)", alignItems: "center" }}>
                  <Av p={p} size="xs" />
                  <div style={{ flex: 1 }}>
                    <div className="text-sm" style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="sk-mono text-xs muted">Inicio {fmtHour(r.entryTime)} · Cierre {r.exitTime ? fmtHour(r.exitTime) : "—"} · {fmtHours(r.hoursWorked)}</div>
                    {r.observations && <div className="text-xs" style={{ color: isAuto ? "#c0392b" : "var(--ink-3)" }}>{r.observations}</div>}
                  </div>
                  <span className="chip" style={{ background: isAuto ? "rgba(192,57,43,.08)" : "rgba(76,175,80,.1)", color: isAuto ? "#c0392b" : "#2e7d32", borderColor: isAuto ? "#c0392b" : "#4caf50", fontSize: 11 }}>
                    {isAuto ? "cierre automático" : "cerrado"}
                  </span>
                  {r.exitTime && onCorrectAttendanceExit && (
                    <input
                      type="time"
                      defaultValue={new Date(r.exitTime).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false })}
                      onBlur={e => e.target.value && onCorrectAttendanceExit(r.id, e.target.value)}
                      title="Corregir hora de cierre"
                      style={{ width: 84, border: "1.2px solid var(--line)", borderRadius: 7, padding: "4px 6px", background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--mono)", fontSize: 11 }}
                    />
                  )}
                </div>
              );
            })}
            {team.filter(p => shiftState[p.id]).map(p => {
              const entryTime = typeof shiftState[p.id] === "string" ? fmtHour(shiftState[p.id] as string) : "—";
              const elapsed = fmtTime(getElapsed(shiftState[p.id]));
              const isOnLunch = !!empLunch[p.id] || (lunchState && p.id === "s");
              return (
                <div key={p.id} className="row gap-3" style={{ padding: "10px 0", borderBottom: "1.2px dashed var(--line)" }}>
                  <Av p={p} size="xs" state={isOnLunch ? "lunch" : "busy"} />
                  <div style={{ flex: 1 }}>
                    <div className="text-sm" style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="sk-mono text-xs muted">Inicio {entryTime} · {elapsed} registradas</div>
                  </div>
                  <span className="chip" style={{ background: isOnLunch ? "var(--lunch-soft)" : "var(--accent-soft)", color: isOnLunch ? "var(--lunch)" : "var(--accent)", borderColor: isOnLunch ? "var(--lunch)" : "var(--accent)", fontSize: 11 }}>
                    {isOnLunch ? "ALMUERZO" : "DÍA INICIADO"}
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
              {team.map((p, i) => {
                const records = weeklyRecords.filter(r => r.employeeId === p.id);
                const lunchMinutes = lunchMinutesFromRecords(lunchRecords.filter(r => r.employeeId === p.id && r.date >= weekStart && r.date <= today));
                const hours = netHours(records.reduce((sum, r) => sum + (r.status === "abierto" ? hoursBetween(r.entryTime, new Date().toISOString()) : (Number(r.hoursWorked) || 0)), 0), lunchMinutes);
                const autoClosed = records.filter(r => r.status === "cerrado_automatico").length;
                return (
                <div key={p.id} className="stack" style={{ flex: 1 }}>
                  <div className="sk-mono text-xs muted">{p.name}</div>
                  <div className="list-row"><span>Tiempo neto</span><span className="sk-mono">{fmtHours(hours)}</span></div>
                  <div className="list-row"><span>Registros</span><span className="sk-mono">{records.length}</span></div>
                  <div className="list-row"><span>Cierres auto</span><span className="sk-mono" style={{ color: autoClosed ? "#c0392b" : "var(--ink-3)" }}>{autoClosed}</span></div>
                  <MiniBars n={5} w={160} h={26} seed={i * 3 + 1} />
                </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar notificaciones */}
        <div className="stack gap-3">
          <div className="sk-box p-3" style={{ borderColor: "var(--accent)", borderWidth: 2 }}>
            <div className="sk-mono text-xs tracked muted">NOTIFICACIONES</div>
            <hr className="sk-hr dashed" />
            {["Inicio / cierre", "Inicio almuerzo", "Vuelta almuerzo", "Retraso >15 min", "Registro pendiente"].map((label, i) => (
              <div key={i} className="row gap-2" style={{ marginTop: 8 }}>
                <Check on={i < 3} /><span className="text-xs" style={{ whiteSpace: "nowrap" }}>{label}</span>
              </div>
            ))}
          </div>
          <div className="sk-box p-3 fill">
            <div className="sk-mono text-xs tracked muted">RESUMEN HOY</div>
            <div className="list-row" style={{ marginTop: 4 }}><span>Tiempo neto</span><span className="sk-mono">{fmtHours(todayPresenceHours)}</span></div>
            <div className="list-row"><span>Almuerzo</span><span className="sk-mono">{todayLunchMinutes} min</span></div>
            <div className="list-row"><span>Registros</span><span className="sk-mono">{todayRecords.length}</span></div>
            <div className="list-row"><span>Cierres auto</span><span className="sk-mono" style={{ color: todayAutoClosed ? "#c0392b" : "var(--ink-3)" }}>{todayAutoClosed}</span></div>
          </div>
          <div className="sk-box dashed p-3 text-xs muted">
            Todo se registra automáticamente cuando Sergio o Cindy pulsan los botones · sin papeles.
          </div>
        </div>
      </div>

    </div>
  );
}
// ─── SECCIÓN: Integraciones ──────────────────────────────────────────────────
function IntegracionesSection({ loyverseToken = "", onSetLoyverseToken = (_: string) => {} }: { loyverseToken?: string; onSetLoyverseToken?: (t: string) => void }) {
  const [tokenInput, setTokenInput] = useState(loyverseToken);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    setTokenInput(loyverseToken);
  }, [loyverseToken]);

  return (
    <div style={{ padding: "24px 20px", maxWidth: 560 }}>
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Integraciones</div>
      <div className="sk-mono" style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 24 }}>Conexiones con servicios externos usados en toda la app.</div>

      <div style={{ background: "var(--paper)", border: "1.4px solid var(--line)", borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ fontSize: 24 }}>🔗</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Loyverse POS</div>
            <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>Búsqueda de productos por código SKU · Envío de recibos abiertos</div>
          </div>
          <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: loyverseToken ? "rgba(76,175,80,.12)" : "rgba(192,57,43,.08)", color: loyverseToken ? "#2e7d32" : "#c0392b", border: `1px solid ${loyverseToken ? "#4caf50" : "#c0392b"}`, fontWeight: 600 }}>
            {loyverseToken ? "Conectado" : "Sin configurar"}
          </span>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10 }}>
          Token API de Loyverse. Genéralo en <strong>Loyverse → Perfil → API</strong>. Se guarda para que la app pueda buscar productos y enviar recibos.
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type={tokenVisible ? "text" : "password"}
            style={{ flex: 1, padding: "8px 10px", borderRadius: 7, border: "1.2px solid var(--line)", background: "var(--paper-2)", color: "var(--ink)", fontSize: 12, fontFamily: "var(--mono)" }}
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            placeholder="Pega tu token aquí..."
            onKeyDown={e => { if (e.key === "Enter") { const clean = normalizeLoyverseToken(tokenInput); setTokenInput(clean); onSetLoyverseToken(clean); alert(clean ? "✅ Token guardado." : "Token eliminado."); } }}
          />
          <button className="action" style={{ fontSize: 11 }} onClick={() => setTokenVisible(v => !v)}>{tokenVisible ? "Ocultar" : "Ver"}</button>
          <button className="action ink" style={{ fontSize: 11 }} onClick={() => { const clean = normalizeLoyverseToken(tokenInput); setTokenInput(clean); onSetLoyverseToken(clean); alert(clean ? "✅ Token guardado." : "Token eliminado."); }}>Guardar</button>
        </div>
        {loyverseToken && (
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button className="action" style={{ fontSize: 10 }} disabled={testingConnection} onClick={async () => {
              setTestingConnection(true);
              const clean = normalizeLoyverseToken(tokenInput || loyverseToken);
              const res = await testLoyverseConnection(clean);
              setTestingConnection(false);
              alert(res.success ? "✅ Conexión con Loyverse OK." : `❌ No se pudo conectar con Loyverse:\n${res.error}`);
            }}>{testingConnection ? "Probando..." : "Probar conexión"}</button>
            <button className="action" style={{ fontSize: 10, color: "#c0392b" }} onClick={() => { setTokenInput(""); onSetLoyverseToken(""); }}>Eliminar token</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SECCIÓN 3: Perfil ───────────────────────────────────────────────────────
function ProfileSection({ team = INITIAL_TEAM, extendedData = {}, onEditMember }: { team?: any[]; extendedData?: any; onEditMember?: any }) {
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
        <div className="profile-grid" style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20, padding: "16px 18px" }}>
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
              <div className="list-row"><span className="muted">referencia pago</span><span className="sk-mono">{extendedData[person.id]?.salario ? `€ ${extendedData[person.id].salario}` : "—"}</span></div>
              <div className="list-row"><span className="muted">tiempo/ref</span><span className="sk-mono">{extendedData[person.id]?.horasSemana || "—"}h</span></div>
              <div className="list-row"><span className="muted">PIN acceso</span><span className="sk-mono">{extendedData[person.id]?.pin || "—"}</span></div>
              <div className="list-row"><span className="muted">último cambio</span><span className="sk-mono text-xs">{extendedData[person.id]?.pinUpdatedAt ? new Date(extendedData[person.id].pinUpdatedAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—"}</span></div>
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
                <div className="stack"><div className="sk-mono text-3xl">4</div><div className="muted text-xs">almuerzos</div></div>
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
            {(extendedData[person.id]?.pinChangeLog || []).length > 0 && (
              <div className="sk-box p-4">
                <div className="sk-title text-xl">Cambios de PIN</div>
                <hr className="sk-hr dashed" />
                {(extendedData[person.id]?.pinChangeLog || []).slice(0, 5).map((entry: any, idx: number) => (
                  <div key={idx} className="list-row">
                    <span className="muted">{new Date(entry.at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}</span>
                    <span className="sk-mono">{entry.by === "employee" ? "colaborador" : "admin"} · {entry.from || "—"} → {entry.to || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : tab === "timeline" ? (
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
          <Ev t="09:15" what="Inició actividad en taller · registro" />
          <div className="sk-mono text-xs muted" style={{ padding: "14px 0 4px" }}>— lun 20 abr —</div>
          <Ev t="18:40" what="Cerró el día · 9h 17m" />
        </div>
      ) : null}
      {editOpen && onEditMember && (
        <EditMemberModal
          person={person}
          extData={extendedData[person.id] || {}}
          isPinAvailable={(pin: string, currentId: string) => !team.some((member: any) => member.id !== currentId && extendedData[member.id]?.pin && extendedData[member.id].pin === pin)}
          onClose={() => setEditOpen(false)}
          onSave={data => { onEditMember(person.id, data); setPerson(prev => ({ ...prev, name: data.name, role: data.role })); }}
        />
      )}
    </div>
  );
}

// ─── SECCIÓN 4: Tareas ───────────────────────────────────────────────────────
function TasksSection({ tasks, team, attendanceRecords = [], onToggle, onUpdate, onAssign }: { tasks: AppTask[]; team: any[]; attendanceRecords?: AttendanceRecord[]; onToggle: (id: string) => void; onUpdate: (id: string, changes: Partial<AppTask>) => void; onAssign: () => void }) {
  const [view, setView] = useState<"pendientes" | "historial">("pendientes");
  const [period, setPeriod] = useState<"dia" | "semana" | "mes">("semana");
  const [personFilter, setPersonFilter] = useState("");
  const getMember = (id: string) => team.find(m => m.id === id);
  const pending = tasks.filter(t => !t.done);
  const done    = tasks.filter(t => t.done);
  const today = _fmtDate(new Date());
  const range = (() => {
    const now = new Date();
    if (period === "dia") return { from: today, to: today };
    if (period === "mes") return { from: `${today.slice(0, 7)}-01`, to: today };
    const d = new Date(); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1);
    return { from: _fmtDate(d), to: today };
  })();
  const prodRows = productivityRows(team, tasks, attendanceRecords, { ...range, personId: personFilter || undefined });
  return (
    <div className="fade-in" style={{ flex: 1 }}>
      <div className="row gap-2 between" style={{ padding: "12px 18px", borderBottom: "1.4px dashed var(--line)", flexWrap: "wrap" }}>
        <div className="row gap-2">
          <button className={"action" + (view === "pendientes" ? " ink" : "")} onClick={() => setView("pendientes")}>Pendientes</button>
          <button className={"action" + (view === "historial" ? " ink" : "")} onClick={() => setView("historial")}>Historial</button>
        </div>
        <button className="action accent" style={{ fontSize: 12 }} onClick={onAssign}>+ Asignar tarea</button>
      </div>

      <div className="sk-box" style={{ margin: 16, padding: 14 }}>
        <div className="row between" style={{ gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <div>
            <div className="sk-title text-xl">Productividad del equipo</div>
            <div className="sk-mono text-xs muted">40% tareas · 25% puntualidad · 25% calidad · 10% puntos/tiempo</div>
          </div>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            {(["dia", "semana", "mes"] as const).map(p => <button key={p} className={"action" + (period === p ? " ink" : "")} style={{ fontSize: 11 }} onClick={() => setPeriod(p)}>{p === "dia" ? "día" : p}</button>)}
            <select value={personFilter} onChange={e => setPersonFilter(e.target.value)} className="field-input" style={{ width: 150, padding: "5px 8px", fontSize: 11 }}>
              <option value="">Todo el equipo</option>
              {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <div className="stack gap-2">
          {prodRows.map(row => (
            <div key={row.person.id} className="list-row" style={{ alignItems: "flex-start", gap: 10 }}>
              <span>
                <strong>{row.person.name}</strong>
                <span className="sk-mono text-xs muted" style={{ display: "block" }}>{fmtHours(row.hoursWorked)} · {row.completed}/{row.assigned} tareas · {row.completedPoints}/{row.assignedPoints} pts</span>
              </span>
              <span className="sk-mono text-xs" style={{ textAlign: "right" as const }}>
                <strong style={{ color: row.score >= 70 ? "#2e7d32" : row.score >= 50 ? "#9a6a00" : "#c0392b" }}>{row.score}%</strong>
                <span style={{ display: "block", color: "var(--ink-3)" }}>{row.generalStatus} · {row.productivityPerHour.toFixed(2)} pts/h</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {tasks.length === 0 && (
        <div className="placeholder" style={{ margin: 20, borderRadius: 12, padding: 40, textAlign: "center" }}>
          No hay tareas aún. Crea una con "Asignar tarea".
        </div>
      )}

      <div style={{ padding: "8px 0" }}>
        {(view === "pendientes" ? pending : done).map(t => {
          const member = getMember(t.assignedTo);
          return (
            <div key={t.id} className="task-item">
            <div className="row gap-3" style={{ minWidth: 0, flex: 1 }}>
                <div onClick={() => onToggle(t.id)} style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${t.done ? "var(--accent)" : "var(--line)"}`, background: t.done ? "var(--accent)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: "#fff", fontSize: 12 }}>{t.done && "✓"}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="text-sm" style={{ fontWeight: 700, textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.5 : 1 }}>{t.title}</div>
                  {t.description && <div className="text-xs muted" style={{ marginTop: 3, lineHeight: 1.35, whiteSpace: "pre-wrap" }}>{t.description}</div>}
                  <div className="row gap-2" style={{ marginTop: 5, flexWrap: "wrap" }}>
                    <span className="chip text-xs">{taskStatusLabel(t)}</span>
                    <span className="chip text-xs">Prioridad {taskPriority(t)}</span>
                    <span className="chip text-xs">{taskPoints(t)} pts</span>
                    {taskDueDate(t) && <span className="sk-mono text-xs muted">vence {taskDueDate(t)}</span>}
                    {t.evidence && <span className="sk-mono text-xs muted">evidencia: {t.evidence}</span>}
                  </div>
                </div>
              </div>
              <div className="row gap-2">
                <span className="chip text-xs">{t.tag}</span>
                {member && <Av p={member} size="xs" />}
                {member && <span className="sk-mono text-xs muted">{member.name}</span>}
                <label className="row gap-2" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                  <span className="sk-mono text-xs muted">Fecha</span>
                  <input
                    type="date"
                    value={t.date || today}
                    onChange={e => onUpdate(t.id, { date: e.target.value })}
                    style={{ border: "1.2px solid var(--line)", borderRadius: 7, padding: "4px 7px", background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--mono)", fontSize: 11 }}
                  />
                </label>
                <select
                  value={taskQuality(t)}
                  onChange={e => onUpdate(t.id, { qualityStatus: e.target.value as AppTask["qualityStatus"] })}
                  title="Validación de calidad"
                  style={{ border: "1.2px solid var(--line)", borderRadius: 7, padding: "4px 7px", background: "var(--paper)", color: "var(--ink)", fontFamily: "var(--mono)", fontSize: 11 }}
                >
                  <option value="pendiente">Calidad pendiente</option>
                  <option value="aprobado">Aprobado</option>
                  <option value="correccion">Corrección</option>
                  <option value="no_aprobado">No aprobado</option>
                </select>
              </div>
            </div>
          );
        })}
        {view === "pendientes" && pending.length === 0 && tasks.length > 0 && (
          <div style={{ textAlign: "center", padding: 32, color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 12 }}>✅ Todas las tareas pendientes fueron completadas</div>
        )}
        {view === "historial" && done.length === 0 && tasks.length > 0 && (
          <div style={{ textAlign: "center", padding: 32, color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 12 }}>Aún no hay tareas completadas en el historial</div>
        )}
      </div>
    </div>
  );
}

// ─── SECCIÓN 5: Calendario ───────────────────────────────────────────────────
function CalendarSection({ tasks, appointments, services, setTasks, setAppointments, onNewBikeService, onUpdateService, team, currentUserId, canViewGeneralCalendar = true }: {
  tasks: AppTask[]; appointments: Appointment[]; services: BikeService[];
  setTasks: (fn: (prev: AppTask[]) => AppTask[]) => void;
  setAppointments: (fn: (prev: Appointment[]) => Appointment[]) => void;
  onNewBikeService: (date: string) => void;
  onUpdateService?: (id: string, changes: Partial<BikeService>) => void;
  team: any[];
  currentUserId?: string;
  canViewGeneralCalendar?: boolean;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showApptModal, setShowApptModal] = useState(false);
  const [preDate, setPreDate] = useState<string | undefined>(undefined);
  const [editingTask, setEditingTask] = useState<AppTask | null>(null);
  const [editingSvc, setEditingSvc] = useState<BikeService | null>(null);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [expandedCalItems, setExpandedCalItems] = useState<Record<string, boolean>>({});
  const [calendarScope, setCalendarScope] = useState<"mine" | "general" | "person">(currentUserId ? "mine" : "general");
  const [personFilter, setPersonFilter] = useState(currentUserId || "");

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
  const canUseGeneral = !!canViewGeneralCalendar;
  const filterOwnerId = !canUseGeneral && currentUserId
    ? currentUserId
    : calendarScope === "mine"
      ? currentUserId
      : calendarScope === "person"
        ? personFilter
        : "";
  const visibleTasks = filterOwnerId ? tasks.filter(t => t.assignedTo === filterOwnerId) : tasks;
  const visibleAppointments = filterOwnerId ? appointments.filter(a => a.assignedTo === filterOwnerId) : appointments;
  const visibleServices = filterOwnerId ? services.filter(s => s.technicianId === filterOwnerId) : services;
  const visibleOwner = filterOwnerId ? team.find(p => p.id === filterOwnerId) : null;
  const scopeLabel = filterOwnerId ? `Calendario de ${visibleOwner?.name || "usuario"}` : "Calendario general";

  const openAdd = (dateStr: string, type: "task" | "appt") => {
    setPreDate(dateStr);
    type === "task" ? setShowTaskModal(true) : setShowApptModal(true);
  };
  const toggleCalItem = (id: string) => setExpandedCalItems(p => ({ ...p, [id]: !p[id] }));
  const minutesBetween = (start?: string, end?: string) => {
    if (!start || !end) return null;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return null;
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? mins : null;
  };
  const fmtDuration = (mins: number | null) => {
    if (!mins) return "";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
  };
  const serviceDurationLabel = (s: BikeService) => {
    const scheduled = minutesBetween(s.startTime, s.endTime);
    if (scheduled) return `Estimado ${fmtDuration(scheduled)}`;
    const start = s.createdAt || `${s.date}T00:00:00`;
    const end = s.completedAt || s.deliveredAt || new Date().toISOString();
    const mins = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
    if (mins >= 60) return `${s.completedAt || s.deliveredAt ? "Tomó" : "En taller"} ${fmtDuration(mins)}`;
    return "";
  };
  const timeToMins = (time?: string) => {
    if (!time) return null;
    const [h, m] = time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };
  const calendarHours = Array.from({ length: 14 }, (_, idx) => 7 + idx);
  const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
  const sortByTime = <T extends { start: number | null; label: string }>(items: T[]) =>
    [...items].sort((a, b) => (a.start ?? 1440) - (b.start ?? 1440) || a.label.localeCompare(b.label));

  const renderBikeEvent = (s: BikeService) => {
    const tech = team.find(p => p.id === s.technicianId);
    const phInfo = PHASES.find(ph => ph.id === s.phase);
    const urg = urgencyInfo(s.neededByDate);
    const duration = serviceDurationLabel(s);
    return (
      <div key={`svc-${s.id}`} className="cal-event ev-bici"
        title={`${s.clientName} · ${s.bikeDescription} - clic para editar`}
        onClick={() => onUpdateService && setEditingSvc(s)}
        style={{
          ...(s.phase === 4 ? { borderColor: "#4caf50", borderWidth: 2, background: "#ecf8ed" } :
              urg && urg.color === "#c0392b" ? { borderColor: "#c0392b", background: "#fdeeee" } : {}),
          cursor: onUpdateService ? "pointer" : "default",
        }}>
        {s.startTime && <div className="sk-mono text-xs" style={{ color: s.phase === 4 ? "#2e7d32" : "#6c1f6e" }}>{s.startTime}{s.endTime ? `-${s.endTime}` : ""}</div>}
        <div style={{ fontSize: 11, fontWeight: 700, color: s.phase === 4 ? "#1b5e20" : undefined }}>{s.clientName}</div>
        <div style={{ fontSize: 10, color: s.phase === 4 ? "#388e3c" : "#6c1f6e" }}>{s.bikeDescription}</div>
        <div style={{ fontSize: 10, color: s.phase === 4 ? "#4caf50" : "#9c4a9e", fontWeight: s.phase === 4 ? 700 : undefined }}>{s.phase === 0 ? "📋 Recibida" : `${phInfo?.icon} ${phInfo?.name}`}</div>
        {s.workshopStatus && s.phase < 4 && <div style={{ fontSize: 9, color: "#6c1f6e", fontFamily: "var(--mono)" }}>{serviceStatusLabel(s)}</div>}
        {s.serviceType && <div style={{ fontSize: 9, color: "var(--ink-3)" }}>🛠 {s.serviceType}</div>}
        {tech && <div style={{ fontSize: 10, color: s.phase === 4 ? "#4caf50" : "#9c4a9e" }}>🔧 {tech.name}</div>}
        {duration && <div className="sk-mono" style={{ fontSize: 9, color: "#7a5500" }}>⏱ {duration}</div>}
        {urg && s.phase < 4 && <div style={{ fontSize: 10, color: urg.color, fontWeight: 600 }}>{urg.label}</div>}
        {s.paymentStatus === "pagado" && <div style={{ fontSize: 10, color: "#2e7d32" }}>✅ Pagado</div>}
        {s.paymentStatus === "adelanto" && <div style={{ fontSize: 10, color: s.phase === 4 ? "#388e3c" : "#6c1f6e" }}>📤 {s.paymentAmount ? `$${s.paymentAmount.toLocaleString()}` : "Abono"}</div>}
        {ticketSummary(s).subtotal > 0 && <div style={{ fontSize: 10, color: "#2e7d32", fontFamily: "var(--mono)" }}>Ticket {money(ticketSummary(s).subtotal)}</div>}
        {onUpdateService && <div style={{ fontSize: 9, color: "var(--ink-3)", marginTop: 2 }}>editar fecha/hora</div>}
      </div>
    );
  };

  const renderTaskEvent = (t: AppTask) => {
    const person = team.find(p => p.id === t.assignedTo);
    return (
      <div key={`task-${t.id}`} className="cal-event ev-task" onClick={() => setEditingTask(t)} style={{ cursor: "pointer" }} title={`${t.title}${t.description ? ` · ${t.description}` : ""} · editar`}>
        <div className="sk-mono text-xs" style={{ color: "#1d4ed8" }}>
          {t.hasTime ? `${t.startTime}-${t.endTime}` : "todo el día"}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700 }}>{t.title}</div>
        {t.description && <div style={{ fontSize: 10, color: "#1d4ed8", marginTop: 2, lineHeight: 1.25, opacity: .85 }}>{t.description.length > 64 ? `${t.description.slice(0, 64)}...` : t.description}</div>}
        {person && <div style={{ fontSize: 10, color: "#3b82f6" }}>· {person.name}</div>}
        <div style={{ fontSize: 9, color: "var(--ink-3)", marginTop: 2 }}>abrir / editar</div>
      </div>
    );
  };

  const renderApptEvent = (a: Appointment) => {
    const person = team.find(p => p.id === a.assignedTo);
    const expanded = !!expandedCalItems[`appt-${a.id}`];
    const duration = fmtDuration(minutesBetween(a.startTime, a.endTime));
    return (
      <div key={`appt-${a.id}`} className="cal-event ev-appt"
        style={{ borderRadius: 6, padding: "3px 6px", marginBottom: 3, cursor: "pointer", fontSize: 11 }}
        onClick={() => toggleCalItem(`appt-${a.id}`)}
        title={`${a.client} · ${a.service} - desplegar`}>
        <div className="sk-mono text-xs" style={{ color: "#166534" }}>{a.startTime}{a.endTime ? `-${a.endTime}` : ""}</div>
        <div style={{ fontWeight: 700, color: "#14532d" }}>{a.client}</div>
        <div style={{ fontSize: 10, color: "#166534" }}>{a.service}</div>
        {duration && <div className="sk-mono" style={{ fontSize: 9, color: "#166534" }}>⏱ {duration}</div>}
        {expanded && (
          <div style={{ marginTop: 5, paddingTop: 5, borderTop: "1px dashed #22844a" }}>
            {person && <div style={{ fontSize: 10, color: "#15803d" }}>· {person.name}</div>}
            {a.notes && <div style={{ fontSize: 10, color: "var(--ink-3)" }}>{a.notes}</div>}
            <button type="button" className="action" style={{ marginTop: 5, fontSize: 10, padding: "2px 8px", background: "#fff", color: "#166534", borderColor: "#22844a" }}
              onClick={e => { e.stopPropagation(); setEditingAppt(a); }}>
              editar
            </button>
          </div>
        )}
        <div style={{ fontSize: 9, color: "#15803d", marginTop: 2 }}>{expanded ? "ocultar" : "desplegar"}</div>
      </div>
    );
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
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          {currentUserId && (
            <button
              type="button"
              className={"action" + (calendarScope === "mine" || !canUseGeneral ? " ink" : "")}
              style={{ fontSize: 11 }}
              onClick={() => setCalendarScope("mine")}
            >
              Mi calendario
            </button>
          )}
          {canUseGeneral && (
            <button
              type="button"
              className={"action" + (calendarScope === "general" ? " ink" : "")}
              style={{ fontSize: 11 }}
              onClick={() => setCalendarScope("general")}
            >
              General
            </button>
          )}
          {canUseGeneral && team.length > 0 && (
            <select
              value={calendarScope === "person" ? personFilter : ""}
              onChange={e => {
                setPersonFilter(e.target.value);
                if (e.target.value) setCalendarScope("person");
              }}
              className="field-input"
              style={{ width: "auto", minWidth: 150, padding: "4px 9px", fontSize: 11, fontFamily: "var(--mono)" }}
            >
              <option value="">Ver persona...</option>
              {team.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <span className="sk-mono text-xs muted">{scopeLabel}</span>
        </div>
      </div>

      {/* Grid semana */}
      <div className="calendar-week" style={{ display: "flex", flex: 1, overflow: "auto", borderBottom: "1.4px solid var(--line)" }}>
        {days.map((day, i) => {
          const dateStr = _fmtDate(day);
          const isToday = dateStr === todayStr;
          const dayTasks = visibleTasks.filter(t => t.date === dateStr && !t.done);
          const dayBikes = visibleServices.filter(s => (s.scheduledDate || s.date) === dateStr && s.phase < 4);
          const dayAppts = visibleAppointments.filter(a => a.date === dateStr);
          const dayItems = sortByTime([
            ...dayBikes.map(s => ({ type: "bike" as const, id: s.id, start: timeToMins(s.startTime), label: s.clientName, render: () => renderBikeEvent(s) })),
            ...dayTasks.map(t => ({ type: "task" as const, id: t.id, start: t.hasTime ? timeToMins(t.startTime) : null, label: t.title, render: () => renderTaskEvent(t) })),
            ...dayAppts.map(a => ({ type: "appt" as const, id: a.id, start: timeToMins(a.startTime), label: a.client, render: () => renderApptEvent(a) })),
          ]);
          const untimedItems = dayItems.filter(item => item.start == null);
          const itemsByHour = (hour: number) => dayItems.filter(item => item.start != null && Math.floor(item.start / 60) === hour);
          const outsideHourItems = dayItems.filter(item => item.start != null && (item.start < calendarHours[0] * 60 || item.start >= (calendarHours[calendarHours.length - 1] + 1) * 60));
          return (
            <div key={i} className={`cal-day${isToday ? " is-today" : ""}`} style={{ minHeight: 120 }}>
              <div className="sk-mono text-xs tracked muted">{DAY_NAMES[i]}</div>
              <div className="sk-title text-2xl" style={{ lineHeight: 1, marginBottom: 8, color: isToday ? "var(--accent)" : "var(--ink)" }}>
                {day.getDate()}
              </div>

              {untimedItems.length > 0 && (
                <div className="cal-untimed">
                  <div className="cal-hour-label" style={{ textAlign: "left", marginBottom: 4 }}>Sin hora</div>
                  {untimedItems.map(item => item.render())}
                </div>
              )}
              {calendarHours.map(hour => {
                const hourItems = itemsByHour(hour);
                return (
                  <div key={hour} className="cal-hour-row">
                    <div className="cal-hour-label">{hourLabel(hour)}</div>
                    <div className="cal-hour-lane">
                      {hourItems.length ? hourItems.map(item => item.render()) : <div className="cal-hour-empty" />}
                    </div>
                  </div>
                );
              })}
              {outsideHourItems.length > 0 && (
                <div className="cal-untimed">
                  <div className="cal-hour-label" style={{ textAlign: "left", marginBottom: 4 }}>Otros horarios</div>
                  {outsideHourItems.map(item => item.render())}
                </div>
              )}

              {dayTasks.length === 0 && dayBikes.length === 0 && dayAppts.length === 0 && (
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
            <div style={{ width: 12, height: 12, background: "rgba(34,139,80,.08)", border: "1.2px solid #22844a", borderRadius: 3, flexShrink: 0 }} />
            <span className="sk-mono text-xs muted">Agendamientos de clientes</span>
          </div>
          <div className="row gap-2">
            <div style={{ width: 12, height: 12, background: "#dbeafe", border: "1.2px solid #3b82f6", borderRadius: 3, flexShrink: 0 }} />
            <span className="sk-mono text-xs muted">Tareas internas del equipo</span>
          </div>
        </div>
        <span className="sk-mono text-xs muted">
          {visibleServices.filter(s => (s.scheduledDate || s.date) === todayStr && s.phase < 4).length} bicis · {visibleAppointments.filter(a => a.date === todayStr).length} agendamientos · {visibleTasks.filter(t => t.date === todayStr && !t.done).length} tareas hoy
        </span>
      </div>

      {showTaskModal && (
        <AssignTaskModal team={team} initialDate={preDate} onClose={() => setShowTaskModal(false)}
          onAdd={task => { setTasks(ts => [task, ...ts]); }} />
      )}
      {showApptModal && (
        <AppointmentModal team={team} initialDate={preDate} onClose={() => setShowApptModal(false)}
          onAdd={appt => setAppointments(as => [appt, ...as])} />
      )}

      {/* Modal edición de servicio desde el calendario */}
      {editingTask && (
        <EditTaskCalModal
          task={editingTask}
          team={team}
          onClose={() => setEditingTask(null)}
          onSave={(id, changes) => {
            setTasks(ts => ts.map(t => t.id === id ? { ...t, ...changes } : t));
            setEditingTask(null);
          }}
        />
      )}

      {editingSvc && onUpdateService && (
        <EditServiceCalModal
          service={editingSvc}
          team={team}
          onClose={() => setEditingSvc(null)}
          onSave={(id, changes) => { onUpdateService(id, changes); setEditingSvc(null); }}
        />
      )}

      {editingAppt && (
        <EditAppointmentModal
          appt={editingAppt}
          team={team}
          onClose={() => setEditingAppt(null)}
          onSave={(id, changes) => {
            setAppointments(as => as.map(a => a.id === id ? { ...a, ...changes } : a));
            setEditingAppt(null);
          }}
          onDelete={id => {
            setAppointments(as => as.filter(a => a.id !== id));
            setEditingAppt(null);
          }}
        />
      )}
    </div>
  );
}

function EditTaskCalModal({ task, team, onClose, onSave }: {
  task: AppTask;
  team: any[];
  onClose: () => void;
  onSave: (id: string, changes: Partial<AppTask>) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [assignedTo, setAssignedTo] = useState(task.assignedTo);
  const [tag, setTag] = useState(task.tag || "GENERAL");
  const [date, setDate] = useState(task.date || _fmtDate(new Date()));
  const [dueDate, setDueDate] = useState(task.dueDate || task.date || _fmtDate(new Date()));
  const [priority, setPriority] = useState<"baja" | "media" | "alta">(taskPriority(task));
  const [points, setPoints] = useState(String(taskPoints(task)));
  const [evidence, setEvidence] = useState(task.evidence || "");
  const [qualityStatus, setQualityStatus] = useState(taskQuality(task));
  const [hasTime, setHasTime] = useState(!!task.hasTime);
  const [startTime, setStartTime] = useState(task.startTime || "09:00");
  const [endTime, setEndTime] = useState(task.endTime || "10:00");
  const [done, setDone] = useState(!!task.done);
  const tags = ["GENERAL", "TALLER", "TIENDA", "LIMPIEZA", "CAJA", "PEDIDO"];

  const handleSave = () => {
    if (!title.trim()) return;
    onSave(task.id, {
      title: title.trim(),
      description: description.trim(),
      assignedTo,
      tag,
      date,
      dueDate,
      priority,
      points: Math.max(1, Number(points) || 1),
      evidence: evidence.trim(),
      qualityStatus,
      hasTime,
      startTime: hasTime ? startTime : "",
      endTime: hasTime ? endTime : "",
      done,
      completedAt: done ? (task.completedAt || new Date().toISOString()) : undefined,
    });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="row between" style={{ marginBottom: 16 }}>
          <div>
            <div className="sk-title text-xl">Editar tarea</div>
            <div className="sk-mono text-xs muted">Cambiar fecha la mueve en el calendario</div>
          </div>
          <span className="task-tag-b">TAREA</span>
        </div>

        <div className="field-group">
          <div className="field-label">Título *</div>
          <input className="field-input" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        </div>

        <div className="field-group">
          <div className="field-label">Descripción</div>
          <textarea className="field-input" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalle, instrucciones o contexto para la persona asignada..." />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field-group">
            <div className="field-label">Asignada a</div>
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
          <div className="field-label">Categoria</div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
            {tags.map(t => <button key={t} className={"action" + (tag === t ? " accent" : "")} style={{ fontSize: 11, padding: "3px 10px" }} onClick={() => setTag(t)}>{t}</button>)}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div className="field-group">
            <div className="field-label">Fecha límite</div>
            <input className="field-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="field-group">
            <div className="field-label">Prioridad</div>
            <select className="field-input" value={priority} onChange={e => setPriority(e.target.value as any)}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </div>
          <div className="field-group">
            <div className="field-label">Puntos</div>
            <input className="field-input" type="number" min="1" value={points} onChange={e => setPoints(e.target.value)} />
          </div>
        </div>
        <div className="field-group">
          <div className="field-label">Evidencia / comentario / link</div>
          <input className="field-input" value={evidence} onChange={e => setEvidence(e.target.value)} />
        </div>
        <div className="field-group">
          <div className="field-label">Validación admin</div>
          <select className="field-input" value={qualityStatus} onChange={e => setQualityStatus(e.target.value as any)}>
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
            <option value="correccion">Requiere correccion</option>
            <option value="no_aprobado">No aprobado</option>
          </select>
        </div>

        <label className="row gap-3" style={{ cursor: "pointer", padding: "8px 0" }}>
          <input type="checkbox" checked={hasTime} onChange={e => setHasTime(e.target.checked)} style={{ width: 16, height: 16 }} />
          <span className="text-sm">Tiene hora especifica</span>
        </label>

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

        <label className="row gap-3" style={{ cursor: "pointer", padding: "8px 0 14px" }}>
          <input type="checkbox" checked={done} onChange={e => setDone(e.target.checked)} style={{ width: 16, height: 16 }} />
          <span className="text-sm">Tarea completada</span>
        </label>

        <div className="row gap-3">
          <button className="action" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button className="action ink" onClick={handleSave} style={{ flex: 2 }} disabled={!title.trim()}>Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}

function EditServiceCalModal({ service, team, onClose, onSave }: {
  service: BikeService;
  team: any[];
  onClose: () => void;
  onSave: (id: string, changes: Partial<BikeService>) => void;
}) {
  const workshopTeam = useMemo(() => {
    const filtered = workshopResponsibles(team);
    const current = team.find(m => m.id === service.technicianId);
    return current && !filtered.some(m => m.id === current.id) ? [current, ...filtered] : filtered;
  }, [team, service.technicianId]);
  const [bikeDescription, setBikeDescription] = useState(service.bikeDescription);
  const [serviceType, setServiceType] = useState(service.serviceType || "");
  const [notes, setNotes] = useState(service.notes || "");
  const [neededByDate, setNeededByDate] = useState(service.neededByDate || "");
  const [technicianId, setTechnicianId] = useState(service.technicianId || "");
  const [startTime, setStartTime] = useState(service.startTime || "");
  const [endTime, setEndTime] = useState(service.endTime || "");
  const [scheduledDate, setScheduledDate] = useState(service.scheduledDate || service.date);

  const inp: React.CSSProperties = { width: "100%", padding: "8px 11px", borderRadius: 7, border: "1.3px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit", marginBottom: 10 };
  const lbl: React.CSSProperties = { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase" as const, display: "block", marginBottom: 3 };

  const handleSave = () => {
    if (!bikeDescription.trim()) return;
    const resolvedServiceType = resolveServiceValue(serviceType);
    onSave(service.id, {
      bikeDescription: bikeDescription.trim(),
      serviceType: resolvedServiceType || undefined,
      notes,
      neededByDate: neededByDate || undefined,
      technicianId: technicianId || undefined,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      scheduledDate: scheduledDate || undefined,
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
        <ServiceTypeInput
          style={{ ...inp }}
          value={serviceType}
          onChange={setServiceType}
          placeholder="Escribe código, nombre o selecciona..."
        />

        <label style={lbl}>Técnico asignado</label>
        <select style={{ ...inp }} value={technicianId} onChange={e => setTechnicianId(e.target.value)}>
          <option value="">Sin asignar</option>
          {workshopTeam.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
        </select>
        {workshopTeam.length === 0 && <div className="sk-mono text-xs muted" style={{ marginTop: -6, marginBottom: 8 }}>Configura responsables de taller en Perfil del equipo.</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>Fecha de ingreso</label>
            <div style={{ ...inp, color: "var(--ink-3)", userSelect: "none" as const }}>{service.date}</div>
          </div>
          <div>
            <label style={lbl}>Fecha en que se realizará</label>
            <input style={inp} type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: -6, marginBottom: 10, fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>
          Cambia la fecha programada para moverla en el calendario.
        </div>

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

function ServiceTypeInput({ value, onChange, style, placeholder = "Escribe código o nombre..." }: {
  value: string;
  onChange: (value: string) => void;
  style: React.CSSProperties;
  placeholder?: string;
}) {
  const listId = useMemo(() => `services-${Math.random().toString(36).slice(2)}`, []);

  return (
    <>
      <input
        style={style}
        value={value}
        list={listId}
        onChange={e => onChange(e.target.value)}
        onBlur={e => onChange(resolveServiceValue(e.target.value))}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {SERVICES_FLAT.map(item => (
          <option
            key={item.code}
            value={`${item.code} - ${item.name}`}
            label={`${item.code} · ${item.name} · $${item.price.toLocaleString("es-CO")}`}
          />
        ))}
      </datalist>
    </>
  );
}

function messageAgentEndpoint(): string {
  const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocal) return "http://127.0.0.1:5001/capital-bikes/us-central1/organizarMensajes";
  return "/api/organizar-mensajes";
}

function normalizeAiMessages(data: any): AiOrganizedMessages {
  return {
    grupo: typeof data?.grupo === "string" ? data.grupo : "",
    caja: typeof data?.caja === "string" ? data.caja : "",
    taller: typeof data?.taller === "string" ? data.taller : "",
    redes: typeof data?.redes === "string" ? data.redes : "",
    dudas: Array.isArray(data?.dudas) ? data.dudas.map(String).filter(Boolean) : [],
    tareas: Array.isArray(data?.tareas) ? data.tareas.filter((t: any) => t?.titulo && t?.asignadoAId) : [],
  };
}

function AssignTasksPreviewModal({ briefs, team, onConfirm, onClose }: {
  briefs: Array<{ key: string; title: string; description?: string; area: MessageArea; urgency: string; suggestedMemberId: string }>;
  team: any[];
  onConfirm: (tasks: AppTask[]) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState(() =>
    briefs.map(b => ({
      key: b.key,
      title: b.title,
      description: b.description || "",
      area: b.area,
      urgency: b.urgency,
      assignedTo: b.suggestedMemberId,
      included: true,
    }))
  );

  const setField = (key: string, field: string, value: any) =>
    setRows(rs => rs.map(r => r.key === key ? { ...r, [field]: value } : r));

  const toAssign = rows.filter(r => r.included && r.assignedTo);

  const handleConfirm = () => {
    const today = _fmtDate(new Date());
    const tasks: AppTask[] = toAssign.map(r => {
      const dueDate = r.urgency === "hoy" ? today : r.urgency === "manana" ? _addDaysTo(today, 1) : r.urgency === "semana" ? _addDaysTo(today, 7) : today;
      const priority: AppTask["priority"] = r.urgency === "hoy" ? "alta" : r.urgency === "manana" ? "media" : "baja";
      return {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title: r.title,
        description: r.description?.trim() || "",
        assignedTo: r.assignedTo,
        tag: areaTagMap[r.area],
        done: false,
        createdAt: new Date().toISOString(),
        date: today,
        dueDate,
        priority,
        points: priority === "alta" ? 3 : priority === "media" ? 2 : 1,
        qualityStatus: "pendiente",
      };
    });
    onConfirm(tasks);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 540 }}>
        <div className="row between" style={{ marginBottom: 4 }}>
          <div>
            <div className="sk-mono text-xs tracked muted">RESUMEN DE ASIGNACIÓN</div>
            <div className="sk-title text-xl">¿A quién va cada tarea?</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        <div className="sk-mono text-xs muted" style={{ marginBottom: 16 }}>
          Desmarca las que no quieras crear. Cambia el responsable con el selector.
        </div>

        <div className="stack gap-2" style={{ maxHeight: 360, overflowY: "auto" }}>
          {rows.map(r => {
            const member = team.find(m => m.id === r.assignedTo);
            return (
              <div key={r.key} style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 8, background: r.included ? "var(--paper-2)" : "transparent", opacity: r.included ? 1 : 0.4, border: "1.2px solid var(--line)" }}>
                <input type="checkbox" checked={r.included} onChange={e => setField(r.key, "included", e.target.checked)} style={{ cursor: "pointer" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{r.title}</div>
                  {r.description && <div className="text-xs muted" style={{ marginTop: 2, lineHeight: 1.35 }}>{r.description}</div>}
                  <div className="row gap-2" style={{ marginTop: 3 }}>
                    <span className="sk-mono text-xs" style={{ background: "var(--paper)", border: "1px solid var(--line)", padding: "1px 6px", borderRadius: 4 }}>{areaTagMap[r.area]}</span>
                    {r.urgency === "hoy" && <span className="sk-mono text-xs" style={{ color: "var(--accent)", fontWeight: 700 }}>HOY</span>}
                    {r.urgency === "manana" && <span className="sk-mono text-xs" style={{ color: "#e8a020" }}>MAÑANA</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {member && (
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: member.color || "var(--ink)", color: "#fff", fontWeight: 700, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {(member.initials || member.name?.slice(0, 2) || "?").toUpperCase()}
                    </div>
                  )}
                  <select
                    className="field-input"
                    style={{ fontSize: 12, padding: "4px 8px", minWidth: 110 }}
                    value={r.assignedTo}
                    onChange={e => setField(r.key, "assignedTo", e.target.value)}
                    disabled={!r.included}
                  >
                    <option value="">Sin asignar</option>
                    {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {toAssign.length === 0 && (
          <div className="sk-mono text-xs muted" style={{ marginTop: 10, textAlign: "center" }}>
            Selecciona al menos una tarea y asígnale un responsable.
          </div>
        )}

        <div className="row gap-3" style={{ marginTop: 18 }}>
          <button className="action" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button className="action ink" onClick={handleConfirm} style={{ flex: 2 }} disabled={toAssign.length === 0}>
            Asignar {toAssign.length > 0 ? `${toAssign.length} ${toAssign.length === 1 ? "tarea" : "tareas"}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageAgentSection({ team = [], onAddTasks }: { team?: any[]; onAddTasks?: (tasks: AppTask[]) => void }) {
  const example = "Sergio revisar la bici de Laura, quedó pendiente cadena y frenos. Cindy cobrar abono de Mateo y confirmar transferencia. Subir historia del mantenimiento express y tomar foto antes/después. En el grupo avisar que mañana entran dos bicis temprano.";
  const [raw, setRaw] = useState("");
  const [tone, setTone] = useState<MessageTone>("amable");
  const [copied, setCopied] = useState<MessageArea | "todo" | null>(null);
  const [aiMessages, setAiMessages] = useState<AiOrganizedMessages | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [tasksCreated, setTasksCreated] = useState(false);
  const [dudaAnswers, setDudaAnswers] = useState<Record<number, string>>({});
  const organized = useMemo(() => organizeMessage(raw, tone), [raw, tone]);

  const allBriefs = useMemo(() => {
    // Si el AI devolvió tareas estructuradas, usarlas directamente
    if (aiMessages?.tareas?.length) {
      return aiMessages.tareas.map((t, i) => ({
        key: `ai-${i}`,
        title: t.titulo,
        description: t.descripcion || "",
        area: t.area,
        urgency: t.urgencia,
        suggestedMemberId: t.asignadoAId,
      }));
    }
    // Fallback local: analizar notas con asignación inteligente por rol
    const result: Array<{ key: string; title: string; description?: string; area: MessageArea; urgency: string; suggestedMemberId: string }> = [];
    (Object.keys(organized) as MessageArea[]).forEach(area => {
      organized[area].forEach((brief, i) => {
        const member = autoAssignByArea(area, brief.source, team);
        result.push({
          key: `${area}-${i}`,
          title: sentenceCase(brief.detail || brief.source),
          description: brief.action && brief.source ? `${brief.action}: ${brief.source}` : "",
          area,
          urgency: brief.urgency || "normal",
          suggestedMemberId: member?.id || "",
        });
      });
    });
    return result;
  }, [organized, aiMessages, team]);
  const areas: { id: MessageArea; title: string; hint: string; color: string }[] = [
    { id: "grupo", title: "Grupo general", hint: "avisos para todos", color: "var(--ink)" },
    { id: "caja", title: "Caja", hint: "pagos, cobros, facturas", color: "var(--accent)" },
    { id: "taller", title: "Taller", hint: "bicis, repuestos, entregas", color: "#7a5500" },
    { id: "redes", title: "Redes", hint: "historias, fotos, publicaciones", color: "var(--accent-2)" },
  ];
  const fullText = areas
    .map(area => aiMessages?.[area.id] || buildAreaMessage(area.id, organized[area.id], tone))
    .filter(Boolean)
    .join("\n\n");

  const analyzeWithAi = async () => {
    if (!raw.trim()) return;
    setAiLoading(true);
    setAiError("");
    try {
      const response = await fetch(messageAgentEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: raw,
          tone,
          team: team.map(m => ({ id: m.id, name: m.name, role: m.role })),
          requestTasks: true,
          clarifications: aiMessages?.dudas?.length
            ? aiMessages.dudas.map((duda, i) => ({ duda, respuesta: dudaAnswers[i] || "" })).filter(c => c.respuesta)
            : [],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "No se pudo analizar con IA");
      setAiMessages(normalizeAiMessages(data));
    } catch (err: any) {
      setAiMessages(null);
      const isNetworkErr = err instanceof TypeError || err?.message === "Failed to fetch";
      setAiError(isNetworkErr ? "Sin conexión con la IA. Mostrando respaldo local." : err?.message || "No se pudo analizar.");
    } finally {
      setAiLoading(false);
    }
  };

  const copyText = async (text: string, area: MessageArea | "todo") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(area);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="fade-in" style={{ flex: 1, padding: 18 }}>
      <div className="tasks-grid" style={{ display: "grid", gridTemplateColumns: "minmax(280px, 420px) 1fr", gap: 16, alignItems: "start" }}>
        <div className="sk-box p-4 stack gap-3">
          <div>
            <div className="sk-mono text-xs tracked muted">ENTRADA</div>
            <div className="sk-title text-2xl" style={{ lineHeight: 1.1 }}>Agente de mensajes</div>
          </div>
          <textarea
            className="field-input"
            rows={12}
            value={raw}
            onChange={e => { setRaw(e.target.value); setAiMessages(null); setAiError(""); setDudaAnswers({}); }}
            placeholder="Pega aquí tu mensaje del grupo o tus notas del día..."
            style={{ minHeight: 230, fontSize: 14 }}
          />
          <div>
            <div className="field-label">Tono</div>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {([
                ["amable", "Amable"],
                ["directo", "Directo"],
                ["seguimiento", "Seguimiento"],
              ] as [MessageTone, string][]).map(([id, label]) => (
                <button key={id} className={"action" + (tone === id ? " accent" : "")} onClick={() => setTone(id)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            <button className="action accent" onClick={analyzeWithAi} disabled={!raw.trim() || aiLoading}>
              {aiLoading ? "Generando..." : "Generar"}
            </button>
            <button className="action ink" onClick={() => copyText(fullText, "todo")} disabled={!fullText}>
              Copiar todo
            </button>
            <button className="action" onClick={() => { setRaw(example); setAiMessages(null); setAiError(""); }}>
              Probar ejemplo
            </button>
            <button className="action" onClick={() => { setRaw(""); setAiMessages(null); setAiError(""); }} disabled={!raw.trim()}>
              Limpiar
            </button>
          </div>
          {copied === "todo" && <div className="sk-mono text-xs" style={{ color: "var(--done)" }}>Mensajes copiados.</div>}
          {aiMessages && <div className="sk-mono text-xs" style={{ color: "var(--done)" }}>Mensajes generados con IA. Revisa y copia.</div>}
          {aiError && <div className="sk-mono text-xs" style={{ color: "#c0392b", lineHeight: 1.4 }}>{aiError}</div>}
          <div className="sk-box fill p-3">
            <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 6 }}>COMO LO LEE</div>
            <div className="text-sm muted" style={{ lineHeight: 1.45 }}>
              Escribe como hablas normalmente: notas mezcladas del grupo, recordatorios sueltos o instrucciones del día. Con IA redacta mensajes completos; si la IA no está disponible, queda el respaldo local.
            </div>
          </div>
          {aiMessages?.dudas?.length ? (
            <div className="sk-box p-3 stack gap-3" style={{ borderColor: "#c8a800", background: "#fffdf0" }}>
              <div>
                <div className="sk-mono text-xs tracked muted" style={{ marginBottom: 2 }}>DUDAS DETECTADAS</div>
                <div className="text-sm muted">Responde las que puedas y vuelve a generar.</div>
              </div>
              <div className="stack gap-3">
                {aiMessages.dudas.map((duda, i) => (
                  <div key={i} className="stack gap-1">
                    <div className="text-sm" style={{ fontWeight: 500 }}>— {duda}</div>
                    <input
                      className="field-input"
                      style={{ fontSize: 13 }}
                      placeholder="Tu respuesta..."
                      value={dudaAnswers[i] || ""}
                      onChange={e => setDudaAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <button
                className="action accent"
                style={{ alignSelf: "flex-start" }}
                onClick={analyzeWithAi}
                disabled={aiLoading || Object.values(dudaAnswers).every(v => !v.trim())}
              >
                {aiLoading ? "Generando..." : "Regenerar con respuestas"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="stack gap-3">
          {areas.map(area => {
            const text = aiMessages?.[area.id] || buildAreaMessage(area.id, organized[area.id], tone);
            return (
              <div key={area.id} className="sk-box p-4">
                <div className="row between gap-3" style={{ alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div className="row gap-2">
                      <span className="dot" style={{ background: area.color }} />
                      <div className="sk-title text-xl" style={{ lineHeight: 1 }}>{area.title}</div>
                    </div>
                    <div className="sk-mono text-xs muted" style={{ marginTop: 3 }}>{area.hint}</div>
                  </div>
                  <button className="action" onClick={() => copyText(text, area.id)} disabled={!text}>
                    {copied === area.id ? "Copiado" : "Copiar"}
                  </button>
                </div>
                {text ? (
                  <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "var(--hand)", fontSize: 15, lineHeight: 1.45, background: "var(--paper-2)", border: "1.2px dashed var(--line)", borderRadius: 8, padding: 12 }}>
                    {text}
                  </pre>
                ) : (
                  <div className="placeholder" style={{ minHeight: 86, borderRadius: 8 }}>
                    {"Pega tus notas para empezar"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {allBriefs.length > 0 && onAddTasks && (
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <button className="action ink" style={{ fontSize: 14, padding: "10px 22px" }}
            onClick={() => setShowAssignModal(true)}>
            Asignar tareas al equipo
          </button>
          {tasksCreated && (
            <div className="sk-mono text-xs" style={{ color: "var(--done)" }}>Tareas asignadas. Ve a Tareas para verlas.</div>
          )}
        </div>
      )}

      {showAssignModal && (
        <AssignTasksPreviewModal
          briefs={allBriefs}
          team={team}
          onConfirm={tasks => { onAddTasks!(tasks); setTasksCreated(true); setShowAssignModal(false); }}
          onClose={() => setShowAssignModal(false)}
        />
      )}
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
        { done: false, what: "Explicar flujo de inicio día", owner: "yo", when: "5/5" },
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
        <div className="tasks-grid" style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 16, padding: "14px 18px" }}>
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
                <p style={{ marginBottom: 8 }}>— Propone renegociar <span className="scribble">apoyo adicional sábados</span> (Q3).</p>
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
  { id: "dash",          label: "Dashboard",       icon: "home"   },
  { id: "servicios",     label: "Servicios",        icon: "wrench" },
  { id: "clientes",      label: "Clientes",         icon: "people" },
  { id: "membresias",    label: "Mensualidades",    icon: "coin"   },
  { id: "lunch",         label: "Almuerzo",         icon: "lunch"  },
  { id: "turno",         label: "Inicio día",        icon: "in"     },
  { id: "perfil",        label: "Perfil equipo",    icon: "user"   },
  { id: "tareas",        label: "Tareas",           icon: "tasks"  },
  { id: "mensajes",      label: "Mensajes",         icon: "message" },
  { id: "cal",           label: "Calendario",       icon: "cal"    },
  { id: "integraciones", label: "Integraciones",    icon: "link"   },
];
const DASH_TABS = [
  { id: "lista", label: "Resumen" },
  { id: "kanban", label: "Prioridades" },
  { id: "timeline", label: "Agenda" },
  { id: "mapa", label: "Equipo" },
];

// ─── Vista pública de seguimiento para clientes ───────────────────────────────
const WORKSHOP_STATUS_LABEL: Record<string, { label: string; icon: string; color: string }> = {
  ingresada:   { label: "Bici recibida en taller",          icon: "📋", color: "#a080a0" },
  diagnostico: { label: "En diagnóstico",                   icon: "🔬", color: "#e8a020" },
  desarme:     { label: "En desarme",                       icon: "🔧", color: "#e8a020" },
  limpieza:    { label: "En limpieza",                      icon: "💧", color: "#5cc8e8" },
  inspeccion:  { label: "En inspección",                    icon: "🔍", color: "#5cc8e8" },
  ensamble:    { label: "En ensamble",                      icon: "⚙️",  color: "#9c4a9e" },
  detalle:     { label: "Detalle final",                    icon: "✨", color: "#9c4a9e" },
  prueba:      { label: "En prueba",                        icon: "🚲", color: "#6c1f6e" },
  autorizada:  { label: "Trabajo autorizado",               icon: "✅", color: "#4caf50" },
  terminada:   { label: "¡Trabajo terminado!",              icon: "🏁", color: "#4caf50" },
  entregada:   { label: "Entregada al cliente",             icon: "🏠", color: "#4caf50" },
};

function TrackingLoader({ serviceId }: { serviceId: string }) {
  const [state, setState] = useState<"loading" | "found" | "notfound">("loading");
  const [service, setService] = useState<BikeService | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlHeight: html.style.height,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyInset: body.style.inset,
      bodyHeight: body.style.height,
      bodyWidth: body.style.width,
      rootOverflow: root?.style.overflow || "",
      rootHeight: root?.style.height || "",
    };

    html.classList.add("customer-tracking-open");
    body.classList.add("customer-tracking-open");
    html.style.overflow = "auto";
    html.style.height = "auto";
    body.style.overflow = "auto";
    body.style.position = "static";
    body.style.inset = "auto";
    body.style.height = "auto";
    body.style.width = "100%";
    if (root) {
      root.style.overflow = "visible";
      root.style.height = "auto";
    }

    return () => {
      html.classList.remove("customer-tracking-open");
      body.classList.remove("customer-tracking-open");
      html.style.overflow = previous.htmlOverflow;
      html.style.height = previous.htmlHeight;
      body.style.overflow = previous.bodyOverflow;
      body.style.position = previous.bodyPosition;
      body.style.inset = previous.bodyInset;
      body.style.height = previous.bodyHeight;
      body.style.width = previous.bodyWidth;
      if (root) {
        root.style.overflow = previous.rootOverflow;
        root.style.height = previous.rootHeight;
      }
    };
  }, []);

  useEffect(() => {
    import("./firebase").then(({ loadShopDataOnce }) =>
      loadShopDataOnce().then(data => {
        if (!data) { setState("notfound"); return; }
        const found = (data.services || []).find((s: BikeService) => s.id === serviceId);
        if (found) { setService(found); setState("found"); }
        else setState("notfound");
      }).catch(() => setState("notfound"))
    );
  }, [serviceId]);

  const S = { bg: "#1a0d1a", card: "#221222", header: "#6c1f6e", text: "#e8d5e8", muted: "#a080a0" };

  if (state === "loading") return (
    <div style={{ minHeight: "100vh", background: S.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{CSS}</style>
      <div style={{ color: S.muted, fontFamily: "monospace", fontSize: 13, letterSpacing: 2 }}>CARGANDO...</div>
    </div>
  );

  if (state === "notfound") return (
    <div style={{ minHeight: "100vh", background: S.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{CSS}</style>
      <img src={LOGO_DARK_BG_SRC} alt="Capital Wo-Man Bikes" style={{ height: 40, marginBottom: 24, objectFit: "contain" }} />
      <div style={{ background: S.card, borderRadius: 16, padding: "32px 28px", maxWidth: 380, width: "100%", textAlign: "center", border: `1px solid #3a1a3a` }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <div style={{ color: S.text, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Servicio no encontrado</div>
        <div style={{ color: S.muted, fontSize: 13, lineHeight: 1.6 }}>
          Este link de seguimiento ya no está disponible. Es posible que el servicio haya sido eliminado o que el link sea incorrecto.
        </div>
        <div style={{ marginTop: 20, color: S.muted, fontSize: 11, fontFamily: "monospace" }}>Capital Wo-Man Bikes</div>
      </div>
    </div>
  );

  return <CustomerTrackingView data={service!} />;
}

function CustomerTrackingView({ data }: { data: any }) {
  const cur = data.phase as number;
  const diags: DiagnosticUpdate[] = data.diagnosticUpdates || [];
  const quotedParts: QuotedPart[] = data.quotedParts || [];
  const customerTicket = ticketSummary(data);
  const urgency = urgencyInfo(data.neededByDate);
  const completedAt: string | undefined = data.completedAt;
  const deliveredDate = formatDateTimeEs(data.deliveredAt || data.deliverySignedAt);
  const workshopInfo = data.workshopStatus ? WORKSHOP_STATUS_LABEL[data.workshopStatus] : null;
  const daysSinceCompleted = completedAt
    ? Math.floor((Date.now() - new Date(completedAt).getTime()) / 86400000)
    : null;
  const daysInShop = data.date
    ? Math.floor((Date.now() - new Date(data.date + "T00:00:00").getTime()) / 86400000)
    : null;

  const S = { // colores comunes para este componente oscuro
    bg: "#1a0d1a", card: "#221222", header: "#6c1f6e",
    text: "#e8d5e8", muted: "#a080a0", mono: "monospace",
    border: "#3a1a3a", subtle: "#1a1222",
  };
  const Row = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${S.border}` }}>
      <span style={{ color: S.muted, fontSize: 12, fontFamily: S.mono }}>{label}</span>
      <span style={{ color: color || S.text, fontSize: 12, fontWeight: 600 }}>{value}</span>
    </div>
  );

  return (
    <div
      className="customer-tracking-page"
      style={{ minHeight: "100dvh", overflow: "visible", touchAction: "pan-y", background: S.bg, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px", boxSizing: "border-box" }}
    >
      <style>{CSS}</style>
      <style>{`
        html.customer-tracking-open,
        html.customer-tracking-open body,
        body.customer-tracking-open,
        body.customer-tracking-open #root{
          height:auto!important;
          min-height:100%!important;
          overflow-x:hidden!important;
          overflow-y:auto!important;
          position:static!important;
          inset:auto!important;
          overscroll-behavior-y:auto!important;
        }
        body.customer-tracking-open .customer-tracking-page{
          min-height:100dvh!important;
          height:auto!important;
          overflow:visible!important;
          -webkit-overflow-scrolling:touch;
          touch-action:pan-y!important;
        }
        @supports not (min-height:100dvh){body.customer-tracking-open .customer-tracking-page{min-height:100vh!important;}}
        @media (max-width:768px){body.customer-tracking-open .customer-tracking-page{padding:16px 12px 28px!important;}}
      `}</style>
      <div style={{ width: "100%", maxWidth: 480, background: S.card, borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 32px #0008" }}>

        {/* Header */}
        <div style={{ background: S.header, padding: "20px 24px" }}>
          <img src={LOGO_DARK_BG_SRC} alt="Capital Wo-Man Bikes" style={{ height: 32, display: "block", margin: "0 auto 12px", objectFit: "contain" }} />
          <div style={{ textAlign: "center", color: "#e8d5e8", fontFamily: S.mono, fontSize: 10, letterSpacing: 2, marginBottom: 14 }}>SEGUIMIENTO DE SERVICIO</div>
          <div style={{ color: "#e8d5e8", fontSize: 20, fontWeight: 700 }}>{data.clientName}</div>
          <div style={{ color: "#d0a8d0", fontSize: 14, marginTop: 3 }}>{data.bikeDescription}</div>
          {data.serviceType && <div style={{ color: "#b880b8", fontSize: 12, marginTop: 4, fontFamily: S.mono }}>🛠 {data.serviceType}</div>}
        </div>

        <div style={{ padding: 20 }}>

          {/* Info básica */}
          <div style={{ background: S.subtle, borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
            <Row label="Fecha ingreso" value={data.date} />
            {data.workshopStartDate && <Row label="Inicio de trabajo" value={data.workshopStartDate} />}
            {data.neededByDate && <Row label="Fecha acordada de entrega" value={data.neededByDate} color={urgency?.color} />}
            {data.deliveryStatus === "entregada" && deliveredDate && <Row label="Fecha entregada" value={deliveredDate} color="#4caf50" />}
            {daysInShop !== null && daysInShop >= 0 && (
              <Row label="Días en taller" value={`${daysInShop === 0 ? "Hoy" : `${daysInShop} día${daysInShop > 1 ? "s" : ""}`}`}
                color={daysInShop > 5 ? "#e8a020" : S.muted} />
            )}
          </div>

          {/* Urgencia */}
          {urgency && (
            <div style={{ background: urgency.bg, border: `1px solid ${urgency.color}`, borderRadius: 8, padding: "8px 12px", marginBottom: 16 }}>
              <span style={{ color: urgency.color, fontSize: 13, fontWeight: 700 }}>{urgency.label}</span>
            </div>
          )}

          {/* Estado actual destacado */}
          {workshopInfo && cur < 4 && (
            <div style={{ background: `${workshopInfo.color}18`, border: `1.5px solid ${workshopInfo.color}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>{workshopInfo.icon}</span>
              <div>
                <div style={{ color: S.muted, fontFamily: S.mono, fontSize: 9, letterSpacing: 1, marginBottom: 2 }}>ESTADO ACTUAL</div>
                <div style={{ color: workshopInfo.color, fontSize: 16, fontWeight: 700 }}>{workshopInfo.label}</div>
              </div>
            </div>
          )}

          {/* Progreso fases principales */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: S.muted, fontFamily: S.mono, fontSize: 9, letterSpacing: 1, marginBottom: 12 }}>PROGRESO DEL SERVICIO</div>
            {/* Barra de progreso */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {PHASES.map(ph => (
                <div key={ph.id} style={{ flex: 1, height: 6, borderRadius: 3, background: cur >= ph.id ? ph.color : "#2d1a2d", transition: "background .3s" }} />
              ))}
            </div>
            {/* Timeline de fases */}
            {[{ id: 0, name: "Recibida", icon: "📋", color: "#a080a0" }, ...PHASES].map((ph, i, arr) => {
              const done = cur > ph.id;
              const active = cur === ph.id;
              const isLast = i === arr.length - 1;
              return (
                <div key={ph.id} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: done ? "#4caf50" : active ? ph.color : "#2d1a2d", border: `2px solid ${done ? "#4caf50" : active ? ph.color : "#4a2a4a"}`, fontSize: 16 }}>
                      {done ? "✓" : ph.icon}
                    </div>
                    {!isLast && <div style={{ width: 2, height: 24, background: done ? "#4caf50" : "#2d1a2d", margin: "2px 0" }} />}
                  </div>
                  <div style={{ paddingTop: 6, paddingBottom: isLast ? 0 : 20 }}>
                    <div style={{ color: done ? "#4caf50" : active ? S.text : "#5a3a5a", fontWeight: active ? 700 : 400, fontSize: 14 }}>
                      {(ph as any).name}
                    </div>
                    {active && (ph as any).msg && (
                      <div style={{ color: S.muted, fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>{(ph as any).msg}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Repuestos a cambiar */}
          {quotedParts.length > 0 && (
            <div style={{ background: S.subtle, border: "1px solid #4a2a4a", borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ color: "#e8a020", fontFamily: S.mono, fontSize: 10, letterSpacing: 1, marginBottom: 10 }}>🔩 REPUESTOS DEL SERVICIO</div>
              {quotedParts.map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < quotedParts.length - 1 ? `1px solid ${S.border}` : "none" }}>
                  {p.sku && <span style={{ fontSize: 9, fontFamily: S.mono, background: "rgba(108,31,110,.25)", color: "#d0a0d0", padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>{p.sku}</span>}
                  <span style={{ color: S.text, fontSize: 13, flex: 1 }}>{p.description}</span>
                  <span style={{ color: p.installed ? "#4caf50" : "#e8a020", border: `1px solid ${p.installed ? "#4caf50" : "#e8a020"}`, borderRadius: 999, padding: "1px 6px", fontSize: 9, fontFamily: S.mono, flexShrink: 0 }}>
                    {p.installed ? "INSTALADO" : "PENDIENTE"}
                  </span>
                  <span style={{ color: S.muted, fontSize: 11, fontFamily: S.mono, flexShrink: 0 }}>
                    ×{p.quantity}{p.unitPrice > 0 ? ` · ${money(p.quantity * p.unitPrice)}` : ""}
                  </span>
                </div>
              ))}
              {quotedParts.some(p => p.unitPrice > 0) && (
                <div style={{ textAlign: "right" as const, color: "#e8a020", fontFamily: S.mono, fontSize: 11, fontWeight: 700, paddingTop: 8 }}>
                  Estimado repuestos: {money(quotedParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0))}
                </div>
              )}
            </div>
          )}

          {/* Motivo de ingreso */}
          {data.intakeReportedIssue && (
            <div style={{ background: S.subtle, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ color: S.muted, fontFamily: S.mono, fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>MOTIVO DE INGRESO</div>
              <div style={{ color: "#c8a8c8", fontSize: 13, lineHeight: 1.5 }}>{data.intakeReportedIssue}</div>
            </div>
          )}

          {data.processChecklist && (
            <div style={{ background: S.subtle, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ color: S.muted, fontFamily: S.mono, fontSize: 9, letterSpacing: 1, marginBottom: 8 }}>CHECKLIST DE PROCESO</div>
              {(() => {
                const progress = processChecklistProgress(data.processChecklist);
                return <div style={{ color: "#c8a8c8", fontSize: 12, marginBottom: 8 }}>Avance registrado: {progress.label}</div>;
              })()}
              {buildProcessChecklist(data.processChecklist).filter(item => item.done).map(item => (
                <div key={item.key} style={{ color: "#c8a8c8", fontSize: 12, lineHeight: 1.5 }}>✓ {item.label}{item.note ? ` · ${item.note}` : ""}</div>
              ))}
            </div>
          )}

          {/* Lista para recoger */}
          {cur === 4 && (
            <div style={{ background: "#1a3a1a", border: "1px solid #4caf50", borderRadius: 10, padding: 16, textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
              <div style={{ color: "#4caf50", fontWeight: 700, fontSize: 17 }}>¡Tu bici está lista!</div>
              <div style={{ color: "#a0c0a0", fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                Puedes acercarte a recogerla en nuestro taller.
              </div>
              <div style={{ color: "#a0c0a0", fontSize: 12, marginTop: 10, padding: "10px 12px", background: "#0d1f0d", borderRadius: 8, lineHeight: 1.6, textAlign: "left" as const }}>
                ⏳ Tienes <strong style={{ color: "#4caf50" }}>5 días calendario</strong> para recogerla.<br />
                Después: cobro de <strong style={{ color: "#4caf50" }}>$4.000 COP/día</strong> por bodegaje.
              </div>
              {daysSinceCompleted !== null && daysSinceCompleted > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: daysSinceCompleted >= 5 ? "#e05555" : "#e8a020", fontWeight: 600 }}>
                  {daysSinceCompleted >= 5
                    ? `🔴 Han pasado ${daysSinceCompleted} días desde que quedó lista.`
                    : `⚠️ Han pasado ${daysSinceCompleted} día${daysSinceCompleted > 1 ? "s" : ""} desde que quedó lista.`}
                </div>
              )}
            </div>
          )}

          {data.deliveryStatus === "entregada" && data.deliverySignatureName && (
            <div style={{ background: S.subtle, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ color: S.muted, fontFamily: S.mono, fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>ENTREGA CONFIRMADA</div>
              <div style={{ color: "#c8a8c8", fontSize: 13, lineHeight: 1.5 }}>Recibido por: <strong>{data.deliverySignatureName}</strong></div>
              {data.deliveryAcceptanceText && <div style={{ color: "#c8a8c8", fontSize: 12, lineHeight: 1.5, marginTop: 6 }}>{data.deliveryAcceptanceText}</div>}
              {deliveredDate && <div style={{ color: S.muted, fontSize: 11, marginTop: 4 }}>Fecha: {deliveredDate}</div>}
            </div>
          )}

          {/* Cobro */}
          {customerTicket.subtotal > 0 && (
            <div style={{ background: "#122212", border: "1px solid #4caf50", borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ color: "#4caf50", fontFamily: S.mono, fontSize: 10, letterSpacing: 1, marginBottom: 10 }}>RESUMEN DE COBRO</div>
              {(customerTicket.billing.parts || []).filter((i: any) => i.description).map((item: any, idx: number) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid #1a3a1a`, fontSize: 12 }}>
                  <span style={{ color: "#c8e8c8" }}>{item.description}{item.quantity > 1 ? ` ×${item.quantity}` : ""}{item.discountPercent ? ` · ${item.discountPercent}% desc` : ""}</span>
                  <span style={{ color: "#a0c0a0", fontFamily: S.mono }}>{money(item.quantity * item.unitPrice)}</span>
                </div>
              ))}
              {(customerTicket.billing.labor || []).filter((i: any) => i.description).map((item: any, idx: number) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: `1px solid #1a3a1a`, fontSize: 12 }}>
                  <span style={{ color: "#c8e8c8" }}>🔧 {item.description}{item.quantity > 1 ? ` ×${item.quantity}` : ""}{item.discountPercent ? ` · ${item.discountPercent}% desc` : ""}</span>
                  <span style={{ color: "#a0c0a0", fontFamily: S.mono }}>{money(item.quantity * item.unitPrice)}</span>
                </div>
              ))}
              <div style={{ paddingTop: 8, display: "flex", flexDirection: "column" as const, gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#a0c0a0", fontSize: 13 }}>Total</span>
                  <span style={{ color: "#c8e8c8", fontSize: 15, fontWeight: 700 }}>{money(customerTicket.subtotal)}</span>
                </div>
                {customerTicket.advance > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#a0c0a0", fontSize: 12 }}>Abono pagado</span>
                    <span style={{ color: "#4caf50", fontSize: 13 }}>- {money(customerTicket.advance)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #2a4a2a", paddingTop: 6 }}>
                  <span style={{ color: "#a0c0a0", fontSize: 13, fontWeight: 600 }}>Saldo a pagar</span>
                  <span style={{ color: customerTicket.balance > 0 ? "#e8a020" : "#4caf50", fontSize: 15, fontWeight: 700 }}>{money(customerTicket.balance)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Diagnósticos técnicos */}
          {diags.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: S.muted, fontFamily: S.mono, fontSize: 9, letterSpacing: 1, marginBottom: 10 }}>DIAGNÓSTICO TÉCNICO</div>
              {[...diags].reverse().map(d => (
                <div key={d.id} style={{ background: S.subtle, border: `1px solid ${S.border}`, borderRadius: 10, padding: 14, marginBottom: 10 }}>
                  <div style={{ color: S.muted, fontFamily: S.mono, fontSize: 9, marginBottom: 8 }}>
                    {new Date(d.date).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {d.estado && <div style={{ marginBottom: 6 }}><span style={{ color: "#9c4a9e", fontSize: 10, fontFamily: S.mono }}>ESTADO · </span><span style={{ color: S.text, fontSize: 13 }}>{d.estado}</span></div>}
                  {d.hallazgos && <div style={{ marginBottom: 6 }}><span style={{ color: "#9c4a9e", fontSize: 10, fontFamily: S.mono }}>HALLAZGOS · </span><span style={{ color: "#c8a8c8", fontSize: 13 }}>{d.hallazgos}</span></div>}
                  {d.problemas && <div style={{ marginBottom: 6 }}><span style={{ color: "#c0392b", fontSize: 10, fontFamily: S.mono }}>PROBLEMAS · </span><span style={{ color: "#c8a8c8", fontSize: 13 }}>{d.problemas}</span></div>}
                  {d.recomendaciones && <div style={{ marginBottom: d.partes.length > 0 ? 8 : 0 }}><span style={{ color: "#5cc8e8", fontSize: 10, fontFamily: S.mono }}>RECOMENDACIONES · </span><span style={{ color: "#c8a8c8", fontSize: 13 }}>{d.recomendaciones}</span></div>}
                  {d.labor && <div style={{ marginBottom: d.partes.length > 0 ? 8 : 0 }}><span style={{ color: "#9c4a9e", fontSize: 10, fontFamily: S.mono }}>MANO DE OBRA · </span><span style={{ color: "#c8a8c8", fontSize: 13 }}>{d.labor}</span></div>}
                  {d.partes.length > 0 && (
                    <div style={{ background: "#221222", borderRadius: 8, padding: "8px 12px", marginTop: 8 }}>
                      <div style={{ color: "#e8a020", fontFamily: S.mono, fontSize: 9, letterSpacing: 1, marginBottom: 6 }}>🔩 REPUESTOS MENCIONADOS</div>
                      {d.partes.map((p, i) => (
                        <div key={i} style={{ color: S.text, fontSize: 12, padding: "3px 0", borderBottom: i < d.partes.length - 1 ? `1px solid ${S.border}` : "none" }}>
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

function ServiceProcessChecklist({ service, editable = false, session, onChange, initialOpen = false }: { service: BikeService; editable?: boolean; session?: Session; onChange?: (items: ProcessChecklistItem[]) => void; initialOpen?: boolean }) {
  const items = buildProcessChecklist(service.processChecklist);
  const byKey = new Map(items.map(item => [item.key, item]));
  const progress = processChecklistProgress(items);
  const [open, setOpen] = useState(initialOpen);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const updateItem = (key: string, changes: Partial<ProcessChecklistItem>) => {
    const now = new Date().toISOString();
    const next = items.map(item => {
      if (item.key !== key) return item;
      const nextDone = changes.done ?? item.done;
      return {
        ...item,
        ...changes,
        updatedAt: now,
        ...(nextDone && !item.done ? { completedAt: now, completedById: session?.id || session?.type || "admin", completedByName: session?.name || (session?.type === "admin" ? "Admin" : "Usuario") } : {}),
        ...(!nextDone ? { completedAt: undefined, completedById: undefined, completedByName: undefined } : {}),
      };
    });
    onChange?.(normalizeProcessChecklist(next));
  };
  const toggleGroup = (title: string) => setOpenGroups(p => ({ ...p, [title]: !(p[title] ?? true) }));

  return (
    <div style={{ border: "1.2px dashed var(--line)", borderRadius: 8, padding: 10, marginTop: 8, background: "var(--paper)", boxShadow: "0 1px 0 rgba(0,0,0,.04)" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{ width: "100%", border: "none", background: "transparent", color: "inherit", cursor: "pointer", padding: 0, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: open ? 8 : 0, fontFamily: "inherit", textAlign: "left" as const }}
      >
        <div>
          <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1 }}>CHECKLIST DE PROCESO</div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{open ? "Ocultar detalle" : "Toca para desplegar revisión, desarme, videos y cierre"}</div>
        </div>
        <span className="chip" style={{ fontSize: 10, padding: "1px 7px" }}>{progress.label}</span>
      </button>
      {open && PROCESS_CHECKLIST_GROUPS.map(group => {
        const groupOpen = openGroups[group.title] ?? true;
        return (
          <div key={group.title} style={{ marginBottom: 8, borderTop: "1px solid var(--line)", paddingTop: 7 }}>
            <button type="button" onClick={() => toggleGroup(group.title)} style={{ width: "100%", border: "none", background: "transparent", color: "var(--ink)", cursor: "pointer", padding: "0 0 5px", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: "inherit", textAlign: "left" as const }}>
              <span style={{ fontSize: 11, fontWeight: 700 }}>{group.title}</span>
              <span style={{ color: "var(--accent)", transform: groupOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .16s ease" }}>⌄</span>
            </button>
            {groupOpen && group.items.map(base => {
              const item = byKey.get(base.key) || { ...base, done: false, note: "" };
              return (
                <label key={base.key} style={{ display: "grid", gridTemplateColumns: editable ? "18px 1fr" : "16px 1fr", gap: 6, alignItems: "start", fontSize: 12, marginBottom: 4, color: item.done ? "var(--ink)" : "var(--ink-3)" }}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    disabled={!editable}
                    onChange={e => updateItem(base.key, { done: e.target.checked })}
                    style={{ width: 14, height: 14, marginTop: 2, cursor: editable ? "pointer" : "default" }}
                  />
                  <span>
                    {item.label}
                    {item.done && item.completedByName && <span className="sk-mono" style={{ display: "block", fontSize: 9, color: "var(--ink-3)", marginTop: 1 }}>Marcado por {item.completedByName}</span>}
                    {editable ? (
                      <input
                        value={item.note || ""}
                        onChange={e => updateItem(base.key, { note: e.target.value })}
                        placeholder="Nota / link de video"
                        style={{ display: "block", width: "100%", marginTop: 2, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--paper)", fontSize: 11, fontFamily: "inherit", boxSizing: "border-box" }}
                      />
                    ) : item.note ? (
                      <span style={{ display: "block", fontSize: 11, color: "var(--ink-3)" }}>{item.note}</span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal nuevo servicio ─────────────────────────────────────────────────────
function NewServiceModal({ onClose, onAdd, team = [], initialDate, initialServiceType = "", loyverseToken = "", clients = [], onUpsertClient = (_: Client) => {} }: { onClose: () => void; onAdd: (s: BikeService) => void; team?: any[]; initialDate?: string; initialServiceType?: string; loyverseToken?: string; clients?: Client[]; onUpsertClient?: (c: Client) => void }) {
  const workshopTeam = team; // Mostrar todo el equipo en el dropdown de técnico asignado
  const prefilledService = useMemo(() => {
    const fromProps = resolveServiceValue(initialServiceType || "");
    if (fromProps) return fromProps;
    try {
      const stored = sessionStorage.getItem(SERVICE_PREFILL_KEY) || localStorage.getItem(SERVICE_PREFILL_KEY) || "";
      return resolveServiceValue(stored);
    } catch {
      return "";
    }
  }, [initialServiceType]);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientDocument, setClientDocument] = useState("");
  const [loyverseCustomerId, setLoyverseCustomerId] = useState("");
  const [customerLooking, setCustomerLooking] = useState(false);
  const [customerFound, setCustomerFound] = useState<null | boolean>(null);
  const [bikeDescription, setBikeDescription] = useState("");
  const [date, setDate] = useState(initialDate || _addDays(0));
  const [scheduledDate, setScheduledDate] = useState(initialDate || _addDays(0));
  const [neededByDate, setNeededByDate] = useState("");
  const [notes, setNotes] = useState("");
  const [intakeCondition, setIntakeCondition] = useState("");
  const [intakeAccessories, setIntakeAccessories] = useState("");
  const [intakeReportedIssue, setIntakeReportedIssue] = useState("");
  const [intakeSignatureName, setIntakeSignatureName] = useState("");
  const [intakeChecklist, setIntakeChecklist] = useState<IntakeChecklistItem[]>(() => buildIntakeChecklist());
  const [serviceType, setServiceType] = useState(prefilledService);
  const [serviceTypeLocked, setServiceTypeLocked] = useState(!!prefilledService);
  const [serviceDiscountPercent, setServiceDiscountPercent] = useState("");
  const [technicianId, setTechnicianId] = useState(workshopTeam[0]?.id || "");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:30");
  const [paymentStatus, setPaymentStatus] = useState<"pendiente" | "pagado" | "adelanto">("pendiente");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [quotedParts, setQuotedParts] = useState<QuotedPart[]>([]);
  const [qaRow, setQaRow] = useState({ sku: "", description: "", quantity: "1", unitPrice: "", discountPercent: "", looking: false, found: null as null | boolean, loyverseItemId: undefined as string | undefined, loyverseVariantId: undefined as string | undefined });
  const [foundClient, setFoundClient] = useState<Client | null>(null);
  const [selectedBikeId, setSelectedBikeId] = useState<string>("nueva");
  const doQaLookup = async (sku: string) => {
    if (!sku.trim()) return;
    if (!loyverseToken) { alert("Configura el token de Loyverse en la sección Integraciones del menú."); return; }
    setQaRow(r => ({ ...r, looking: true, found: null }));
    try {
      const result = await lookupLoyverseSKU(sku, loyverseToken);
      setQaRow(r => result
        ? { ...r, description: result.name, unitPrice: String(result.price), loyverseItemId: result.itemId, loyverseVariantId: result.variantId, looking: false, found: true }
        : { ...r, loyverseItemId: undefined, loyverseVariantId: undefined, looking: false, found: false });
    } catch (error: any) {
      setQaRow(r => ({ ...r, looking: false, found: null, loyverseItemId: undefined, loyverseVariantId: undefined }));
      alert(`No se pudo consultar Loyverse:\n${loyverseErrorMessage(error)}`);
    }
  };
  const doCustomerLookup = async () => {
    const doc = clientDocument.trim();
    const emailVal = clientEmail.trim();
    // Search local clients first
    const localClient = doc ? clients.find(c => c.document && c.document === doc)
                            : emailVal ? clients.find(c => c.email === emailVal) : undefined;
    if (localClient) {
      setFoundClient(localClient);
      setCustomerFound(true);
      setLoyverseCustomerId(localClient.loyverseCustomerId || "");
      setClientName(localClient.name);
      setClientEmail(localClient.email);
      if (localClient.phone) setClientPhone(localClient.phone);
      if (localClient.document) setClientDocument(localClient.document);
      if (localClient.bikes.length > 0) setSelectedBikeId(localClient.bikes[localClient.bikes.length - 1].id);
      return;
    }
    if (!doc) return;
    if (!loyverseToken) {
      setCustomerFound(false);
      return;
    }
    setCustomerLooking(true);
    setCustomerFound(null);
    let result: Awaited<ReturnType<typeof lookupLoyverseCustomerByDocument>> = null;
    try {
      result = await lookupLoyverseCustomerByDocument(doc, loyverseToken);
    } catch (error: any) {
      setCustomerLooking(false);
      setCustomerFound(null);
      alert(`No se pudo consultar clientes en Loyverse:\n${loyverseErrorMessage(error)}`);
      return;
    }
    setCustomerLooking(false);
    if (!result) { setCustomerFound(false); setLoyverseCustomerId(""); return; }
    setCustomerFound(true);
    setLoyverseCustomerId(result.id);
    if (result.name) setClientName(result.name);
    if (result.email) setClientEmail(result.email);
    if (result.phone) setClientPhone(result.phone);
    if (result.document) setClientDocument(result.document);
  };
  const addQaPart = () => {
    if (!qaRow.description.trim()) return;
    if (!qaRow.loyverseItemId) {
      alert("Busca y selecciona el repuesto en Loyverse antes de agregarlo. El precio base debe venir de Loyverse.");
      return;
    }
    const originalUnitPrice = parseFloat(qaRow.unitPrice) || 0;
    const discountPercent = clampDiscount(parseFloat(qaRow.discountPercent));
    const part: QuotedPart = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      description: qaRow.description.trim(),
      quantity: parseFloat(qaRow.quantity) || 1,
      originalUnitPrice: discountPercent ? originalUnitPrice : undefined,
      discountPercent: discountPercent || undefined,
      unitPrice: discountPercent ? discountedUnitPrice({ unitPrice: originalUnitPrice, originalUnitPrice, discountPercent }) : originalUnitPrice,
      ...(qaRow.sku.trim() ? { sku: qaRow.sku.trim() } : {}),
      ...(qaRow.loyverseItemId ? { loyverseItemId: qaRow.loyverseItemId, loyverseVariantId: qaRow.loyverseVariantId } : {}),
    };
    setQuotedParts(p => [...p, part]);
    setQaRow({ sku: "", description: "", quantity: "1", unitPrice: "", discountPercent: "", looking: false, found: null, loyverseItemId: undefined, loyverseVariantId: undefined });
  };
  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.3px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit", marginBottom: 10 };
  const lbl: React.CSSProperties = { fontSize: 11, fontFamily: "var(--mono)", color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase" as const, display: "block", marginBottom: 4 };
  const missingFields: string[] = [];
  if (!clientName.trim())           missingFields.push("Nombre del cliente");
  if (!clientEmail.trim())          missingFields.push("Email del cliente");
  if (!clientPhone.trim())          missingFields.push("Teléfono");
  if (!clientDocument.trim())       missingFields.push("Documento");
  if (!bikeDescription.trim())      missingFields.push("Descripción de la bici");
  if (!intakeReportedIssue.trim())  missingFields.push("Falla / motivo de ingreso");
  if (!intakeCondition.trim())      missingFields.push("Estado inicial de la bici");
  if (!intakeSignatureName.trim())  missingFields.push("Quién entrega / autoriza");
  if (!serviceType.trim())          missingFields.push("Servicio solicitado");
  if (!technicianId)                missingFields.push("Técnico asignado");
  // Checklist: ítems "Revisar" o "Falta" necesitan nota
  const checklistBlockers = intakeChecklist.filter(
    item => (item.status === "attention" || item.status === "missing") && !item.note?.trim()
  );
  checklistBlockers.forEach(item => missingFields.push(`Checklist "${item.label}" — agrega una nota`));
  const canAdd = missingFields.length === 0;
  const resolvedServicePreview = resolveServiceValue(serviceType || prefilledService) || undefined;
  const serviceLinePreview = serviceCatalogLine(resolvedServicePreview, clampDiscount(parseFloat(serviceDiscountPercent)));
  const serviceBasePrice = serviceLinePreview ? Number(serviceLinePreview.originalUnitPrice ?? serviceLinePreview.unitPrice) : 0;
  const serviceDiscount = serviceLinePreview?.discountPercent || 0;
  const serviceFinalPrice = serviceLinePreview?.unitPrice || 0;
  const quotedPartsTotal = quotedParts.reduce((sum, part) => sum + part.quantity * part.unitPrice, 0);
  const ticketSubtotalPreview = serviceFinalPrice + quotedPartsTotal;
  const ticketAdvancePreview = paymentStatus === "adelanto" ? (parseFloat(paymentAmount) || 0) : 0;
  const ticketBalancePreview = Math.max(0, ticketSubtotalPreview - ticketAdvancePreview);
  useEffect(() => {
    setServiceType(prefilledService);
    setServiceTypeLocked(!!prefilledService);
  }, [prefilledService]);
  useEffect(() => {
    return () => {
      try { sessionStorage.removeItem(SERVICE_PREFILL_KEY); localStorage.removeItem(SERVICE_PREFILL_KEY); } catch {}
    };
  }, []);
  useEffect(() => {
    if (!technicianId && workshopTeam.length > 0) setTechnicianId(workshopTeam[0].id);
    if (technicianId && !workshopTeam.some(m => m.id === technicianId)) setTechnicianId("");
  }, [technicianId, workshopTeam]);
  const handleAdd = async () => {
    if (!canAdd || saving) return;
    setSaving(true);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const resolvedServiceType = resolveServiceValue(serviceType || prefilledService) || undefined;
    const serviceLine = await serviceCatalogLineWithLoyverse(resolvedServiceType, clampDiscount(parseFloat(serviceDiscountPercent)), loyverseToken);
    const newService: BikeService = {
      id, clientName: clientName.trim(), clientEmail: clientEmail.trim(),
      bikeDescription: bikeDescription.trim(), date, phase: 0,
      clientPhone: clientPhone.trim() || undefined,
      clientDocument: clientDocument.trim() || undefined,
      loyverseCustomerId: loyverseCustomerId || undefined,
      intakeCondition: intakeCondition.trim() || undefined,
      intakeAccessories: splitLines(intakeAccessories),
      intakeReportedIssue: intakeReportedIssue.trim() || undefined,
      intakeSignatureName: intakeSignatureName.trim() || clientName.trim(),
      intakeChecklist: normalizeIntakeChecklist(intakeChecklist),
      processChecklist: normalizeProcessChecklist(),
      workshopStatus: "ingresada",
      scheduledDate: scheduledDate !== date ? scheduledDate : undefined,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), notes,
      serviceType: resolvedServiceType,
      startTime, endTime,
      technicianId: technicianId || undefined,
      paymentStatus,
      paymentAmount: paymentStatus === "adelanto" ? (parseFloat(paymentAmount) || 0) : undefined,
      deliveryStatus: "en_taller",
      neededByDate: neededByDate || undefined,
      diagnosticUpdates: [],
      quotedParts: quotedParts.length > 0 ? quotedParts : undefined,
      finalBilling: serviceLine ? calcBilling({ ...blankBilling(paymentStatus, paymentStatus === "adelanto" ? (parseFloat(paymentAmount) || 0) : 0), labor: [serviceLine] }) : undefined,
    };
    // Client upsert logic
    const existingClient = foundClient || clients.find(c =>
      (clientDocument.trim() && c.document === clientDocument.trim()) ||
      (clientEmail.trim() && c.email === clientEmail.trim())
    );
    const newBikeId = (selectedBikeId !== "nueva" && foundClient) ? selectedBikeId
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
    const newBike: ClientBike = { id: newBikeId, description: bikeDescription.trim() };
    if (existingClient) {
      const hasBike = existingClient.bikes.some(b => b.id === newBikeId);
      const updatedClient: Client = {
        ...existingClient,
        name: clientName.trim(),
        email: clientEmail.trim(),
        phone: clientPhone.trim() || existingClient.phone,
        document: clientDocument.trim() || existingClient.document,
        loyverseCustomerId: loyverseCustomerId || existingClient.loyverseCustomerId,
        bikes: hasBike ? existingClient.bikes : [...existingClient.bikes, newBike],
      };
      onUpsertClient(updatedClient);
      (newService as any).clientId = existingClient.id;
      (newService as any).bikeId = newBikeId;
    } else {
      const clientId = Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
      const newClient: Client = {
        id: clientId, name: clientName.trim(), email: clientEmail.trim(),
        phone: clientPhone.trim() || undefined, document: clientDocument.trim() || undefined,
        loyverseCustomerId: loyverseCustomerId || undefined,
        bikes: [newBike], createdAt: new Date().toISOString(),
      };
      onUpsertClient(newClient);
      (newService as any).clientId = clientId;
      (newService as any).bikeId = newBikeId;
    }
    onAdd(newService);
    onClose();
    setSaving(false);
    // Email se envía en segundo plano sin bloquear el cierre del modal
    const trackingLink = buildTrackingUrl(newService);
    sendEmail(EMAILJS_SERVICE_ID, EMAILJS_SERVICE_TEMPLATE_ID, {
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
        {serviceTypeLocked && serviceType && (
          <div style={{ background: "var(--accent-soft)", border: "1.5px solid var(--accent)", color: "var(--accent)", borderRadius: 10, padding: "9px 11px", marginBottom: 12, fontSize: 13, fontWeight: 700 }}>
            Servicio recibido del catálogo: {serviceType}
          </div>
        )}
        <label style={lbl}>Nombre del cliente *</label>
        <input style={{ ...inp, borderColor: !clientName.trim() ? "#c0392b" : undefined }} value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Juan García" autoFocus />
        <label style={lbl}>Email del cliente *</label>
        <input style={{ ...inp, borderColor: !clientEmail.trim() ? "#c0392b" : undefined }} type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="juan@email.com" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>Teléfono *</label>
            <input style={{ ...inp, borderColor: !clientPhone.trim() ? "#c0392b" : undefined }} value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="300 000 0000" />
          </div>
          <div>
            <label style={lbl}>Documento *</label>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <input
                style={{ ...inp, flex: 1 }}
                value={clientDocument}
                onChange={e => { setClientDocument(e.target.value); setCustomerFound(null); setLoyverseCustomerId(""); }}
                onKeyDown={e => { if (e.key === "Enter") doCustomerLookup(); }}
                placeholder="CC / NIT"
              />
              <button type="button" className="action" style={{ fontSize: 11, padding: "7px 9px", flexShrink: 0 }} onClick={doCustomerLookup} disabled={customerLooking || (!clientDocument.trim() && !clientEmail.trim())}>
                {customerLooking ? "..." : "Buscar"}
              </button>
            </div>
            {customerFound === true && <div style={{ fontSize: 10, color: "#2e7d32", marginTop: -6, marginBottom: 8 }}>Cliente encontrado y vinculado al ticket.</div>}
            {customerFound === false && <div style={{ fontSize: 10, color: "#c0392b", marginTop: -6, marginBottom: 8 }}>Cliente no encontrado. Puedes llenar los datos manualmente.</div>}
          </div>
        </div>
        {foundClient && (
          <div style={{ background: "rgba(108,31,110,.07)", border: "1.2px solid #6c1f6e", borderRadius: 8, padding: "7px 10px", marginBottom: 10, fontSize: 11, color: "#6c1f6e" }}>
            ✓ Cliente conocido · {foundClient.bikes.length} bici{foundClient.bikes.length !== 1 ? "s" : ""} registrada{foundClient.bikes.length !== 1 ? "s" : ""}
          </div>
        )}
        <label style={lbl}>Descripción de la bici *</label>
        <input style={{ ...inp, borderColor: !bikeDescription.trim() ? "#c0392b" : undefined }} value={bikeDescription} onChange={e => setBikeDescription(e.target.value)} placeholder="Trek Marlin azul 2022" />
        {foundClient && foundClient.bikes.length > 0 && (
          <div style={{ border: "1.3px solid #6c1f6e", borderRadius: 8, padding: "10px 12px", marginBottom: 10, background: "rgba(108,31,110,.04)" }}>
            <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "#6c1f6e", letterSpacing: 1, marginBottom: 8 }}>🚲 BICICLETAS DEL CLIENTE</div>
            {foundClient.bikes.map(b => (
              <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer", fontSize: 12 }}>
                <input type="radio" name="clientBike" value={b.id} checked={selectedBikeId === b.id}
                  onChange={() => { setSelectedBikeId(b.id); setBikeDescription(b.description); }} />
                <span>{b.description}{b.serial ? ` · Serie: ${b.serial}` : ""}</span>
              </label>
            ))}
            <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer", fontSize: 12 }}>
              <input type="radio" name="clientBike" value="nueva" checked={selectedBikeId === "nueva"}
                onChange={() => { setSelectedBikeId("nueva"); setBikeDescription(""); }} />
              <span style={{ color: "#6c1f6e", fontWeight: 600 }}>+ Nueva bicicleta</span>
            </label>
          </div>
        )}
        <label style={lbl}>Motivo de ingreso / falla reportada *</label>
        <textarea style={{ ...inp, resize: "vertical" as const, minHeight: 52, borderColor: !intakeReportedIssue.trim() ? "#c0392b" : undefined }} value={intakeReportedIssue} onChange={e => setIntakeReportedIssue(e.target.value)} placeholder="Ruido en la transmisión, frenos largos, revisión general..." />
        <label style={lbl}>Estado inicial de la bicicleta *</label>
        <textarea style={{ ...inp, resize: "vertical" as const, minHeight: 52, borderColor: !intakeCondition.trim() ? "#c0392b" : undefined }} value={intakeCondition} onChange={e => setIntakeCondition(e.target.value)} placeholder="Rayones, golpes, llantas, frenos, cambios, suciedad, piezas faltantes..." />
        <label style={lbl}>Accesorios recibidos (uno por línea)</label>
        <textarea style={{ ...inp, resize: "vertical" as const, minHeight: 52 }} value={intakeAccessories} onChange={e => setIntakeAccessories(e.target.value)} placeholder={"Ciclocomputador\nLuces\nPortacaramañola"} />

        <div style={{ border: "1.3px dashed var(--line)", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 8 }}>
            Checklist de ingreso
            <span style={{ marginLeft: 8, color: "#c0392b" }}>— "Revisar" y "Falta" requieren nota</span>
          </div>
          {intakeChecklist.map(item => {
            const needsNote = (item.status === "attention" || item.status === "missing") && !item.note?.trim();
            return (
              <div key={item.key} style={{ display: "grid", gridTemplateColumns: "1fr 96px", gap: 6, marginBottom: 6, alignItems: "center", ...(needsNote ? { background: "rgba(192,57,43,.04)", borderRadius: 6, padding: "4px 6px" } : {}) }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{item.label}{needsNote && <span style={{ color: "#c0392b", marginLeft: 4 }}>*</span>}</div>
                <select
                  style={{ ...inp, marginBottom: 0, padding: "6px 8px", fontSize: 12, borderColor: needsNote ? "#c0392b" : undefined }}
                  value={item.status}
                  onChange={e => setIntakeChecklist(list => list.map(row => row.key === item.key ? { ...row, status: e.target.value as IntakeChecklistStatus } : row))}
                >
                  <option value="ok">OK</option>
                  <option value="attention">Revisar</option>
                  <option value="missing">Falta</option>
                  <option value="na">N/A</option>
                </select>
                <input
                  style={{ ...inp, marginBottom: 0, padding: "6px 8px", fontSize: 12, gridColumn: "1 / -1", borderColor: needsNote ? "#c0392b" : undefined }}
                  value={item.note || ""}
                  onChange={e => setIntakeChecklist(list => list.map(row => row.key === item.key ? { ...row, note: e.target.value } : row))}
                  placeholder={needsNote ? "Nota obligatoria — describe el estado" : "Nota opcional"}
                />
              </div>
            );
          })}
        </div>

        {/* ── Repuestos para cambio (cotización al ingresar) ── */}
        <div style={{ border: "1.3px dashed var(--line)", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 8 }}>🔩 Repuestos para cambio</div>

          {quotedParts.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {quotedParts.map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "3px 0", borderBottom: "1px dashed var(--line)" }}>
                  {p.sku && <span style={{ fontSize: 9, fontFamily: "var(--mono)", background: "rgba(108,31,110,.1)", color: "#6c1f6e", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>{p.sku}</span>}
                  {p.loyverseItemId && <span style={{ fontSize: 10, color: "#5cc8e8", flexShrink: 0 }}>🔗</span>}
                  <span style={{ flex: 1 }}>{p.description}</span>
                  <span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--mono)", flexShrink: 0 }}>×{p.quantity}{p.discountPercent ? ` · ${p.discountPercent}%` : ""}{p.unitPrice > 0 ? ` · ${money(p.quantity * p.unitPrice)}` : ""}</span>
                  <button onClick={() => setQuotedParts(ps => ps.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                </div>
              ))}
              {quotedParts.some(p => p.unitPrice > 0) && (
                <div style={{ textAlign: "right" as const, fontSize: 10, color: "#6c1f6e", fontFamily: "var(--mono)", paddingTop: 4, fontWeight: 700 }}>
                  Estimado: {money(quotedParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" as const }}>
            <div style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0 }}>
              <input
                style={{ width: 84, padding: "6px 8px", borderRadius: 6, border: `1.2px solid ${qaRow.found === true ? "#5cc8e8" : qaRow.found === false ? "#c0392b" : "var(--line)"}`, background: "var(--paper)", color: "var(--ink)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" as const }}
                value={qaRow.sku}
                onChange={e => setQaRow(r => ({ ...r, sku: e.target.value, found: null, loyverseItemId: undefined, loyverseVariantId: undefined }))}
                onKeyDown={e => { if (e.key === "Enter") doQaLookup(qaRow.sku); }}
                placeholder="Código SKU"
              />
              <button
                onClick={() => doQaLookup(qaRow.sku)}
                disabled={!qaRow.sku.trim() || qaRow.looking}
                style={{ background: qaRow.found === true ? "rgba(92,200,232,.15)" : "var(--paper)", border: `1.2px solid ${qaRow.found === true ? "#5cc8e8" : "var(--line)"}`, borderRadius: 6, cursor: "pointer", padding: "6px 8px", fontSize: 13, color: qaRow.found === true ? "#5cc8e8" : "var(--ink-3)", lineHeight: 1 }}
                title="Buscar en Loyverse"
              >
                {qaRow.looking ? "⏳" : "🔍"}
              </button>
            </div>
            <input
              style={{ flex: 1, minWidth: 110, padding: "6px 8px", borderRadius: 6, border: `1.2px solid ${qaRow.found === true ? "#5cc8e8" : "var(--line)"}`, background: "var(--paper)", color: "var(--ink)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" as const }}
              value={qaRow.description}
              readOnly
              placeholder={qaRow.found === true ? "✓ auto-completado" : "Descripción del repuesto"}
            />
            <input style={{ width: 44, padding: "6px 4px", borderRadius: 6, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 12, fontFamily: "inherit", textAlign: "center" as const, boxSizing: "border-box" as const }}
              type="number" min="1" value={qaRow.quantity} onChange={e => setQaRow(r => ({ ...r, quantity: e.target.value }))} />
            <input style={{ width: 84, padding: "6px 8px", borderRadius: 6, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 12, fontFamily: "inherit", textAlign: "right" as const, boxSizing: "border-box" as const }}
              type="number" min="0" value={qaRow.unitPrice} readOnly title="Precio tomado de Loyverse. Ajusta solo con descuento." placeholder="$ precio" />
            <input style={{ width: 52, padding: "6px 6px", borderRadius: 6, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 12, fontFamily: "inherit", textAlign: "right" as const, boxSizing: "border-box" as const }}
              type="number" min="0" max="100" value={qaRow.discountPercent} onChange={e => setQaRow(r => ({ ...r, discountPercent: e.target.value }))} placeholder="%" />
            <button type="button" className="action" style={{ fontSize: 10, padding: "4px 7px" }} onClick={() => setQaRow(r => ({ ...r, discountPercent: "20" }))}>20%</button>
            <button type="button" className="action" style={{ fontSize: 10, padding: "4px 7px" }} onClick={() => setQaRow(r => ({ ...r, discountPercent: "30" }))}>30%</button>
            <button className="action ink" style={{ fontSize: 11, flexShrink: 0 }} onClick={addQaPart} disabled={!qaRow.loyverseItemId}>+ Agregar</button>
          </div>
          {parseFloat(qaRow.unitPrice) > 0 && (
            <div style={{ fontSize: 10, color: "#2e7d32", marginTop: 4, fontFamily: "var(--mono)" }}>
              Producto: {money((parseFloat(qaRow.quantity) || 1) * discountedUnitPrice({ unitPrice: parseFloat(qaRow.unitPrice) || 0, discountPercent: clampDiscount(parseFloat(qaRow.discountPercent)) }))}
            </div>
          )}
          {qaRow.found === false && <div style={{ fontSize: 10, color: "#c0392b", marginTop: 4 }}>Código no encontrado en Loyverse. Revisa el código o créalo en Loyverse para poder agregarlo.</div>}
          {qaRow.found === true && <div style={{ fontSize: 10, color: "#5cc8e8", marginTop: 4 }}>✓ Encontrado en Loyverse — nombre y precio completados.</div>}
        </div>

        <label style={lbl}>Servicio solicitado *</label>
        {serviceTypeLocked ? (
          <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginBottom: 10 }}>
            <input
              style={{ ...inp, marginBottom: 0, background: "var(--accent-soft)", borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 700 }}
              value={serviceType}
              readOnly
              aria-label="Servicio solicitado seleccionado"
            />
            <button
              type="button"
              className="action"
              style={{ fontSize: 12, whiteSpace: "nowrap" as const }}
              onClick={() => setServiceTypeLocked(false)}
            >
              Cambiar
            </button>
          </div>
        ) : (
          <ServiceTypeInput
            style={{ ...inp, marginBottom: 10 }}
            value={serviceType}
            onChange={setServiceType}
            placeholder="Escribe código, nombre o selecciona..."
          />
        )}
        {serviceLinePreview && (
          <div style={{ border: "1.3px dashed var(--line)", borderRadius: 8, padding: "9px 11px", marginBottom: 10, background: "var(--paper)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div>
                <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1 }}>CUENTA DEL MANTENIMIENTO</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{serviceLinePreview.description}</div>
              </div>
              <div className="sk-mono" style={{ fontSize: 12, textAlign: "right" }}>{money(serviceFinalPrice)}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 68px 54px 54px", gap: 6, alignItems: "center" }}>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                Base {money(serviceBasePrice)}{serviceDiscount ? ` · desc ${serviceDiscount}%` : ""}
              </div>
              <input
                style={{ ...inp, marginBottom: 0, padding: "6px 8px", textAlign: "right" as const }}
                type="number"
                min="0"
                max="100"
                value={serviceDiscountPercent}
                onChange={e => setServiceDiscountPercent(e.target.value)}
                placeholder="%"
              />
              <button type="button" className="action" style={{ fontSize: 10, padding: "4px 7px" }} onClick={() => setServiceDiscountPercent("20")}>20%</button>
              <button type="button" className="action" style={{ fontSize: 10, padding: "4px 7px" }} onClick={() => setServiceDiscountPercent("30")}>30%</button>
            </div>
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>Fecha de ingreso</label>
            <input style={inp} type="date" value={date} onChange={e => { setDate(e.target.value); if (scheduledDate === date) setScheduledDate(e.target.value); }} />
          </div>
          <div>
            <label style={lbl}>Técnico asignado *</label>
            <select style={{ ...inp, marginBottom: 0, borderColor: !technicianId ? "#c0392b" : undefined }} value={technicianId} onChange={e => setTechnicianId(e.target.value)}>
              <option value="">Sin asignar</option>
              {workshopTeam.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
            </select>
            {workshopTeam.length === 0 && <div className="sk-mono text-xs muted" style={{ marginTop: 4 }}>Configura responsables de taller en Perfil.</div>}
          </div>
        </div>
        <label style={lbl}>Fecha programada para el trabajo</label>
        <input style={inp} type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
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
        {(ticketSubtotalPreview > 0 || quotedParts.length > 0 || serviceLinePreview) && (
          <div style={{ border: "1.4px solid var(--accent)", background: "var(--accent-soft)", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
            <div className="sk-mono" style={{ fontSize: 10, color: "var(--accent)", letterSpacing: 1, marginBottom: 6 }}>TOTAL TICKET</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, fontSize: 12 }}>
              <span>Servicio / mantenimiento</span><strong>{money(serviceFinalPrice)}</strong>
              <span>Productos / repuestos</span><strong>{money(quotedPartsTotal)}</strong>
              <span style={{ borderTop: "1px dashed var(--line)", paddingTop: 6 }}>Subtotal</span><strong style={{ borderTop: "1px dashed var(--line)", paddingTop: 6 }}>{money(ticketSubtotalPreview)}</strong>
              {ticketAdvancePreview > 0 && (
                <>
                  <span>Abono</span><strong>- {money(ticketAdvancePreview)}</strong>
                </>
              )}
              <span style={{ fontSize: 14, fontWeight: 700 }}>Saldo</span><strong style={{ fontSize: 15, color: ticketBalancePreview > 0 ? "#c0392b" : "#2e7d32" }}>{money(ticketBalancePreview)}</strong>
            </div>
          </div>
        )}
        <label style={lbl}>Notas (opcional)</label>
        <textarea style={{ ...inp, resize: "vertical" as const, minHeight: 60 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Cambio de frenos, ajuste de cambios..." />
        <label style={lbl}>Recibido / autorizado por *</label>
        <input style={{ ...inp, borderColor: !intakeSignatureName.trim() ? "#c0392b" : undefined }} value={intakeSignatureName} onChange={e => setIntakeSignatureName(e.target.value)} placeholder="Nombre de quien entrega la bici" />
        {missingFields.length > 0 && (
          <div style={{ background: "rgba(192,57,43,.07)", border: "1.2px solid #c0392b", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "#c0392b", letterSpacing: 1, marginBottom: 4 }}>FALTAN CAMPOS OBLIGATORIOS</div>
            <div style={{ fontSize: 11, color: "#c0392b", lineHeight: 1.6 }}>{missingFields.join(" · ")}</div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button type="button" className="action" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button type="button" className="action ink" onClick={handleAdd} style={{ flex: 2 }} disabled={!canAdd}>Crear servicio</button>
        </div>
      </div>
    </div>
  );
}

// ─── Sección de servicios (admin) ─────────────────────────────────────────────
type DiagDraft = { estado: string; hallazgos: string; problemas: string; recomendaciones: string; partesRaw: string; labor: string };
const EMPTY_DIAG: DiagDraft = { estado: "", hallazgos: "", problemas: "", recomendaciones: "", partesRaw: "", labor: "" };
type BillingRow = { id?: string; type?: ServiceLineItem["type"]; sku?: string; loyverseItemId?: string; loyverseVariantId?: string; description: string; quantity: string; unitPrice: string; discountPercent: string };
const emptyBillingRow = (): BillingRow => ({ id: undefined, description: "", quantity: "1", unitPrice: "", discountPercent: "" });
type BillingDraft = { parts: BillingRow[]; labor: BillingRow[]; advance: string; paymentStatus: ServiceBilling["paymentStatus"]; notes: string };

// ─── Recibo imprimible ───────────────────────────────────────────────────────
function PrintReceiptModal({ service, onClose }: { service: BikeService; onClose: () => void }) {
  const billing = ticketSummary(service).billing;
  const allItems = [...(billing?.parts || []), ...(billing?.labor || [])].filter(i => i.description.trim());
  return (
    <>
      {/* Capa oscura (solo en pantalla, no en impresión) */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "#0008", zIndex: 9000 }} className="no-print" />
      {/* Contenido del recibo: visible siempre en modal, y al imprimir ocupa toda la hoja */}
      <div className="print-receipt" style={{
        position: "fixed", inset: 0, zIndex: 9001, background: "#fff",
        overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center",
        padding: "24px 20px",
      }}>
        <div style={{ width: "100%", maxWidth: 400, fontFamily: "monospace", fontSize: 13, color: "#111" }}>
          {/* Encabezado */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2 }}>CAPITAL WO-MAN BIKES</div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>capital.woman.bikes@gmail.com</div>
            <div style={{ borderTop: "1px dashed #999", marginTop: 10, paddingTop: 10, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>ORDEN DE SERVICIO / RECIBO</div>
          </div>

          {/* Datos del servicio */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12, fontSize: 12 }}>
            <tbody>
              <tr><td style={{ color: "#555", paddingRight: 8, paddingBottom: 3 }}>Cliente</td><td style={{ fontWeight: 700 }}>{service.clientName}</td></tr>
              {service.clientPhone && <tr><td style={{ color: "#555", paddingBottom: 3 }}>Teléfono</td><td>{service.clientPhone}</td></tr>}
              {service.clientDocument && <tr><td style={{ color: "#555", paddingBottom: 3 }}>Documento</td><td>{service.clientDocument}</td></tr>}
              <tr><td style={{ color: "#555", paddingBottom: 3 }}>Bicicleta</td><td style={{ fontWeight: 700 }}>{service.bikeDescription}</td></tr>
              {service.serviceType && <tr><td style={{ color: "#555", paddingBottom: 3 }}>Servicio</td><td>{service.serviceType}</td></tr>}
              <tr><td style={{ color: "#555", paddingBottom: 3 }}>Ingreso</td><td>{service.date}</td></tr>
              {billing?.closedAt && <tr><td style={{ color: "#555", paddingBottom: 3 }}>Cierre</td><td>{new Date(billing.closedAt).toLocaleDateString("es-CO")}</td></tr>}
              {service.intakeSignatureName && <tr><td style={{ color: "#555", paddingBottom: 3 }}>Autoriza</td><td>{service.intakeSignatureName}</td></tr>}
            </tbody>
          </table>

          {/* Motivo de ingreso */}
          {service.intakeReportedIssue && (
            <div style={{ fontSize: 11, color: "#444", background: "#f9f9f9", border: "1px dashed #ccc", borderRadius: 4, padding: "6px 8px", marginBottom: 10 }}>
              <span style={{ fontWeight: 700 }}>Motivo: </span>{service.intakeReportedIssue}
            </div>
          )}

          <div style={{ borderTop: "1px dashed #999", margin: "12px 0" }} />

          {/* Tabla de cobro */}
          {allItems.length > 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 36px 80px", gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#777", fontWeight: 700 }}>DESCRIPCIÓN</span>
                <span style={{ fontSize: 10, color: "#777", fontWeight: 700, textAlign: "center" }}>CANT</span>
                <span style={{ fontSize: 10, color: "#777", fontWeight: 700, textAlign: "right" }}>TOTAL</span>
              </div>
              {allItems.map((item, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 36px 80px", gap: 4, marginBottom: 3, fontSize: 12 }}>
                  <span>{item.description}{item.type === "mano_obra" ? " 🔧" : ""}</span>
                  <span style={{ textAlign: "center" }}>{item.quantity}</span>
                  <span style={{ textAlign: "right" }}>{money(item.quantity * item.unitPrice)}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #ddd", marginTop: 8, paddingTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span>Subtotal</span><span>{money(billing?.subtotal || 0)}</span>
                </div>
                {(billing?.advance || 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#2e7d32" }}>
                    <span>Abono pagado</span><span>- {money(billing!.advance)}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, borderTop: "1px dashed #999", paddingTop: 6, marginTop: 6 }}>
                  <span>SALDO A PAGAR</span><span>{money(billing?.balance || 0)}</span>
                </div>
                <div style={{ textAlign: "right", fontSize: 11, color: billing?.paymentStatus === "pagado" ? "#2e7d32" : "#c0392b", marginTop: 3 }}>
                  {billing?.paymentStatus === "pagado" ? "✅ PAGADO" : billing?.paymentStatus === "adelanto" ? "📤 CON ADELANTO" : "💰 PENDIENTE"}
                </div>
              </div>
            </>
          )}

          {/* Notas */}
          {billing?.notes && (
            <div style={{ marginTop: 10, fontSize: 11, color: "#444", borderTop: "1px dashed #ccc", paddingTop: 8 }}>
              <span style={{ fontWeight: 700 }}>Observaciones: </span>{billing.notes}
            </div>
          )}

          {/* Pie */}
          <div style={{ textAlign: "center", marginTop: 20, fontSize: 10, color: "#888", borderTop: "1px dashed #ccc", paddingTop: 10 }}>
            <div>Gracias por confiar en Capital Wo-Man Bikes 🚲</div>
            <div style={{ marginTop: 4 }}>capital.woman.bikes@gmail.com</div>
          </div>

          {/* Botones (se ocultan al imprimir gracias al CSS) */}
          <div className="no-print" style={{ marginTop: 20, display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="action ink" style={{ fontSize: 13 }} onClick={() => window.print()}>🖨 Imprimir</button>
            <button className="action" style={{ fontSize: 13 }} onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </>
  );
}

function AddBikeForm({ onAdd }: { onAdd: (desc: string, serial?: string) => void }) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState("");
  const [serial, setSerial] = useState("");
  if (!open) return (
    <button className="action" style={{ fontSize: 11 }} onClick={() => setOpen(true)}>+ Agregar bicicleta</button>
  );
  return (
    <div style={{ border: "1.2px dashed var(--line)", borderRadius: 8, padding: "10px 12px", marginTop: 8 }}>
      <input style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 12, boxSizing: "border-box", marginBottom: 6, fontFamily: "inherit" }}
        placeholder="Descripción de la bici (Trek Marlin azul 2022)" value={desc} onChange={e => setDesc(e.target.value)} autoFocus />
      <input style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 12, boxSizing: "border-box", marginBottom: 8, fontFamily: "inherit" }}
        placeholder="Número de serie (opcional)" value={serial} onChange={e => setSerial(e.target.value)} />
      <div style={{ display: "flex", gap: 6 }}>
        <button className="action" onClick={() => { setOpen(false); setDesc(""); setSerial(""); }}>Cancelar</button>
        <button className="action ink" onClick={() => { if (desc.trim()) { onAdd(desc, serial); setOpen(false); setDesc(""); setSerial(""); } }} disabled={!desc.trim()}>Agregar</button>
      </div>
    </div>
  );
}

function ClientesSection({ clients, services, onUpsertClient, team }: {
  clients: Client[]; services: BikeService[];
  onUpsertClient: (c: Client) => void;
  team: any[];
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const getClientServices = (c: Client) => services.filter(s =>
    s.clientId === c.id ||
    (c.document && s.clientDocument === c.document) ||
    s.clientEmail === c.email
  );

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.document || "").includes(q) ||
      c.email.toLowerCase().includes(q) || (c.phone || "").includes(q);
  });

  const selected = selectedId ? clients.find(c => c.id === selectedId) : null;
  const selectedServices = selected ? getClientServices(selected) : [];

  const addBikeToClient = (clientId: string, desc: string, serial?: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client || !desc.trim()) return;
    const newBike: ClientBike = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4), description: desc.trim(), serial: serial?.trim() || undefined };
    onUpsertClient({ ...client, bikes: [...client.bikes, newBike] });
  };

  return (
    <div className="fade-in" style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left panel — list */}
      <div style={{ width: 280, flexShrink: 0, borderRight: "1.4px solid var(--line)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1.2px solid var(--line)", flexShrink: 0 }}>
          <input
            style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box" }}
            placeholder="Buscar cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
          {filtered.length === 0 && (
            <div className="sk-mono text-xs muted" style={{ padding: "12px 4px" }}>
              {search ? "Sin resultados." : "Sin clientes aún."}
            </div>
          )}
          {filtered.map(c => {
            const svcs = getClientServices(c);
            return (
              <div key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{ padding: "10px 10px", borderRadius: 8, marginBottom: 4, cursor: "pointer", background: selectedId === c.id ? "rgba(108,31,110,.08)" : undefined, border: `1.2px solid ${selectedId === c.id ? "#6c1f6e" : "transparent"}` }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 1 }}>{c.document || c.email}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 10, background: "rgba(108,31,110,.08)", color: "#6c1f6e", borderRadius: 4, padding: "1px 6px" }}>🚲 {c.bikes.length}</span>
                  <span style={{ fontSize: 10, background: "rgba(76,175,80,.08)", color: "#2e7d32", borderRadius: 4, padding: "1px 6px" }}>📋 {svcs.length}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "10px 14px", borderTop: "1.2px solid var(--line)", flexShrink: 0 }}>
          <div className="sk-mono text-xs muted" style={{ marginBottom: 6 }}>{clients.length} clientes · {services.length} servicios totales</div>
        </div>
      </div>

      {/* Right panel — detail */}
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
        {!selected ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, color: "var(--ink-3)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
            <div className="sk-mono" style={{ fontSize: 12, letterSpacing: 1 }}>SELECCIONA UN CLIENTE</div>
          </div>
        ) : (
          <div style={{ maxWidth: 600 }}>
            {/* Client header */}
            <div style={{ background: "var(--paper)", border: "1.4px solid var(--line)", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{selected.name}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12, color: "var(--ink-3)" }}>
                {selected.document && <div>🪪 {selected.document}</div>}
                {selected.email && <div>✉ {selected.email}</div>}
                {selected.phone && <div>📱 {selected.phone}</div>}
                <div>📅 Cliente desde {selected.createdAt ? selected.createdAt.slice(0, 10) : "—"}</div>
              </div>
            </div>

            {/* Bikes */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>🚲 Bicicletas ({selected.bikes.length})</div>
              {selected.bikes.map(b => {
                const bikeSvcs = selectedServices.filter(s => s.bikeId === b.id || s.bikeDescription === b.description);
                return (
                  <div key={b.id} style={{ background: "var(--paper)", border: "1.2px solid var(--line)", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{b.description}</div>
                    {b.serial && <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>Serie: {b.serial}</div>}
                    <div className="sk-mono" style={{ fontSize: 10, color: "#6c1f6e", marginTop: 4 }}>{bikeSvcs.length} servicio{bikeSvcs.length !== 1 ? "s" : ""} registrado{bikeSvcs.length !== 1 ? "s" : ""}</div>
                    {bikeSvcs.map(s => (
                      <div key={s.id} style={{ fontSize: 11, color: "var(--ink-3)", padding: "3px 0", borderTop: "1px dashed var(--line)", marginTop: 4 }}>
                        {s.date} · {s.serviceType || "Servicio"} · {s.workshopStatus === "entregada" || s.deliveryStatus === "entregada" ? "✅ Entregada" : s.phase >= 4 ? "✅ Lista" : "🔧 En taller"}
                        {(s.workshopStatus === "entregada" || s.deliveryStatus === "entregada") && deliveryDateLabel(s) ? ` · ${deliveryDateLabel(s)}` : ""}
                      </div>
                    ))}
                  </div>
                );
              })}
              {/* Add bike form */}
              <AddBikeForm onAdd={(desc, serial) => addBikeToClient(selected.id, desc, serial)} />
            </div>

            {/* Full service history */}
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>📋 Historial completo ({selectedServices.length})</div>
              {selectedServices.length === 0 && <div className="sk-mono text-xs muted">Sin servicios registrados.</div>}
              {[...selectedServices].sort((a, b) => b.date.localeCompare(a.date)).map(s => {
                const tech = team.find(p => p.id === s.technicianId);
                return (
                  <div key={s.id} style={{ background: "var(--paper)", border: "1.2px solid var(--line)", borderRadius: 8, padding: "10px 14px", marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{s.bikeDescription}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{s.date}{s.serviceType ? ` · ${s.serviceType}` : ""}</div>
                      </div>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: s.deliveryStatus === "entregada" ? "rgba(76,175,80,.1)" : "rgba(108,31,110,.08)", color: s.deliveryStatus === "entregada" ? "#2e7d32" : "#6c1f6e" }}>
                        {s.deliveryStatus === "entregada" ? "Entregada" : s.phase >= 4 ? "Lista" : "En taller"}
                      </span>
                    </div>
                    {tech && <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>🔧 {tech.name}</div>}
                    {(s.workshopStatus === "entregada" || s.deliveryStatus === "entregada") && deliveryDateLabel(s) && (
                      <div className="sk-mono" style={{ fontSize: 10, color: "#2e7d32", marginTop: 2 }}>Entregada: {deliveryDateLabel(s)}</div>
                    )}
                    {s.intakeReportedIssue && <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>"{s.intakeReportedIssue}"</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceSection({ services, onAdvancePhase, onNewService, onUpdateService = () => {}, onDeleteService = () => {}, team = [], loyverseToken = "", session, adminPassword = "" }: { services: BikeService[]; onAdvancePhase: (id: string) => void; onNewService: () => void; onUpdateService?: (id: string, changes: Partial<BikeService>) => void; onDeleteService?: (id: string) => void; team?: any[]; loyverseToken?: string; session?: Session; adminPassword?: string }) {
  const [sending, setSending] = useState<string | null>(null);
  const [copied, setCopied]   = useState<string | null>(null);
  const [editingAmounts, setEditingAmounts] = useState<Record<string, string>>({});
  const [showDiag, setShowDiag] = useState<Record<string, boolean>>({});
  const [diagDraft, setDiagDraft] = useState<Record<string, DiagDraft>>({});
  const [showBilling, setShowBilling] = useState<Record<string, boolean>>({});
  const [billingDraft, setBillingDraft] = useState<Record<string, BillingDraft>>({});
  const [editingPauseNotes, setEditingPauseNotes] = useState<Record<string, string>>({});
  type LookupRow = { sku: string; description: string; quantity: string; unitPrice: string; discountPercent?: string; looking: boolean; found: null | boolean; loyverseItemId?: string; loyverseVariantId?: string };
  const emptyLookup = (): LookupRow => ({ sku: "", description: "", quantity: "1", unitPrice: "", discountPercent: "", looking: false, found: null });
  const emptyQA = emptyLookup;
  const [quickAdd, setQuickAdd] = useState<Record<string, LookupRow>>({});
  const [quotedAdd, setQuotedAdd] = useState<Record<string, LookupRow>>({});
  const [billingPartAdd, setBillingPartAdd] = useState<Record<string, LookupRow>>({});
  const [billingServiceAdd, setBillingServiceAdd] = useState<Record<string, LookupRow>>({});
  const [loyverseSending, setLoyverseSending] = useState<Record<string, boolean>>({});
  const [editingIntake, setEditingIntake] = useState<Record<string, any>>({});
  const [printService, setPrintService] = useState<BikeService | null>(null);
  const [diagEditState, setDiagEditState] = useState<Record<string, { diagId: string; draft: DiagDraft } | null>>({});
  const [quotedPartEdit, setQuotedPartEdit] = useState<Record<string, { id: string; description: string; quantity: string; unitPrice: string; discountPercent: string } | null>>({});
  const [usedPartEdit, setUsedPartEdit] = useState<Record<string, { id: string; description: string; quantity: string; unitPrice: string; discountPercent: string } | null>>({});
  const [deleteTarget, setDeleteTarget] = useState<BikeService | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deliveryTarget, setDeliveryTarget] = useState<BikeService | null>(null);
  const [deliveryChecklist, setDeliveryChecklist] = useState<ProcessChecklistItem[]>([]);
  const [deliverySignature, setDeliverySignature] = useState("");
  const [deliveryAccepted, setDeliveryAccepted] = useState(false);
  const [deliveryError, setDeliveryError] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({});

  // Permisos por rol
  const roleStr = (session?.role || "").toLowerCase();
  const isCajaRole = /caja/.test(roleStr);
  const canSeeBilling = true;
  const canEditDiag   = session?.type !== "employee" || !isCajaRole;
  const canDeleteService = session?.type === "admin";
  const canEditBillingForService = (s: BikeService) =>
    canSeeBilling;

  const toggleDiag = (id: string) => setShowDiag(p => ({ ...p, [id]: !p[id] }));
  const setDraft = (id: string, field: keyof DiagDraft, val: string) =>
    setDiagDraft(p => ({ ...p, [id]: { ...(p[id] || EMPTY_DIAG), [field]: val } }));
  const rowsFromItems = (items: ServiceLineItem[]): BillingRow[] =>
    items.length > 0
      ? items.map(i => ({ id: i.id, type: i.type, sku: i.sku, loyverseItemId: i.loyverseItemId, loyverseVariantId: i.loyverseVariantId, description: i.description, quantity: String(i.quantity), unitPrice: String(i.originalUnitPrice ?? i.unitPrice), discountPercent: i.discountPercent ? String(i.discountPercent) : "" }))
      : [emptyBillingRow()];
  const itemsFromRows = (rows: BillingRow[], type: ServiceLineItem["type"]): ServiceLineItem[] =>
    rows.filter(r => r.description.trim()).map((r, i) => {
      const originalUnitPrice = parseFloat(r.unitPrice.replace(/[^\d.]/g, "")) || 0;
      const discountPercent = clampDiscount(parseFloat(r.discountPercent));
      return {
        id: r.id || `${Date.now().toString(36)}${i}`,
        description: r.description,
        quantity: parseFloat(r.quantity) || 1,
        originalUnitPrice: discountPercent > 0 ? originalUnitPrice : undefined,
        discountPercent: discountPercent > 0 ? discountPercent : undefined,
        unitPrice: discountPercent > 0 ? discountedUnitPrice({ unitPrice: originalUnitPrice, originalUnitPrice, discountPercent }) : originalUnitPrice,
        type: r.type || type,
        sku: r.sku,
        loyverseItemId: r.loyverseItemId,
        loyverseVariantId: r.loyverseVariantId,
      };
    });
  const getBillingDraft = (s: BikeService): BillingDraft => {
    const current = billingWithServiceLine(s);
    return billingDraft[s.id] || {
      parts: rowsFromItems(current.parts),
      labor: rowsFromItems(current.labor),
      advance: String(current.advance || s.paymentAmount || ""),
      paymentStatus: current.paymentStatus || s.paymentStatus || "pendiente",
      notes: current.notes || "",
    };
  };
  const saveBilling = (s: BikeService, closeService = false) => {
    if (!canEditBillingForService(s)) {
      alert("No tienes permiso para editar la factura de este servicio.");
      return false;
    }
    if (closeService) {
      const checklistError = readyChecklistError(s);
      if (checklistError) {
        alert(checklistError);
        return false;
      }
    }
    const draft = getBillingDraft(s);
    const draftParts = itemsFromRows(draft.parts, "repuesto");
    const draftLabor = itemsFromRows(draft.labor, "mano_obra");
    const existingExcludedIds = new Set(s.excludedBillingItemIds || []);
    const quotedPartIdsInBilling = new Set(draftParts.filter(p => p.id.startsWith("quoted-")).map(p => p.id.replace(/^quoted-/, "")));
    const nextQuotedParts = (s.quotedParts || []).map(part => {
      const installed = quotedPartIdsInBilling.has(part.id);
      const quotedLineId = `quoted-${part.id}`;
      if (installed) existingExcludedIds.delete(quotedLineId);
      else if (part.installed) existingExcludedIds.add(quotedLineId);
      return {
        ...part,
        installed,
        installedAt: installed ? (part.installedAt || new Date().toISOString()) : undefined,
        installedBy: installed ? (part.installedBy || session?.name || (session?.type === "admin" ? "Admin" : "Usuario")) : undefined,
      };
    });
    const catalogServiceLine = serviceCatalogLine(s.serviceType);
    if (catalogServiceLine) {
      const serviceStillInBilling = draftLabor.some(item => item.id === catalogServiceLine.id);
      if (serviceStillInBilling) existingExcludedIds.delete(catalogServiceLine.id);
      else existingExcludedIds.add(catalogServiceLine.id);
    }
    const billing = calcBilling({
      parts: draftParts,
      labor: draftLabor,
      subtotal: 0,
      total: 0,
      balance: 0,
      advance: parseFloat(draft.advance || "0") || 0,
      paymentStatus: draft.paymentStatus,
      notes: draft.notes.trim(),
      closedAt: closeService ? new Date().toISOString() : s.finalBilling?.closedAt,
    });
    if (closeService && ![...billing.parts, ...billing.labor].some(i => i.description.trim() && i.quantity > 0)) {
      alert("Para terminar el servicio debes registrar repuestos usados o mano de obra/servicio cobrado.");
      return false;
    }
    onUpdateService(s.id, {
      quotedParts: nextQuotedParts.length ? nextQuotedParts : s.quotedParts,
      excludedBillingItemIds: Array.from(existingExcludedIds),
      finalBilling: billing,
      paymentStatus: billing.paymentStatus,
      paymentAmount: billing.advance || undefined,
      ...(closeService ? { phase: 4, completedAt: billing.closedAt, deliveryStatus: "lista", workshopStatus: "terminada" as const } : {}),
    });
    setBillingDraft(p => { const n = { ...p }; delete n[s.id]; return n; });
    setShowBilling(p => ({ ...p, [s.id]: closeService ? false : p[s.id] }));
    return true;
  };
  const saveDiag = (s: BikeService) => {
    const draft = diagDraft[s.id] || EMPTY_DIAG;
    if (!draft.estado && !draft.hallazgos && !draft.problemas && !draft.recomendaciones && !draft.partesRaw && !draft.labor) return;
    const entry: DiagnosticUpdate = {
      id: Date.now().toString(36),
      date: new Date().toISOString(),
      estado: draft.estado.trim(),
      hallazgos: draft.hallazgos.trim(),
      problemas: draft.problemas.trim(),
      recomendaciones: draft.recomendaciones.trim(),
      partes: splitLines(draft.partesRaw),
      labor: draft.labor.trim(),
    };
    onUpdateService(s.id, { diagnosticUpdates: [...(s.diagnosticUpdates || []), entry], workshopStatus: "diagnostico" });
    setDiagDraft(p => ({ ...p, [s.id]: EMPTY_DIAG }));
    setShowDiag(p => ({ ...p, [s.id]: false }));
  };
  const fmtPago = (s: BikeService) => {
    if (s.paymentStatus === "pagado") return "✅ Pagado";
    if (s.paymentStatus === "adelanto") return s.paymentAmount ? `📤 Abono: $${s.paymentAmount.toLocaleString()}` : "📤 Adelanto (sin monto)";
    return "💰 Pago pendiente";
  };

  // ── Loyverse SKU lookup genérico para cualquier estado ─────────────────────
  const doSKULookup = async (
    serviceId: string,
    sku: string,
    setter: React.Dispatch<React.SetStateAction<Record<string, LookupRow>>>
  ) => {
    if (!sku.trim()) return;
    if (!loyverseToken) { alert("Configura el token de Loyverse en la sección Integraciones del menú."); return; }
    setter(p => ({ ...p, [serviceId]: { ...(p[serviceId] || emptyLookup()), sku, looking: true, found: null } }));
    try {
      const result = await lookupLoyverseSKU(sku, loyverseToken);
      setter(p => result
        ? { ...p, [serviceId]: { ...(p[serviceId] || emptyLookup()), sku, description: result.name, unitPrice: String(result.price), loyverseItemId: result.itemId, loyverseVariantId: result.variantId, looking: false, found: true } }
        : { ...p, [serviceId]: { ...(p[serviceId] || emptyLookup()), sku, loyverseItemId: undefined, loyverseVariantId: undefined, looking: false, found: false } }
      );
    } catch (error: any) {
      setter(p => ({ ...p, [serviceId]: { ...(p[serviceId] || emptyLookup()), sku, looking: false, found: null, loyverseItemId: undefined, loyverseVariantId: undefined } }));
      alert(`No se pudo consultar Loyverse:\n${loyverseErrorMessage(error)}`);
    }
  };

  // ── Quick-add repuestos USADOS (factura final) ──────────────────────────────
  const handleSKULookup = (serviceId: string, sku: string) => doSKULookup(serviceId, sku, setQuickAdd);
  const handleBillingPartLookup = (serviceId: string, sku: string) => doSKULookup(serviceId, sku, setBillingPartAdd);
  const handleBillingServiceLookup = (serviceId: string, sku: string) => doSKULookup(serviceId, sku, setBillingServiceAdd);

  const addBillingPartFromLoyverse = async (s: BikeService) => {
    const row = billingPartAdd[s.id] || emptyQA();
    if (!loyverseToken) { alert("Configura el token de Loyverse en Integraciones para agregar repuestos desde Loyverse."); return; }
    if (!row.sku.trim()) { alert("Escribe el código/SKU del repuesto de Loyverse."); return; }
    let item = row;
    if (!item.loyverseItemId) {
      setBillingPartAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), ...row, looking: true, found: null } }));
      let result: LoyverseLookupResult | null = null;
      try {
        result = await lookupLoyverseSKU(row.sku, loyverseToken);
      } catch (error: any) {
        setBillingPartAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), ...row, looking: false, found: null, loyverseItemId: undefined, loyverseVariantId: undefined } }));
        alert(`No se pudo consultar Loyverse:\n${loyverseErrorMessage(error)}`);
        return;
      }
      if (!result) {
        setBillingPartAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), ...row, looking: false, found: false, loyverseItemId: undefined, loyverseVariantId: undefined } }));
        alert("Código no encontrado en Loyverse. Para facturar desde Loyverse, primero debe existir en el catálogo.");
        return;
      }
      item = { ...row, description: result.name, unitPrice: String(result.price), loyverseItemId: result.itemId, loyverseVariantId: result.variantId, looking: false, found: true };
    }
    const draft = getBillingDraft(s);
    const basePrice = parseFloat(item.unitPrice) || 0;
    const discountPercent = clampDiscount(parseFloat(item.discountPercent || ""));
    const nextRow: BillingRow = {
      id: `loyverse-${item.loyverseVariantId || item.loyverseItemId}-${Date.now().toString(36)}`,
      type: "repuesto",
      sku: item.sku.trim(),
      description: item.description.trim(),
      quantity: item.quantity || "1",
      unitPrice: String(basePrice),
      discountPercent: discountPercent ? String(discountPercent) : "",
      loyverseItemId: item.loyverseItemId,
      loyverseVariantId: item.loyverseVariantId,
    };
    setBillingDraft(p => ({ ...p, [s.id]: { ...draft, parts: [...draft.parts.filter(part => part.description.trim()), nextRow] } }));
    setBillingPartAdd(p => ({ ...p, [s.id]: emptyQA() }));
  };

  const addBillingServiceFromLoyverse = async (s: BikeService) => {
    const row = billingServiceAdd[s.id] || emptyQA();
    if (!loyverseToken) { alert("Configura el token de Loyverse en Integraciones para agregar servicios desde Loyverse."); return; }
    if (!row.sku.trim()) { alert("Escribe el código/SKU del servicio de Loyverse."); return; }
    let item = row;
    if (!item.loyverseItemId) {
      setBillingServiceAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), ...row, looking: true, found: null } }));
      let result: LoyverseLookupResult | null = null;
      try {
        result = await lookupLoyverseSKU(row.sku, loyverseToken);
      } catch (error: any) {
        setBillingServiceAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), ...row, looking: false, found: null, loyverseItemId: undefined, loyverseVariantId: undefined } }));
        alert(`No se pudo consultar Loyverse:\n${loyverseErrorMessage(error)}`);
        return;
      }
      if (!result) {
        setBillingServiceAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), ...row, looking: false, found: false, loyverseItemId: undefined, loyverseVariantId: undefined } }));
        alert("Servicio no encontrado en Loyverse. Para facturarlo desde Loyverse, primero debe existir en el catálogo.");
        return;
      }
      item = { ...row, description: result.name, unitPrice: String(result.price), loyverseItemId: result.itemId, loyverseVariantId: result.variantId, looking: false, found: true };
    }
    const draft = getBillingDraft(s);
    const discountPercent = clampDiscount(parseFloat(item.discountPercent || ""));
    const nextRow: BillingRow = {
      id: `loyverse-service-${item.loyverseVariantId || item.loyverseItemId}-${Date.now().toString(36)}`,
      type: "servicio",
      sku: item.sku.trim(),
      description: item.description.trim(),
      quantity: item.quantity || "1",
      unitPrice: String(parseFloat(item.unitPrice) || 0),
      discountPercent: discountPercent ? String(discountPercent) : "",
      loyverseItemId: item.loyverseItemId,
      loyverseVariantId: item.loyverseVariantId,
    };
    setBillingDraft(p => ({ ...p, [s.id]: { ...draft, labor: [...draft.labor.filter(line => line.description.trim()), nextRow] } }));
    setBillingServiceAdd(p => ({ ...p, [s.id]: emptyQA() }));
  };

  // Detecta si el servicio aplica descuento del 20% en repuestos (mantenimientos)
  const isMantService = (s: BikeService) =>
    /mant/i.test(s.serviceType || "");
  const isUsedPartsStage = (s: BikeService) =>
    s.phase >= 3 || ["ensamble", "detalle", "prueba", "terminada", "entregada"].includes(s.workshopStatus || "");
  const actualUsedParts = (s: BikeService) =>
    (s.finalBilling?.parts || []).filter(p => p.description.trim() && !p.id.startsWith("quoted-"));

  const addQuickPart = (s: BikeService) => {
    const qa = quickAdd[s.id] || emptyQA();
    if (!qa.description.trim()) return;
    if (!qa.loyverseItemId) {
      alert("Busca y selecciona el repuesto en Loyverse antes de agregarlo. El precio base debe venir de Loyverse.");
      return;
    }
    const basePrice = parseFloat(qa.unitPrice) || 0;
    const discountPercent = clampDiscount(parseFloat(qa.discountPercent || "")) || (isMantService(s) && basePrice > 0 ? 20 : 0);
    const unitPrice = discountPercent ? discountedUnitPrice({ unitPrice: basePrice, originalUnitPrice: basePrice, discountPercent }) : basePrice;
    const newPart: ServiceLineItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      description: qa.description.trim(),
      quantity: parseFloat(qa.quantity) || 1,
      unitPrice,
      originalUnitPrice: discountPercent ? basePrice : undefined,
      discountPercent: discountPercent || undefined,
      type: "repuesto",
      ...(qa.sku.trim() ? { sku: qa.sku.trim() } : {}),
      ...(qa.loyverseItemId ? { loyverseItemId: qa.loyverseItemId, loyverseVariantId: qa.loyverseVariantId } : {}),
    };
    const current = billingWithServiceLine(s);
    const cleanParts = current.parts.filter(p => p.description.trim());
    onUpdateService(s.id, { finalBilling: calcBilling({ ...current, parts: [...cleanParts, newPart] }) });
    setBillingDraft(p => { const n = { ...p }; delete n[s.id]; return n; });
    setQuickAdd(p => ({ ...p, [s.id]: emptyQA() }));
  };

  const removeQuickPart = (s: BikeService, partId: string) => {
    const current = billingWithServiceLine(s);
    onUpdateService(s.id, { finalBilling: calcBilling({ ...current, parts: current.parts.filter(p => p.id !== partId) }) });
    setBillingDraft(p => { const n = { ...p }; delete n[s.id]; return n; });
  };

  const saveQuotedPartEdit = (s: BikeService) => {
    const edit = quotedPartEdit[s.id];
    if (!edit) return;
    const originalUnitPrice = parseFloat(edit.unitPrice) || 0;
    const discountPercent = clampDiscount(parseFloat(edit.discountPercent || "0"));
    const updatedPart: QuotedPart = {
      ...(s.quotedParts || []).find(p => p.id === edit.id)!,
      description: edit.description.trim(),
      quantity: parseFloat(edit.quantity) || 1,
      originalUnitPrice: discountPercent ? originalUnitPrice : undefined,
      discountPercent: discountPercent || undefined,
      unitPrice: discountPercent ? discountedUnitPrice({ unitPrice: originalUnitPrice, originalUnitPrice, discountPercent }) : originalUnitPrice,
    };
    const changes: Partial<BikeService> = {
      quotedParts: (s.quotedParts || []).map(p => p.id === edit.id ? updatedPart : p),
    };
    if (s.finalBilling?.parts?.some(p => p.id === `quoted-${edit.id}`)) {
      const updatedLine = quotedPartToLineItem(updatedPart);
      changes.finalBilling = calcBilling({
        ...s.finalBilling,
        parts: s.finalBilling.parts.map(p => p.id === updatedLine.id ? { ...p, ...updatedLine } : p),
      });
    }
    onUpdateService(s.id, changes);
    setQuotedPartEdit(p => ({ ...p, [s.id]: null }));
  };

  const saveUsedPartEdit = (s: BikeService) => {
    const edit = usedPartEdit[s.id];
    if (!edit) return;
    const current = billingWithServiceLine(s);
    const originalUnitPrice = parseFloat(edit.unitPrice) || 0;
    const discountPercent = clampDiscount(parseFloat(edit.discountPercent));
    onUpdateService(s.id, { finalBilling: calcBilling({ ...current, parts: current.parts.map(p => p.id === edit.id ? { ...p, description: edit.description.trim(), quantity: parseFloat(edit.quantity) || 1, originalUnitPrice: discountPercent ? originalUnitPrice : undefined, discountPercent: discountPercent || undefined, unitPrice: discountPercent ? discountedUnitPrice({ unitPrice: originalUnitPrice, originalUnitPrice, discountPercent }) : originalUnitPrice } : p) }) });
    setBillingDraft(prev => { const n = { ...prev }; delete n[s.id]; return n; });
    setUsedPartEdit(prev => ({ ...prev, [s.id]: null }));
  };

  const saveEditDiag = (s: BikeService) => {
    const editState = diagEditState[s.id];
    if (!editState) return;
    const { diagId, draft } = editState;
    const updated = (s.diagnosticUpdates || []).map(d => d.id === diagId ? { ...d, estado: draft.estado.trim(), hallazgos: draft.hallazgos.trim(), problemas: draft.problemas.trim(), recomendaciones: draft.recomendaciones.trim(), partes: splitLines(draft.partesRaw), labor: draft.labor.trim() } : d);
    onUpdateService(s.id, { diagnosticUpdates: updated });
    setDiagEditState(p => ({ ...p, [s.id]: null }));
  };

  const deleteDiagEntry = (s: BikeService, diagId: string) => {
    if (!window.confirm("¿Eliminar este registro de diagnóstico?")) return;
    onUpdateService(s.id, { diagnosticUpdates: (s.diagnosticUpdates || []).filter(d => d.id !== diagId) });
  };

  // ── Repuestos a cambiar (inspección / cotización) ───────────────────────────
  const handleQuotedSKULookup = (serviceId: string, sku: string) => doSKULookup(serviceId, sku, setQuotedAdd);

  const addQuotedPart = (s: BikeService) => {
    const qa = quotedAdd[s.id] || emptyLookup();
    if (!qa.description.trim()) return;
    if (!qa.loyverseItemId) {
      alert("Busca y selecciona el repuesto en Loyverse antes de agregarlo. El precio base debe venir de Loyverse.");
      return;
    }
    const basePrice = parseFloat(qa.unitPrice) || 0;
    const discountPercent = clampDiscount(parseFloat(qa.discountPercent || ""));
    const unitPrice = discountPercent ? discountedUnitPrice({ unitPrice: basePrice, originalUnitPrice: basePrice, discountPercent }) : basePrice;
    const newPart: QuotedPart = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 4),
      description: qa.description.trim(),
      quantity: parseFloat(qa.quantity) || 1,
      unitPrice,
      originalUnitPrice: discountPercent ? basePrice : undefined,
      discountPercent: discountPercent || undefined,
      ...(qa.sku.trim() ? { sku: qa.sku.trim() } : {}),
      ...(qa.loyverseItemId ? { loyverseItemId: qa.loyverseItemId, loyverseVariantId: qa.loyverseVariantId } : {}),
    };
    onUpdateService(s.id, { quotedParts: [...(s.quotedParts || []), newPart] });
    setQuotedAdd(p => ({ ...p, [s.id]: emptyLookup() }));
  };

  const removeQuotedPart = (s: BikeService, partId: string) => {
    const changes: Partial<BikeService> = { quotedParts: (s.quotedParts || []).filter(p => p.id !== partId) };
    if (s.finalBilling?.parts?.some(p => p.id === `quoted-${partId}`)) {
      changes.finalBilling = calcBilling({ ...s.finalBilling, parts: s.finalBilling.parts.filter(p => p.id !== `quoted-${partId}`) });
    }
    onUpdateService(s.id, changes);
  };
  const toggleQuotedPartInstalled = (s: BikeService, part: QuotedPart) => {
    const nextInstalled = !part.installed;
    const updatedPart: QuotedPart = {
      ...part,
      installed: nextInstalled,
      installedAt: nextInstalled ? new Date().toISOString() : undefined,
      installedBy: nextInstalled ? (session?.name || (session?.type === "admin" ? "Admin" : "Usuario")) : undefined,
    };
    const quotedParts = (s.quotedParts || []).map(p => p.id === part.id ? updatedPart : p);
    const current = billingWithServiceLine(s);
    const lineId = `quoted-${part.id}`;
    const updatedLine = quotedPartToLineItem(updatedPart);
    const parts = nextInstalled
      ? current.parts.some(p => p.id === lineId)
        ? current.parts.map(p => p.id === lineId ? { ...p, ...updatedLine } : p)
        : [...current.parts, updatedLine]
      : current.parts.filter(p => p.id !== lineId);
    onUpdateService(s.id, { quotedParts, finalBilling: calcBilling({ ...current, parts }) });
    setBillingDraft(p => { const n = { ...p }; delete n[s.id]; return n; });
  };

  const handleSendToLoyverse = async (s: BikeService) => {
    if (!loyverseToken) { alert("Configura el token de Loyverse en la sección Perfil."); return; }
    const billing = billingWithServiceLine(s);
    const hasLoyverseItems = [...billing.parts, ...billing.labor].some(i => i.loyverseVariantId);
    if (!hasLoyverseItems) { alert("Agrega al menos un repuesto o servicio buscado en Loyverse para sincronizar."); return; }
    setLoyverseSending(p => ({ ...p, [s.id]: true }));
    const result = await sendBillingToLoyverse(billing, s, loyverseToken);
    setLoyverseSending(p => ({ ...p, [s.id]: false }));
    if (result.success) {
      onUpdateService(s.id, { finalBilling: { ...billing, loyverseReceiptId: result.receiptId, loyverseSyncedAt: new Date().toISOString() } });
      alert(`✅ Enviado a Loyverse.\nRecibo: ${result.receiptNumber || result.receiptId}`);
    } else {
      alert(`❌ Error al enviar a Loyverse:\n${result.error}\n\nLos datos siguen guardados localmente.`);
    }
  };

  const fillDraftCustomerFromLoyverse = async (serviceId: string, doc: string) => {
    if (!loyverseToken) { alert("Configura el token de Loyverse en Integraciones."); return; }
    let result: Awaited<ReturnType<typeof lookupLoyverseCustomerByDocument>> = null;
    try {
      result = await lookupLoyverseCustomerByDocument(doc, loyverseToken);
    } catch (error: any) {
      alert(`No se pudo consultar clientes en Loyverse:\n${loyverseErrorMessage(error)}`);
      return;
    }
    if (!result) {
      alert("Cliente no encontrado en Loyverse. Puedes dejar los datos manuales.");
      return;
    }
    setEditingIntake(p => ({
      ...p,
      [serviceId]: {
        ...p[serviceId],
        clientName: result.name || p[serviceId]?.clientName || "",
        clientEmail: result.email || p[serviceId]?.clientEmail || "",
        clientPhone: result.phone || p[serviceId]?.clientPhone || "",
        clientDocument: result.document || doc,
        loyverseCustomerId: result.id,
      },
    }));
  };

  const notifyClient = async (s: BikeService) => {
    const ph = PHASES.find(p => p.id === s.phase);
    if (!ph) { alert("Avanza primero a una fase."); return; }
    setSending(s.id);
    try {
      await sendEmail(EMAILJS_SERVICE_ID, EMAILJS_SERVICE_TEMPLATE_ID, {
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
  const requestDeleteService = (s: BikeService) => {
    setDeleteTarget(s);
    setDeletePassword("");
    setDeleteError("");
  };
  const confirmDeleteService = () => {
    if (!deleteTarget) return;
    const validPasswords = new Set([adminPassword, getAdminPassword(), "capital2024"].filter(Boolean));
    if (!validPasswords.has(deletePassword.trim())) {
      setDeleteError("Clave admin incorrecta. No se eliminó el servicio.");
      return;
    }
    onDeleteService(deleteTarget.id);
    setDeleteTarget(null);
    setDeletePassword("");
    setDeleteError("");
  };
  const requestDeliverySignature = (s: BikeService) => {
    setDeliveryTarget(s);
    setDeliveryChecklist(buildProcessChecklist(s.processChecklist));
    setDeliverySignature(s.deliverySignatureName || s.clientName || "");
    setDeliveryAccepted(false);
    setDeliveryError("");
  };
  const confirmDelivery = () => {
    if (!deliveryTarget) return;
    const signature = deliverySignature.trim();
    const checklist = deliveryChecklist.length ? deliveryChecklist : buildProcessChecklist(deliveryTarget.processChecklist);
    const missingItems = checklist.filter(item => item.key !== "entrega" && !item.done);
    if (signature.length < 3) {
      setDeliveryError("Pide la firma o nombre completo de quien recibe la bici.");
      return;
    }
    if (missingItems.length > 0) {
      setDeliveryError(`Faltan ${missingItems.length} ítem(s) del checklist: ${missingItems.map(item => item.label).join(", ")}.`);
      return;
    }
    if (!deliveryAccepted) {
      setDeliveryError("Debes confirmar que el cliente acepta la entrega conforme.");
      return;
    }
    const now = new Date().toISOString();
    const nextChecklist = normalizeProcessChecklist(checklist.map(item => item.key === "entrega" ? {
      ...item,
      done: true,
      completedAt: item.completedAt || now,
      completedById: session?.id || session?.type || "admin",
      completedByName: signature,
      updatedAt: now,
      note: item.note || "Entrega firmada por cliente",
    } : item));
    onUpdateService(deliveryTarget.id, {
      deliveryStatus: "entregada",
      workshopStatus: "entregada",
      deliverySignatureName: signature,
      deliverySignedAt: now,
      deliveryAcceptanceText: DELIVERY_ACCEPTANCE_TEXT,
      deliveredAt: now,
      processChecklist: nextChecklist,
      processChecklistUpdatedAt: now,
    });
    setDeliveryTarget(null);
    setDeliverySignature("");
    setDeliveryAccepted(false);
    setDeliveryError("");
  };
  const validateWorkshopPhaseChange = (s: BikeService, nextStatus: BikeService["workshopStatus"]) => {
    if (nextStatus !== "desarme") return true;
    const checklist = buildProcessChecklist(s.processChecklist);
    const missingReview = checklist.filter(item => REVIEW_CHECKLIST_KEYS.includes(item.key) && !item.done);
    if (missingReview.length > 0) {
      alert(`Antes de pasar a Desarme completa el checklist de Ingreso y revisión:\n\n${missingReview.map(item => `• ${item.label}`).join("\n")}`);
      return false;
    }
    if (!(s.quotedParts || []).some(part => part.description.trim())) {
      alert("Antes de pasar a Desarme registra la cotización inicial en Repuestos a cambiar.");
      return false;
    }
    return true;
  };
  const updateWorkshopStatus = (s: BikeService, nextStatus: BikeService["workshopStatus"]) => {
    if (!validateWorkshopPhaseChange(s, nextStatus)) return;
    onUpdateService(s.id, { workshopStatus: nextStatus });
  };

  const phColor = (p: number) => PHASES.find(ph => ph.id === p)?.color || "#888";
  const phName  = (p: number) => p === 0 ? "Recibida" : PHASES.find(ph => ph.id === p)?.name || "";
  const phIcon  = (p: number) => p === 0 ? "📋" : PHASES.find(ph => ph.id === p)?.icon || "";
  const active  = useMemo(() => services.filter(s => s.phase < 4), [services]);
  const done    = useMemo(() => services.filter(s => s.phase === 4), [services]);
  const serviceMatchesSearch = (s: BikeService) => {
    const q = normalizeLookup(serviceSearch);
    if (!q) return true;
    return normalizeLookup([
      s.clientName, s.clientDocument, s.clientPhone, s.clientEmail, s.bikeDescription,
      s.serviceType, s.intakeReportedIssue, s.notes, serviceStatusLabel(s), s.date, s.scheduledDate,
      (s.quotedParts || []).map(p => `${p.sku || ""} ${p.description}`).join(" "),
    ].filter(Boolean).join(" ")).includes(q);
  };
  const filteredActive = useMemo(() => active.filter(serviceMatchesSearch), [active, serviceSearch]);
  const filteredDone = useMemo(() => done.filter(serviceMatchesSearch), [done, serviceSearch]);
  const toggleServiceOpen = (id: string) => setExpandedServices(p => ({ ...p, [id]: !p[id] }));

  return (
    <div className="service-section" style={{ padding: "16px 16px", maxWidth: 700, margin: "0 auto", width: "100%", boxSizing: "border-box" as const }}>
      {printService && <PrintReceiptModal service={printService} onClose={() => setPrintService(null)} />}
      {deleteTarget && (
        <div
          className="no-print"
          onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(18, 12, 22, .46)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" as const }}
        >
          <div className="sk-box" style={{ width: "100%", maxWidth: 420, padding: 18, background: "var(--paper)", boxSizing: "border-box" as const }}>
            <div className="sk-title" style={{ fontSize: 18, marginBottom: 8 }}>Eliminar servicio</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.45 }}>
              Vas a eliminar el servicio de <b>{deleteTarget.clientName}</b>. Esta acción no se puede deshacer.
            </div>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") confirmDeleteService(); }}
              placeholder="Clave de admin"
              autoFocus
              style={{ width: "100%", boxSizing: "border-box" as const, padding: "10px 12px", borderRadius: 9, border: "1.4px solid var(--line)", background: "var(--paper-2)", color: "var(--ink)", fontFamily: "inherit", fontSize: 14 }}
            />
            {deleteError && <div style={{ marginTop: 8, color: "#c0392b", fontSize: 12, fontWeight: 700 }}>{deleteError}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, flexWrap: "wrap" as const }}>
              <button type="button" className="action" onClick={() => setDeleteTarget(null)}>Cancelar</button>
              <button type="button" className="action ink" onClick={confirmDeleteService} style={{ background: "#c0392b", borderColor: "#c0392b", color: "#fff" }}>Eliminar definitivamente</button>
            </div>
          </div>
        </div>
      )}
      {deliveryTarget && (
        <div
          className="no-print"
          onClick={(e) => { if (e.target === e.currentTarget) setDeliveryTarget(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(18, 12, 22, .46)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, boxSizing: "border-box" as const }}
        >
          <div className="sk-box" style={{ width: "100%", maxWidth: 500, padding: 18, background: "var(--paper)", boxSizing: "border-box" as const, maxHeight: "90vh", overflowY: "auto" as const, display: "flex", flexDirection: "column" as const }}>
            <div className="sk-title" style={{ fontSize: 18, marginBottom: 8 }}>Confirmar entrega</div>
            <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 12, lineHeight: 1.45 }}>
              Revisa el checklist y registra la firma de quien recibe la bici de <b>{deliveryTarget.clientName}</b>. Todos los ítems deben estar marcados.
            </div>
            {(() => {
              const pending = deliveryChecklist.filter(item => item.key !== "entrega" && !item.done).length;
              return pending > 0
                ? <div className="sk-mono" style={{ fontSize: 10, color: "#c0392b", marginBottom: 8 }}>{pending} ítem(s) pendiente(s) — marca todo antes de confirmar</div>
                : <div className="sk-mono" style={{ fontSize: 10, color: "#2e7d32", marginBottom: 8 }}>Checklist completo — listo para entregar</div>;
            })()}
            <ServiceProcessChecklist
              service={{ ...deliveryTarget, processChecklist: deliveryChecklist }}
              editable={true}
              initialOpen={true}
              onChange={(items) => { setDeliveryChecklist(items); setDeliveryError(""); }}
            />
            <input
              value={deliverySignature}
              onChange={(e) => { setDeliverySignature(e.target.value); setDeliveryError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") confirmDelivery(); }}
              placeholder="Firma / nombre de quien recibe"
              style={{ width: "100%", boxSizing: "border-box" as const, padding: "10px 12px", borderRadius: 9, border: "1.4px solid var(--line)", background: "var(--paper-2)", color: "var(--ink)", fontFamily: "inherit", fontSize: 14, marginTop: 14 }}
            />
            <label style={{ display: "grid", gridTemplateColumns: "18px 1fr", gap: 8, alignItems: "start", marginTop: 12, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.45 }}>
              <input
                type="checkbox"
                checked={deliveryAccepted}
                onChange={(e) => { setDeliveryAccepted(e.target.checked); setDeliveryError(""); }}
                style={{ width: 15, height: 15, marginTop: 2 }}
              />
              <span>{DELIVERY_ACCEPTANCE_TEXT}</span>
            </label>
            {deliveryError && <div style={{ marginTop: 8, color: "#c0392b", fontSize: 12, fontWeight: 700 }}>{deliveryError}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, flexWrap: "wrap" as const }}>
              <button type="button" className="action" onClick={() => setDeliveryTarget(null)}>Cancelar</button>
              <button type="button" className="action ink" onClick={confirmDelivery} style={{ background: "#2e7d32", borderColor: "#2e7d32", color: "#fff" }}>Firmar y entregar</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Servicios de bicicletas</div>
          <div className="sk-mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{active.length} activos · {done.length} completados</div>
        </div>
        <button className="action ink" onClick={onNewService}>+ Nuevo servicio</button>
      </div>

      <input
        value={serviceSearch}
        onChange={e => setServiceSearch(e.target.value)}
        placeholder="Buscar por cliente, cédula, teléfono, bici, servicio, repuesto, estado..."
        style={{ width: "100%", boxSizing: "border-box" as const, padding: "10px 12px", borderRadius: 10, border: "1.4px solid var(--line)", background: "var(--paper-2)", color: "var(--ink)", fontFamily: "inherit", fontSize: 13, marginBottom: 12 }}
      />

      {services.length === 0 && (
        <div className="placeholder" style={{ borderRadius: 12, padding: 48, textAlign: "center" }}>
          No hay servicios aún.<br />Crea el primero con el botón de arriba.
        </div>
      )}

      {filteredActive.map(s => {
        const serviceOpen = !!expandedServices[s.id];
        return (
        <div key={s.id} style={{ background: "var(--paper)", border: "1.4px solid var(--line)", borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{s.clientName}</div>
              <div style={{ color: "var(--ink-3)", fontSize: 13 }}>{s.bikeDescription}</div>
              <div className="sk-mono" style={{ fontSize: 10, color: "#6c1f6e", marginTop: 2 }}>ESTADO TALLER · {serviceStatusLabel(s)}</div>
              {(s.clientPhone || s.clientDocument) && <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 1 }}>{s.clientPhone || ""}{s.clientPhone && s.clientDocument ? " · " : ""}{s.clientDocument || ""}</div>}
              {s.serviceType && <div style={{ fontSize: 12, color: "#6c1f6e", marginTop: 2 }}>🛠 {s.serviceType}</div>}
              {(() => {
                const ingreso = new Date(s.date + "T00:00:00");
                const hoy = new Date(); hoy.setHours(0,0,0,0);
                const diasTaller = Math.floor((hoy.getTime() - ingreso.getTime()) / 86400000);
                const programada = s.scheduledDate || s.date;
                return (
                  <div style={{ marginTop: 3, display: "flex", flexDirection: "column", gap: 1 }}>
                    <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                      📥 Ingresó: {s.date}
                      <span style={{ marginLeft: 6, color: diasTaller > 3 ? "#c0392b" : diasTaller > 1 ? "#e8a020" : "var(--ink-3)", fontWeight: diasTaller > 1 ? 600 : 400 }}>
                        · {diasTaller === 0 ? "hoy" : diasTaller === 1 ? "1 día en taller" : `${diasTaller} días en taller`}
                      </span>
                    </div>
                    {programada !== s.date && (
                      <div className="sk-mono" style={{ fontSize: 10, color: "#6c1f6e" }}>📆 Programado: {programada}{s.startTime ? ` · ${s.startTime}${s.endTime ? `–${s.endTime}` : ""}` : ""}</div>
                    )}
                    {programada === s.date && s.startTime && (
                      <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>🕐 {s.startTime}{s.endTime ? `–${s.endTime}` : ""}</div>
                    )}
                  </div>
                );
              })()}
              {s.technicianId && team.find(p => p.id === s.technicianId) && <div className="sk-mono" style={{ fontSize: 10, color: "#6c1f6e", marginTop: 1 }}>🔧 {team.find(p => p.id === s.technicianId)?.name}</div>}
              {(() => { const u = urgencyInfo(s.neededByDate); return u ? <div style={{ display: "inline-block", marginTop: 4, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: u.bg, color: u.color, fontWeight: 600, border: `1px solid ${u.color}` }}>{u.label}</div> : null; })()}
            </div>
            {canDeleteService && (
              <button type="button" onClick={() => requestDeleteService(s)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 18, padding: "2px 4px", lineHeight: 1, flexShrink: 0 }} title="Eliminar">🗑</button>
            )}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--paper-2)", border: `1.5px solid ${phColor(s.phase)}`, borderRadius: 999, padding: "4px 12px", fontSize: 13, whiteSpace: "nowrap" as const }}>
              {phIcon(s.phase)} <span style={{ color: phColor(s.phase), fontWeight: 600 }}>{phName(s.phase)}</span>
            </span>
            <button type="button" className="action" onClick={() => toggleServiceOpen(s.id)} style={{ fontSize: 12, padding: "3px 10px" }}>
              {serviceOpen ? "Ocultar" : "Ver detalle"}
            </button>
          </div>
          {serviceOpen && (
          <>
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {PHASES.map(ph => <div key={ph.id} style={{ flex: 1, height: 5, borderRadius: 3, background: s.phase >= ph.id ? ph.color : "var(--line)", transition: "background .3s" }} />)}
          </div>

          {/* Fases internas según formato físico de taller */}
          <div style={{ marginBottom: 10 }}>
            <div className="sk-mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: 1, marginBottom: 4 }}>FASE TALLER</div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
              {WORKSHOP_PHASES.map(wph => {
                const active = s.workshopStatus === wph.key;
                const blockedDesarme = wph.key === "desarme" && (
                  buildProcessChecklist(s.processChecklist).some(item => REVIEW_CHECKLIST_KEYS.includes(item.key) && !item.done) ||
                  !(s.quotedParts || []).some(part => part.description.trim())
                );
                return (
                  <button key={wph.key} onClick={() => updateWorkshopStatus(s, wph.key)} title={blockedDesarme ? "Completa revisión y cotización inicial antes de desarme" : wph.label}
                    style={{ fontSize: 10, padding: "2px 9px", borderRadius: 999, border: `1.2px solid ${active ? wph.color : "var(--line)"}`, background: active ? `${wph.color}18` : "transparent", color: blockedDesarme ? "var(--ink-3)" : active ? wph.color : "var(--ink-3)", opacity: blockedDesarme ? .55 : 1, cursor: "pointer", fontFamily: "inherit", fontWeight: active ? 700 : 400 }}>
                    {wph.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botón Autorizar trabajo — aparece cuando el diagnóstico está listo */}
          <ServiceProcessChecklist
            service={s}
            editable
            session={session}
            onChange={(items) => onUpdateService(s.id, { processChecklist: items, processChecklistUpdatedAt: new Date().toISOString() })}
          />

          {/* Botón Autorizar trabajo — aparece cuando el diagnóstico está listo */}
          {s.workshopStatus === "diagnostico" && (s.diagnosticUpdates || []).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <button
                className="action"
                style={{ fontSize: 12, borderColor: "#4caf50", color: "#2e7d32", background: "rgba(76,175,80,.08)", width: "100%", fontWeight: 700 }}
                onClick={() => { if (window.confirm(`¿Marcar el trabajo de ${s.clientName} como AUTORIZADO por el cliente?`)) onUpdateService(s.id, { workshopStatus: "autorizada" }); }}
              >
                ✅ Autorizar trabajo (cliente aprobó el diagnóstico)
              </button>
            </div>
          )}

          {/* Quedó pendiente (pausa de trabajo) */}
          <div style={{ marginBottom: 10 }}>
            {editingPauseNotes[s.id] !== undefined ? (
              <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
                <textarea
                  rows={2}
                  style={{ flex: 1, padding: "5px 8px", borderRadius: 7, border: "1.2px solid #e8a020", background: "var(--paper)", color: "var(--ink)", fontSize: 11, fontFamily: "inherit", resize: "vertical" as const, boxSizing: "border-box" as const }}
                  value={editingPauseNotes[s.id]}
                  onChange={e => setEditingPauseNotes(p => ({ ...p, [s.id]: e.target.value }))}
                  placeholder="Quedó pendiente: describir qué faltó al pausar el trabajo..."
                  autoFocus
                />
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                  <button className="action ink" style={{ fontSize: 10 }} onClick={() => { onUpdateService(s.id, { pauseNotes: editingPauseNotes[s.id].trim() || undefined }); setEditingPauseNotes(p => { const n = { ...p }; delete n[s.id]; return n; }); }}>OK</button>
                  <button className="action" style={{ fontSize: 10 }} onClick={() => setEditingPauseNotes(p => { const n = { ...p }; delete n[s.id]; return n; })}>✕</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" as const }}>
                {s.pauseNotes
                  ? <div style={{ fontSize: 11, background: "rgba(232,160,32,.10)", border: "1px solid #e8a020", borderRadius: 7, padding: "4px 8px", flex: 1, color: "var(--ink-2)" }}>⏸ <strong>Quedó pendiente:</strong> {s.pauseNotes}</div>
                  : null}
                <button className="action" style={{ fontSize: 10 }} onClick={() => setEditingPauseNotes(p => ({ ...p, [s.id]: s.pauseNotes || "" }))}>
                  {s.pauseNotes ? "✎ Editar pausa" : "⏸ Registrar pausa"}
                </button>
                {s.pauseNotes && <button className="action" style={{ fontSize: 10, color: "#c0392b" }} onClick={() => onUpdateService(s.id, { pauseNotes: undefined })}>× Limpiar</button>}
              </div>
            )}
          </div>

          <div className="service-actions">
            {s.phase < 4 && (
              <button className="action accent" style={{ fontSize: 12 }} onClick={() => {
                if (s.phase === 3 && !hasFinalBilling(s)) {
                  setShowBilling(p => ({ ...p, [s.id]: true }));
                  alert("Antes de marcar como lista debes registrar los repuestos/servicios finales para facturar.");
                  return;
                }
                onAdvancePhase(s.id);
              }}>
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
          {/* ── Repuestos del servicio ──────────────────────────────────────── */}
          {(() => {
            const qa = quotedAdd[s.id] || emptyLookup();
            const parts = s.quotedParts || [];
            const total = parts.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
            const fi2: React.CSSProperties = { padding: "5px 8px", borderRadius: 6, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" as const };
            return (
              <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1, marginBottom: 8 }}>🔩 REPUESTOS DEL SERVICIO</div>

                {/* Lista de partes cotizadas */}
                {parts.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    {parts.map(p => {
                      const editingQP = quotedPartEdit[s.id]?.id === p.id;
                      const qpDraft = quotedPartEdit[s.id];
                      const baseUnit = p.originalUnitPrice ?? p.unitPrice;
                      const discount = clampDiscount(p.discountPercent);
                      const finalUnit = discount ? discountedUnitPrice({ unitPrice: baseUnit, originalUnitPrice: baseUnit, discountPercent: discount }) : p.unitPrice;
                      const editBase = qpDraft ? parseFloat(qpDraft.unitPrice) || 0 : 0;
                      const editDiscount = qpDraft ? clampDiscount(parseFloat(qpDraft.discountPercent || "")) : 0;
                      const editFinal = editDiscount ? discountedUnitPrice({ unitPrice: editBase, originalUnitPrice: editBase, discountPercent: editDiscount }) : editBase;
                      return editingQP && qpDraft ? (
                        <div key={p.id} style={{ display: "flex", gap: 4, padding: "4px 0", borderBottom: "1px dashed var(--line)", alignItems: "center", flexWrap: "wrap" as const }}>
                          <input style={{ flex: 1, minWidth: 100, padding: "4px 7px", borderRadius: 6, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" as const }} value={qpDraft.description} onChange={e => setQuotedPartEdit(prev => ({ ...prev, [s.id]: { ...prev[s.id]!, description: e.target.value } }))} placeholder="Descripción" />
                          <input style={{ width: 44, padding: "4px 4px", borderRadius: 6, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 12, fontFamily: "inherit", textAlign: "center" as const, boxSizing: "border-box" as const }} type="number" min="1" value={qpDraft.quantity} onChange={e => setQuotedPartEdit(prev => ({ ...prev, [s.id]: { ...prev[s.id]!, quantity: e.target.value } }))} />
                          <input style={{ width: 84, padding: "4px 7px", borderRadius: 6, border: "1.2px solid var(--line)", background: "var(--paper-2)", color: "var(--ink-3)", fontSize: 12, fontFamily: "inherit", textAlign: "right" as const, boxSizing: "border-box" as const }} type="number" min="0" value={qpDraft.unitPrice} readOnly title="Precio tomado de Loyverse. Ajusta solo con descuento." placeholder="$ base" />
                          <input style={{ width: 52, padding: "4px 5px", borderRadius: 6, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 12, fontFamily: "inherit", textAlign: "right" as const, boxSizing: "border-box" as const }} type="number" min="0" max="100" value={qpDraft.discountPercent} onChange={e => setQuotedPartEdit(prev => ({ ...prev, [s.id]: { ...prev[s.id]!, discountPercent: e.target.value } }))} placeholder="%" />
                          <button className="action" style={{ fontSize: 10, padding: "3px 7px" }} onClick={() => setQuotedPartEdit(prev => ({ ...prev, [s.id]: { ...prev[s.id]!, discountPercent: "20" } }))}>20%</button>
                          <button className="action" style={{ fontSize: 10, padding: "3px 7px" }} onClick={() => setQuotedPartEdit(prev => ({ ...prev, [s.id]: { ...prev[s.id]!, discountPercent: "30" } }))}>30%</button>
                          <span className="sk-mono" style={{ fontSize: 10, color: editDiscount ? "#2e7d32" : "var(--ink-3)", minWidth: 78, textAlign: "right" as const }}>
                            {money((parseFloat(qpDraft.quantity) || 1) * editFinal)}
                          </span>
                          <button className="action ink" style={{ fontSize: 10, padding: "3px 8px" }} onClick={() => saveQuotedPartEdit(s)}>OK</button>
                          <button className="action" style={{ fontSize: 10, padding: "3px 8px" }} onClick={() => setQuotedPartEdit(prev => ({ ...prev, [s.id]: null }))}>✕</button>
                        </div>
                      ) : (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "4px 0", borderBottom: "1px dashed var(--line)" }}>
                          {p.sku && <span className="sk-mono" style={{ fontSize: 10, background: "rgba(108,31,110,.1)", color: "#6c1f6e", padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>{p.sku}</span>}
                          {p.loyverseItemId && <span style={{ fontSize: 10, color: "#5cc8e8", flexShrink: 0 }} title="Código Loyverse verificado">🔗</span>}
                          <span style={{ flex: 1 }}>{p.description}</span>
                          <span className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", flexShrink: 0 }}>
                            ×{p.quantity}{p.unitPrice > 0 ? ` · ${discount ? `${discount}% · ` : ""}${money(p.quantity * finalUnit)}` : ""}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleQuotedPartInstalled(s, p)}
                            className={"action" + (p.installed ? " ink" : "")}
                            style={{ fontSize: 10, padding: "2px 7px", color: p.installed ? "#fff" : "#7a5500", borderColor: p.installed ? "var(--ink)" : "#e8a020", background: p.installed ? "var(--ink)" : "#fff9c4", flexShrink: 0 }}
                            title={p.installed ? "Marcar como pendiente" : "Marcar como instalado"}
                          >
                            {p.installed ? "Instalado" : "Pendiente"}
                          </button>
                          <button onClick={() => setQuotedPartEdit(prev => ({ ...prev, [s.id]: { id: p.id, description: p.description, quantity: String(p.quantity), unitPrice: String(baseUnit), discountPercent: p.discountPercent ? String(p.discountPercent) : "" } }))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0 }} title="Editar">✎</button>
                          <button onClick={() => removeQuotedPart(s, p.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 14, padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
                        </div>
                      );
                    })}
                    {total > 0 && (
                      <div className="sk-mono" style={{ fontSize: 10, textAlign: "right" as const, color: "#6c1f6e", paddingTop: 4, fontWeight: 700 }}>
                        Estimado: {money(total)}
                      </div>
                    )}
                  </div>
                )}

                {/* Formulario agregar */}
                <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" as const }}>
                  {/* Campo código + lupita */}
                  <div style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0 }}>
                    <input
                      style={{ ...fi2, width: 84, borderColor: qa.found === true ? "#5cc8e8" : qa.found === false ? "#c0392b" : "var(--line)" }}
                      value={qa.sku}
                      onChange={e => setQuotedAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyLookup()), sku: e.target.value, found: null, description: p[s.id]?.description || "", loyverseItemId: undefined, loyverseVariantId: undefined } }))}
                      onKeyDown={e => { if (e.key === "Enter") handleQuotedSKULookup(s.id, qa.sku); }}
                      placeholder="Código"
                    />
                    <button
                      onClick={() => handleQuotedSKULookup(s.id, qa.sku)}
                      disabled={!qa.sku.trim() || qa.looking}
                      style={{ background: qa.found === true ? "rgba(92,200,232,.15)" : "var(--paper)", border: `1.2px solid ${qa.found === true ? "#5cc8e8" : "var(--line)"}`, borderRadius: 6, cursor: "pointer", padding: "5px 7px", fontSize: 13, color: qa.found === true ? "#5cc8e8" : "var(--ink-3)", lineHeight: 1 }}
                      title="Buscar en Loyverse"
                    >
                      {qa.looking ? "⏳" : "🔍"}
                    </button>
                  </div>

                  {/* Descripción */}
                  <input
                    style={{ ...fi2, flex: 1, minWidth: 110, borderColor: qa.found === true ? "#5cc8e8" : "var(--line)" }}
                    value={qa.description}
                    readOnly
                    placeholder={qa.found === true ? "✓ auto-completado" : "Descripción del repuesto"}
                  />

                  {/* Cantidad */}
                  <input
                    style={{ ...fi2, width: 44, textAlign: "center" as const }}
                    type="number" min="1"
                    value={qa.quantity}
                    onChange={e => setQuotedAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyLookup()), quantity: e.target.value } }))}
                  />

                  {/* Precio */}
                  <input
                    style={{ ...fi2, width: 84, textAlign: "right" as const, background: "var(--paper-2)", color: "var(--ink-3)" }}
                    type="number" min="0"
                    value={qa.unitPrice}
                    readOnly
                    title="Precio tomado de Loyverse. Ajusta solo con descuento."
                    placeholder="$ base"
                  />

                  {/* Descuento */}
                  <input
                    style={{ ...fi2, width: 52, textAlign: "right" as const }}
                    type="number" min="0" max="100"
                    value={qa.discountPercent || ""}
                    onChange={e => setQuotedAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyLookup()), discountPercent: e.target.value } }))}
                    placeholder="%"
                  />
                  <button className="action" style={{ fontSize: 10, padding: "3px 7px", flexShrink: 0 }} onClick={() => setQuotedAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyLookup()), discountPercent: "20" } }))}>20%</button>
                  <button className="action" style={{ fontSize: 10, padding: "3px 7px", flexShrink: 0 }} onClick={() => setQuotedAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyLookup()), discountPercent: "30" } }))}>30%</button>

                  <button className="action ink" style={{ fontSize: 11, flexShrink: 0 }} onClick={() => addQuotedPart(s)} disabled={!qa.loyverseItemId}>
                    + Agregar
                  </button>
                </div>
                {clampDiscount(parseFloat(qa.discountPercent || "")) > 0 && parseFloat(qa.unitPrice) > 0 && (
                  <div className="sk-mono" style={{ fontSize: 10, color: "#2e7d32", marginTop: 5, background: "rgba(76,175,80,.1)", border: "1px solid #4caf50", borderRadius: 6, padding: "3px 6px", display: "inline-block" }}>
                    Precio con descuento: {money(discountedUnitPrice({ unitPrice: parseFloat(qa.unitPrice) || 0, originalUnitPrice: parseFloat(qa.unitPrice) || 0, discountPercent: clampDiscount(parseFloat(qa.discountPercent || "")) }))} c/u
                  </div>
                )}

                {/* Feedback de búsqueda */}
                {qa.found === false && (
                  <div style={{ fontSize: 10, color: "#c0392b", marginTop: 3 }}>
                    Código no encontrado en Loyverse. Revisa el código o créalo en Loyverse para poder agregarlo.
                  </div>
                )}
                {qa.found === true && (
                  <div style={{ fontSize: 10, color: "#5cc8e8", marginTop: 3 }}>
                    ✓ Encontrado — nombre y precio completados desde Loyverse.
                  </div>
                )}
              </div>
            );
          })()}

          {/* Bloque INGRESO DIGITAL + edición inline */}
          {(() => {
            const draft = editingIntake[s.id];
            const fi2: React.CSSProperties = { width: "100%", padding: "6px 9px", borderRadius: 6, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" as const, marginBottom: 6 };
            const la2: React.CSSProperties = { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase" as const, display: "block", marginBottom: 2 };
            return (
              <div style={{ marginTop: 10, background: "var(--paper-2)", border: "1px dashed var(--line)", borderRadius: 8, padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1 }}>INGRESO DIGITAL</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                      {s.date}
                      {s.workshopStartDate && <span style={{ marginLeft: 6 }}>· Elab: <strong style={{ color: "#6c1f6e" }}>{s.workshopStartDate}</strong></span>}
                    </span>
                    {!draft && (
                      <button className="action" style={{ fontSize: 10, padding: "1px 7px" }}
                        onClick={() => setEditingIntake(p => ({ ...p, [s.id]: {
                          clientName: s.clientName, clientEmail: s.clientEmail,
                          clientPhone: s.clientPhone || "", clientDocument: s.clientDocument || "",
                          loyverseCustomerId: s.loyverseCustomerId || "",
                          intakeReportedIssue: s.intakeReportedIssue || "",
                          intakeCondition: s.intakeCondition || "",
                          intakeAccessories: (s.intakeAccessories || []).join("\n"),
                          intakeSignatureName: s.intakeSignatureName || "",
                          intakeChecklist: buildIntakeChecklist(s.intakeChecklist),
                          neededByDate: s.neededByDate || "",
                          workshopStartDate: s.workshopStartDate || "",
                          notes: s.notes || "",
                          technicianId: s.technicianId || "",
                        } }))}>
                        ✎ Editar
                      </button>
                    )}
                  </div>
                </div>

                {draft ? (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={la2}>Nombre cliente</label>
                        <input style={fi2} value={draft.clientName} onChange={e => setEditingIntake(p => ({ ...p, [s.id]: { ...p[s.id], clientName: e.target.value } }))} />
                      </div>
                      <div>
                        <label style={la2}>Email</label>
                        <input style={fi2} type="email" value={draft.clientEmail} onChange={e => setEditingIntake(p => ({ ...p, [s.id]: { ...p[s.id], clientEmail: e.target.value } }))} />
                      </div>
                      <div>
                        <label style={la2}>Teléfono</label>
                        <input style={fi2} value={draft.clientPhone} onChange={e => setEditingIntake(p => ({ ...p, [s.id]: { ...p[s.id], clientPhone: e.target.value } }))} />
                      </div>
                      <div>
                        <label style={la2}>Documento</label>
                        <div style={{ display: "flex", gap: 5 }}>
                          <input style={{ ...fi2, flex: 1 }} value={draft.clientDocument} onChange={e => setEditingIntake(p => ({ ...p, [s.id]: { ...p[s.id], clientDocument: e.target.value, loyverseCustomerId: "" } }))} onKeyDown={e => { if (e.key === "Enter") fillDraftCustomerFromLoyverse(s.id, draft.clientDocument); }} />
                          {loyverseToken && <button className="action" style={{ fontSize: 10, padding: "4px 7px", height: 30 }} onClick={() => fillDraftCustomerFromLoyverse(s.id, draft.clientDocument)}>Buscar</button>}
                        </div>
                        {draft.loyverseCustomerId && <div style={{ fontSize: 10, color: "#2e7d32", marginTop: -4, marginBottom: 5 }}>Vinculado a cliente Loyverse.</div>}
                      </div>
                      <div>
                        <label style={la2}>Fecha entrega acordada</label>
                        <input style={fi2} type="date" value={draft.neededByDate} onChange={e => setEditingIntake(p => ({ ...p, [s.id]: { ...p[s.id], neededByDate: e.target.value } }))} />
                      </div>
                      <div>
                        <label style={la2}>Fecha elaboración</label>
                        <input style={fi2} type="date" value={draft.workshopStartDate} onChange={e => setEditingIntake(p => ({ ...p, [s.id]: { ...p[s.id], workshopStartDate: e.target.value } }))} />
                      </div>
                    </div>
                    <label style={la2}>Técnico asignado</label>
                    <select style={fi2} value={draft.technicianId} onChange={e => setEditingIntake(p => ({ ...p, [s.id]: { ...p[s.id], technicianId: e.target.value } }))}>
                      <option value="">Sin asignar</option>
                      {team.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
                    </select>
                    <label style={la2}>Motivo de ingreso / falla</label>
                    <textarea rows={2} style={{ ...fi2, resize: "vertical" as const }} value={draft.intakeReportedIssue} onChange={e => setEditingIntake(p => ({ ...p, [s.id]: { ...p[s.id], intakeReportedIssue: e.target.value } }))} />
                    <label style={la2}>Estado inicial de la bicicleta</label>
                    <textarea rows={2} style={{ ...fi2, resize: "vertical" as const }} value={draft.intakeCondition} onChange={e => setEditingIntake(p => ({ ...p, [s.id]: { ...p[s.id], intakeCondition: e.target.value } }))} />
                    <label style={la2}>Accesorios recibidos (uno por línea)</label>
                    <textarea rows={2} style={{ ...fi2, resize: "vertical" as const }} value={draft.intakeAccessories} onChange={e => setEditingIntake(p => ({ ...p, [s.id]: { ...p[s.id], intakeAccessories: e.target.value } }))} />
                    <div style={{ border: "1px dashed var(--line)", borderRadius: 8, padding: 8, margin: "4px 0 8px" }}>
                      <div className="sk-mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: 1, marginBottom: 6 }}>CHECKLIST DE INGRESO</div>
                      {buildIntakeChecklist(draft.intakeChecklist).map(item => (
                        <div key={item.key} style={{ display: "grid", gridTemplateColumns: "1fr 92px", gap: 5, marginBottom: 5, alignItems: "center" }}>
                          <div style={{ fontSize: 11, fontWeight: 600 }}>{item.label}</div>
                          <select
                            style={{ ...fi2, marginBottom: 0, padding: "4px 6px", fontSize: 11 }}
                            value={item.status}
                            onChange={e => setEditingIntake(p => ({ ...p, [s.id]: { ...p[s.id], intakeChecklist: buildIntakeChecklist(p[s.id].intakeChecklist).map(row => row.key === item.key ? { ...row, status: e.target.value as IntakeChecklistStatus } : row) } }))}
                          >
                            <option value="ok">OK</option>
                            <option value="attention">Revisar</option>
                            <option value="missing">Falta</option>
                            <option value="na">N/A</option>
                          </select>
                          <input
                            style={{ ...fi2, marginBottom: 0, padding: "4px 6px", fontSize: 11, gridColumn: "1 / -1" }}
                            value={item.note || ""}
                            onChange={e => setEditingIntake(p => ({ ...p, [s.id]: { ...p[s.id], intakeChecklist: buildIntakeChecklist(p[s.id].intakeChecklist).map(row => row.key === item.key ? { ...row, note: e.target.value } : row) } }))}
                            placeholder="Nota opcional"
                          />
                        </div>
                      ))}
                    </div>
                    <label style={la2}>Entregó / Autoriza</label>
                    <input style={fi2} value={draft.intakeSignatureName} onChange={e => setEditingIntake(p => ({ ...p, [s.id]: { ...p[s.id], intakeSignatureName: e.target.value } }))} />
                    <label style={la2}>Notas generales</label>
                    <textarea rows={2} style={{ ...fi2, resize: "vertical" as const }} value={draft.notes} onChange={e => setEditingIntake(p => ({ ...p, [s.id]: { ...p[s.id], notes: e.target.value } }))} />
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button className="action ink" style={{ fontSize: 12, flex: 1 }} onClick={() => {
                        onUpdateService(s.id, {
                          clientName: draft.clientName.trim() || s.clientName,
                          clientEmail: draft.clientEmail.trim() || s.clientEmail,
                          clientPhone: draft.clientPhone.trim() || undefined,
                          clientDocument: draft.clientDocument.trim() || undefined,
                          loyverseCustomerId: draft.loyverseCustomerId || undefined,
                          intakeReportedIssue: draft.intakeReportedIssue.trim() || undefined,
                          intakeCondition: draft.intakeCondition.trim() || undefined,
                          intakeAccessories: splitLines(draft.intakeAccessories),
                          intakeChecklist: normalizeIntakeChecklist(draft.intakeChecklist),
                          intakeSignatureName: draft.intakeSignatureName.trim() || undefined,
                          neededByDate: draft.neededByDate || undefined,
                          workshopStartDate: draft.workshopStartDate || undefined,
                          notes: draft.notes.trim(),
                          technicianId: draft.technicianId || undefined,
                        });
                        setEditingIntake(p => { const n = { ...p }; delete n[s.id]; return n; });
                      }}>Guardar cambios</button>
                      <button className="action" style={{ fontSize: 12 }} onClick={() => setEditingIntake(p => { const n = { ...p }; delete n[s.id]; return n; })}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {s.intakeReportedIssue && <div><strong>Motivo:</strong> {s.intakeReportedIssue}</div>}
                    {s.intakeCondition && <div><strong>Estado inicial:</strong> {s.intakeCondition}</div>}
                    {(s.intakeAccessories || []).length > 0 && <div><strong>Accesorios:</strong> {(s.intakeAccessories || []).join(", ")}</div>}
                    <div><strong>Checklist ingreso:</strong> {intakeChecklistSummary(s.intakeChecklist)}</div>
                    {s.notes && <div><strong>Notas:</strong> {s.notes}</div>}
                    {s.intakeSignatureName && <div><strong>Entregó / Autoriza:</strong> {s.intakeSignatureName}{s.clientDocument ? ` · CC ${s.clientDocument}` : ""}</div>}
                    {s.neededByDate && <div><strong>Fecha entrega acordada:</strong> {s.neededByDate}</div>}
                    {!s.intakeReportedIssue && !s.intakeCondition && !(s.intakeAccessories || []).length && !s.notes && !s.intakeSignatureName && (
                      <div style={{ color: "var(--ink-3)", fontStyle: "italic" }}>Sin datos de ingreso — toca "✎ Editar" para completar.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Quick-add repuestos desde Loyverse */}
          <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10, ...(!isUsedPartsStage(s) && actualUsedParts(s).length === 0 ? { display: "none" } : {}) }}>
            {(() => {
              const qa = quickAdd[s.id] || emptyQA();
              const currentParts = actualUsedParts(s);
              const fi2: React.CSSProperties = { padding: "4px 7px", borderRadius: 6, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 11, fontFamily: "inherit", boxSizing: "border-box" as const };
              return (
                <>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1 }}>➕ AGREGAR REPUESTO EXTRA A LA CUENTA</div>
                    {isMantService(s) && (
                      <div style={{ fontSize: 9, background: "rgba(76,175,80,.12)", border: "1px solid #4caf50", borderRadius: 4, padding: "1px 6px", color: "#2e7d32", fontFamily: "var(--mono)" }}>
                        -20% mant · solo repuestos
                      </div>
                    )}
                  </div>
                  {false && currentParts.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      {currentParts.map(p => {
                        const editingUP = usedPartEdit[s.id]?.id === p.id;
                        const upDraft = usedPartEdit[s.id];
                        return editingUP && upDraft ? (
                          <div key={p.id} style={{ display: "flex", gap: 4, padding: "3px 0", borderBottom: "1px dashed var(--line)", alignItems: "center", flexWrap: "wrap" as const }}>
                            <input style={{ flex: 1, minWidth: 90, padding: "3px 6px", borderRadius: 5, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 11, fontFamily: "inherit", boxSizing: "border-box" as const }} value={upDraft.description} onChange={e => setUsedPartEdit(prev => ({ ...prev, [s.id]: { ...prev[s.id]!, description: e.target.value } }))} />
                            <input style={{ width: 38, padding: "3px 4px", borderRadius: 5, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 11, fontFamily: "inherit", textAlign: "center" as const, boxSizing: "border-box" as const }} type="number" min="1" value={upDraft.quantity} onChange={e => setUsedPartEdit(prev => ({ ...prev, [s.id]: { ...prev[s.id]!, quantity: e.target.value } }))} />
                            <input style={{ width: 76, padding: "3px 6px", borderRadius: 5, border: "1.2px solid var(--line)", background: "var(--paper-2)", color: "var(--ink-3)", fontSize: 11, fontFamily: "inherit", textAlign: "right" as const, boxSizing: "border-box" as const }} type="number" min="0" value={upDraft.unitPrice} readOnly title="Precio tomado de Loyverse. Ajusta solo con descuento." />
                            <input style={{ width: 50, padding: "3px 5px", borderRadius: 5, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 11, fontFamily: "inherit", textAlign: "right" as const, boxSizing: "border-box" as const }} type="number" min="0" max="100" value={upDraft.discountPercent} onChange={e => setUsedPartEdit(prev => ({ ...prev, [s.id]: { ...prev[s.id]!, discountPercent: e.target.value } }))} placeholder="%" />
                            <button className="action ink" style={{ fontSize: 10, padding: "2px 7px" }} onClick={() => saveUsedPartEdit(s)}>OK</button>
                            <button className="action" style={{ fontSize: 10, padding: "2px 7px" }} onClick={() => setUsedPartEdit(prev => ({ ...prev, [s.id]: null }))}>✕</button>
                          </div>
                        ) : (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, padding: "3px 0", borderBottom: "1px dashed var(--line)" }}>
                            {p.sku && <span className="sk-mono" style={{ fontSize: 9, background: "rgba(108,31,110,.1)", color: "#6c1f6e", padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>{p.sku}</span>}
                            {p.loyverseItemId && <span style={{ fontSize: 9, color: "#5cc8e8", flexShrink: 0 }} title="Sincronizado con Loyverse">🔗</span>}
                            <span style={{ flex: 1 }}>{p.description}</span>
                            <span className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", flexShrink: 0 }}>×{p.quantity} · {p.discountPercent ? `${p.discountPercent}% · ` : ""}{money(p.quantity * p.unitPrice)}</span>
                            <button onClick={() => setUsedPartEdit(prev => ({ ...prev, [s.id]: { id: p.id, description: p.description, quantity: String(p.quantity), unitPrice: String(p.originalUnitPrice ?? p.unitPrice), discountPercent: p.discountPercent ? String(p.discountPercent) : "" } }))}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 12, padding: 0, lineHeight: 1, flexShrink: 0 }} title="Editar">✎</button>
                            <button onClick={() => removeQuickPart(s, p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 13, padding: 0, lineHeight: 1, flexShrink: 0 }} title="Quitar">×</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" as const }}>
                    <input
                      style={{ ...fi2, width: 80, borderColor: qa.found === true ? "#5cc8e8" : qa.found === false ? "#c0392b" : "var(--line)" }}
                      value={qa.sku}
                      onChange={e => setQuickAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), sku: e.target.value, found: null, loyverseItemId: undefined, loyverseVariantId: undefined } }))}
                      onKeyDown={e => { if (e.key === "Enter" && qa.sku.trim()) handleSKULookup(s.id, qa.sku); }}
                      placeholder={loyverseToken ? "Código" : "Código"}
                      title={loyverseToken ? "Escribe el código y Enter para buscar en Loyverse" : "Configura el token Loyverse en Perfil para búsqueda automática"}
                    />
                    {loyverseToken && qa.sku.trim() && !qa.looking && <button className="action" style={{ fontSize: 10, padding: "3px 8px", flexShrink: 0 }} onClick={() => handleSKULookup(s.id, qa.sku)} title="Buscar en Loyverse">🔍</button>}
                    {qa.looking && <span style={{ fontSize: 10, color: "var(--ink-3)" }}>buscando...</span>}
                    <input
                      style={{ ...fi2, flex: 1, minWidth: 100, borderColor: qa.found === true ? "#5cc8e8" : "var(--line)" }}
                      value={qa.description}
                      readOnly
                      placeholder="Descripción"
                    />
                    <input style={{ ...fi2, width: 40, textAlign: "center" as const }} type="number" min="1" value={qa.quantity} onChange={e => setQuickAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), quantity: e.target.value } }))} />
                    <input style={{ ...fi2, width: 76, textAlign: "right" as const, background: "var(--paper-2)", color: "var(--ink-3)" }} type="number" min="0" value={qa.unitPrice} readOnly title="Precio tomado de Loyverse. Ajusta solo con descuento." placeholder="Precio" />
                    <input style={{ ...fi2, width: 48, textAlign: "right" as const }} type="number" min="0" max="100" value={qa.discountPercent || ""} onChange={e => setQuickAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), discountPercent: e.target.value } }))} placeholder={isMantService(s) ? "20%" : "%"} />
                    <button className="action" style={{ fontSize: 10, padding: "3px 7px", flexShrink: 0 }} onClick={() => setQuickAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), discountPercent: "20" } }))}>20%</button>
                    <button className="action" style={{ fontSize: 10, padding: "3px 7px", flexShrink: 0 }} onClick={() => setQuickAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), discountPercent: "30" } }))}>30%</button>
                    <button className="action ink" style={{ fontSize: 11, flexShrink: 0 }} onClick={() => addQuickPart(s)} disabled={!qa.loyverseItemId}>+ Agregar</button>
                  </div>
                  {(clampDiscount(parseFloat(qa.discountPercent || "")) || isMantService(s)) && parseFloat(qa.unitPrice) > 0 && (
                    <div className="sk-mono" style={{ fontSize: 10, color: "#2e7d32", marginTop: 5, background: "rgba(76,175,80,.1)", border: "1px solid #4caf50", borderRadius: 6, padding: "3px 6px", display: "inline-block" }}>
                      Precio con descuento: {money(discountedUnitPrice({ unitPrice: parseFloat(qa.unitPrice) || 0, discountPercent: clampDiscount(parseFloat(qa.discountPercent || "")) || 20 }))} c/u
                    </div>
                  )}
                  {qa.found === false && <div style={{ fontSize: 10, color: "#c0392b", marginTop: 3 }}>Código no encontrado en Loyverse. Revisa el código o créalo en Loyverse para poder agregarlo.</div>}
                  {qa.found === true && <div style={{ fontSize: 10, color: "#5cc8e8", marginTop: 3 }}>✓ Encontrado en Loyverse — nombre y precio completados automáticamente.</div>}
                </>
              );
            })()}
          </div>

          {/* Panel de diagnóstico técnico */}
          {canEditDiag && <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            {/* Historial de diagnósticos existentes */}
            {(s.diagnosticUpdates || []).length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1, marginBottom: 6 }}>DIAGNÓSTICO TÉCNICO</div>
                {[...(s.diagnosticUpdates || [])].reverse().map(d => {
                  const editingDiag = diagEditState[s.id]?.diagId === d.id;
                  const editDiagDraft = diagEditState[s.id]?.draft;
                  const dfi: React.CSSProperties = { width: "100%", padding: "6px 9px", borderRadius: 6, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" as const, marginBottom: 5, resize: "vertical" as const };
                  const dla: React.CSSProperties = { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase" as const, display: "block", marginBottom: 2 };
                  return (
                    <div key={d.id} style={{ background: "var(--paper-2)", border: `1px solid ${editingDiag ? "#6c1f6e" : "var(--line)"}`, borderRadius: 8, padding: 10, marginBottom: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div className="sk-mono" style={{ fontSize: 9, color: "var(--ink-3)" }}>
                          {new Date(d.date).toLocaleDateString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {!editingDiag && (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="action" style={{ fontSize: 10, padding: "1px 7px" }}
                              onClick={() => setDiagEditState(p => ({ ...p, [s.id]: { diagId: d.id, draft: { estado: d.estado || "", hallazgos: d.hallazgos || "", problemas: d.problemas || "", recomendaciones: d.recomendaciones || "", partesRaw: (d.partes || []).join("\n"), labor: d.labor || "" } } }))}>
                              ✎ Editar
                            </button>
                            <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 14, padding: "0 2px", lineHeight: 1 }}
                              onClick={() => deleteDiagEntry(s, d.id)} title="Eliminar diagnóstico">🗑</button>
                          </div>
                        )}
                      </div>
                      {editingDiag && editDiagDraft ? (
                        <div>
                          <label style={dla}>Estado general</label>
                          <textarea rows={2} style={dfi} value={editDiagDraft.estado} onChange={e => setDiagEditState(p => ({ ...p, [s.id]: { ...p[s.id]!, draft: { ...p[s.id]!.draft, estado: e.target.value } } }))} />
                          <label style={dla}>Hallazgos</label>
                          <textarea rows={2} style={dfi} value={editDiagDraft.hallazgos} onChange={e => setDiagEditState(p => ({ ...p, [s.id]: { ...p[s.id]!, draft: { ...p[s.id]!.draft, hallazgos: e.target.value } } }))} />
                          <label style={dla}>Problemas detectados</label>
                          <textarea rows={2} style={dfi} value={editDiagDraft.problemas} onChange={e => setDiagEditState(p => ({ ...p, [s.id]: { ...p[s.id]!, draft: { ...p[s.id]!.draft, problemas: e.target.value } } }))} />
                          <label style={dla}>Recomendaciones</label>
                          <textarea rows={2} style={dfi} value={editDiagDraft.recomendaciones} onChange={e => setDiagEditState(p => ({ ...p, [s.id]: { ...p[s.id]!, draft: { ...p[s.id]!.draft, recomendaciones: e.target.value } } }))} />
                          <label style={dla}>Repuestos recomendados (uno por línea)</label>
                          <textarea rows={3} style={dfi} value={editDiagDraft.partesRaw} onChange={e => setDiagEditState(p => ({ ...p, [s.id]: { ...p[s.id]!, draft: { ...p[s.id]!.draft, partesRaw: e.target.value } } }))} />
                          <label style={dla}>Mano de obra sugerida</label>
                          <textarea rows={2} style={dfi} value={editDiagDraft.labor} onChange={e => setDiagEditState(p => ({ ...p, [s.id]: { ...p[s.id]!, draft: { ...p[s.id]!.draft, labor: e.target.value } } }))} />
                          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            <button className="action ink" style={{ fontSize: 12, flex: 1 }} onClick={() => saveEditDiag(s)}>Guardar cambios</button>
                            <button className="action" style={{ fontSize: 12 }} onClick={() => setDiagEditState(p => ({ ...p, [s.id]: null }))}>Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {d.estado && <div style={{ fontSize: 12, marginBottom: 2 }}><span style={{ color: "#9c4a9e", fontWeight: 600 }}>Estado: </span>{d.estado}</div>}
                          {d.hallazgos && <div style={{ fontSize: 12, marginBottom: 2 }}><span style={{ color: "#e8a020", fontWeight: 600 }}>Hallazgos: </span>{d.hallazgos}</div>}
                          {d.problemas && <div style={{ fontSize: 12, marginBottom: 2 }}><span style={{ color: "#c0392b", fontWeight: 600 }}>Problemas: </span>{d.problemas}</div>}
                          {d.recomendaciones && <div style={{ fontSize: 12, marginBottom: d.partes.length > 0 ? 6 : 0 }}><span style={{ color: "#5cc8e8", fontWeight: 600 }}>Recomendaciones: </span>{d.recomendaciones}</div>}
                          {d.labor && <div style={{ fontSize: 12, marginBottom: d.partes.length > 0 ? 6 : 0 }}><span style={{ color: "#6c1f6e", fontWeight: 600 }}>Mano de obra sugerida: </span>{d.labor}</div>}
                          {d.partes.length > 0 && (
                            <div style={{ background: "rgba(232,160,32,.08)", border: "1px solid #e8a020", borderRadius: 6, padding: "6px 10px" }}>
                              <div style={{ fontSize: 10, color: "#e8a020", fontFamily: "var(--mono)", letterSpacing: 0.5, marginBottom: 4 }}>🔩 REPUESTOS RECOMENDADOS</div>
                              {d.partes.map((p, i) => <div key={i} style={{ fontSize: 12 }}>· {p}</div>)}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
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
                  <label style={la}>Mano de obra sugerida</label>
                  <textarea rows={2} style={fi} value={draft.labor} onChange={e => setDraft(s.id, "labor", e.target.value)} placeholder="Ajuste de cambios, purga, centrado, limpieza..." />
                  <button className="action ink" style={{ fontSize: 12, width: "100%" }} onClick={() => saveDiag(s)}>Guardar diagnóstico</button>
                </div>
              );
            })()}
          </div>}

          {/* Trabajo final y facturacion */}
          {canSeeBilling && <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            {(() => {
              const billing = billingWithServiceLine(s);
              const draft = getBillingDraft(s);
              const fi: React.CSSProperties = { width: "100%", padding: "7px 10px", borderRadius: 7, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box", marginBottom: 6, resize: "vertical" as const };
              const la: React.CSSProperties = { fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase" as const, display: "block", marginBottom: 3 };
              return (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                    <div>
                      <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1 }}>TRABAJO FINAL / FACTURA</div>
                      <div style={{ fontSize: 12, color: hasFinalBilling(s) ? "#2e7d32" : "#c0392b", fontWeight: 600 }}>
                        {hasFinalBilling(s) ? `${money(billing.total)} · saldo ${money(billing.balance)}` : "Pendiente: obligatorio para terminar"}
                      </div>
                    </div>
                    {canEditBillingForService(s) ? (
                      <button className="action" style={{ fontSize: 11, background: "#fff", color: "#6c1f6e", borderColor: "#6c1f6e", fontWeight: 700 }} onClick={() => {
                        if (!billingDraft[s.id]) setBillingDraft(p => ({ ...p, [s.id]: getBillingDraft(s) }));
                        setShowBilling(p => ({ ...p, [s.id]: !p[s.id] }));
                      }}>
                        {showBilling[s.id] ? "Cerrar factura" : "Editar factura"}
                      </button>
                    ) : (
                      <span className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>Factura bloqueada · admin</span>
                    )}
                  </div>
                  {showBilling[s.id] && (() => {
                    const fc: React.CSSProperties = { width: "100%", padding: "4px 6px", borderRadius: 5, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 11, fontFamily: "inherit", boxSizing: "border-box" as const };
                    const th: React.CSSProperties = { fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)", letterSpacing: 0.5, textTransform: "uppercase" as const };
                    const updateRow = (section: "parts" | "labor", idx: number, field: keyof BillingRow, val: string) =>
                      setBillingDraft(p => { const d = p[s.id] || getBillingDraft(s); const rows = [...d[section]]; rows[idx] = { ...rows[idx], [field]: val }; return { ...p, [s.id]: { ...d, [section]: rows } }; });
                    const removeRow = (section: "parts" | "labor", idx: number) =>
                      setBillingDraft(p => { const d = p[s.id] || getBillingDraft(s); const rows = d[section].filter((_, i) => i !== idx); return { ...p, [s.id]: { ...d, [section]: rows.length ? rows : [emptyBillingRow()] } }; });
                    const previewBill = calcBilling({ ...blankBilling(draft.paymentStatus, parseFloat(draft.advance || "0") || 0), parts: itemsFromRows(draft.parts, "repuesto"), labor: itemsFromRows(draft.labor, "mano_obra") });
                    const renderTable = (section: "parts" | "labor") => (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 44px 76px 52px 72px 22px", gap: 3, marginBottom: 3 }}>
                          <span style={th}>Descripción</span>
                          <span style={{ ...th, textAlign: "center" as const }}>Cant</span>
                          <span style={{ ...th, textAlign: "right" as const }}>$ Unitario</span>
                          <span style={{ ...th, textAlign: "right" as const }}>% Desc</span>
                          <span style={{ ...th, textAlign: "right" as const }}>Total</span>
                          <span />
                        </div>
                        {draft[section].map((row, idx) => {
                          const basePrice = parseFloat(row.unitPrice) || 0;
                          const discountPercent = clampDiscount(parseFloat(row.discountPercent));
                          const finalUnitPrice = discountPercent ? discountedUnitPrice({ unitPrice: basePrice, originalUnitPrice: basePrice, discountPercent }) : basePrice;
                          const rowTotal = (parseFloat(row.quantity) || 0) * finalUnitPrice;
                          const quotedPart = section === "parts" && row.id?.startsWith("quoted-")
                            ? (s.quotedParts || []).find(part => `quoted-${part.id}` === row.id)
                            : null;
                          const partStatus = section === "parts" && row.description.trim()
                            ? quotedPart
                              ? { label: quotedPart.installed ? "Instalado en taller" : "Pendiente taller", color: quotedPart.installed ? "#2e7d32" : "#9a6a00", bg: quotedPart.installed ? "rgba(76,175,80,.12)" : "rgba(232,160,32,.16)", border: quotedPart.installed ? "#4caf50" : "#e8a020" }
                              : { label: "Extra en factura", color: "#6c1f6e", bg: "rgba(108,31,110,.08)", border: "#9c4a9e" }
                            : null;
                          return (
                            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 44px 76px 52px 72px 22px", gap: 3, marginBottom: 3, alignItems: "center" }}>
                              <div>
                                <input style={fc} value={row.description} onChange={e => updateRow(section, idx, "description", e.target.value)} placeholder="Descripción" />
                                {partStatus && (
                                  <span className="sk-mono" style={{ display: "inline-block", marginTop: -3, marginBottom: 3, fontSize: 8.5, color: partStatus.color, background: partStatus.bg, border: `1px solid ${partStatus.border}`, borderRadius: 999, padding: "1px 6px" }}>
                                    {partStatus.label}
                                  </span>
                                )}
                              </div>
                              <input style={{ ...fc, textAlign: "center" as const }} type="number" min="1" value={row.quantity} onChange={e => updateRow(section, idx, "quantity", e.target.value)} />
                              <input style={{ ...fc, textAlign: "right" as const, background: "var(--paper-2)", color: "var(--ink-3)" }} type="number" min="0" value={row.unitPrice} readOnly title="Precio tomado de Loyverse. Ajusta solo con descuento." placeholder="0" />
                              <input style={{ ...fc, textAlign: "right" as const }} type="number" min="0" max="100" value={row.discountPercent} onChange={e => updateRow(section, idx, "discountPercent", e.target.value)} placeholder="%" />
                              <span style={{ fontSize: 11, textAlign: "right" as const, color: rowTotal > 0 ? "var(--ink)" : "var(--ink-3)", fontFamily: "var(--mono)" }}>${rowTotal.toLocaleString("es-CO")}</span>
                              <button onClick={() => removeRow(section, idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                            </div>
                          );
                        })}
                      </div>
                    );
                    const renderLoyversePartAdder = () => {
                      const row = billingPartAdd[s.id] || emptyQA();
                      const basePrice = parseFloat(row.unitPrice) || 0;
                      const discountPercent = clampDiscount(parseFloat(row.discountPercent || ""));
                      const finalUnitPrice = discountPercent ? discountedUnitPrice({ unitPrice: basePrice, originalUnitPrice: basePrice, discountPercent }) : basePrice;
                      return (
                        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 7, padding: 8, marginBottom: 10 }}>
                          <div className="sk-mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: 1, marginBottom: 5 }}>AGREGAR REPUESTO DESDE LOYVERSE</div>
                          <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" as const }}>
                            <input style={{ ...fc, width: 88, borderColor: row.found === true ? "#5cc8e8" : row.found === false ? "#c0392b" : "var(--line)" }} value={row.sku} onChange={e => setBillingPartAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), sku: e.target.value, found: null, loyverseItemId: undefined, loyverseVariantId: undefined } }))} onKeyDown={e => { if (e.key === "Enter") handleBillingPartLookup(s.id, row.sku); }} placeholder="Código" />
                            {loyverseToken && row.sku.trim() && !row.looking && <button className="action" style={{ fontSize: 10, padding: "3px 8px" }} onClick={() => handleBillingPartLookup(s.id, row.sku)}>Buscar</button>}
                            {row.looking && <span className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>buscando...</span>}
                            <input style={{ ...fc, flex: 1, minWidth: 120 }} value={row.description} readOnly placeholder="Nombre desde Loyverse" />
                            <input style={{ ...fc, width: 42, textAlign: "center" as const }} type="number" min="1" value={row.quantity} onChange={e => setBillingPartAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), quantity: e.target.value } }))} />
                            <input style={{ ...fc, width: 74, textAlign: "right" as const, background: "var(--paper-2)", color: "var(--ink-3)" }} type="number" min="0" value={row.unitPrice} readOnly title="Precio tomado de Loyverse. Ajusta solo con descuento." placeholder="Precio" />
                            <input style={{ ...fc, width: 50, textAlign: "right" as const }} type="number" min="0" max="100" value={row.discountPercent || ""} onChange={e => setBillingPartAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), discountPercent: e.target.value } }))} placeholder="%" />
                            <button className="action ink" style={{ fontSize: 10 }} onClick={() => addBillingPartFromLoyverse(s)} disabled={row.looking || !row.sku.trim()}>+ Agregar</button>
                          </div>
                          {row.found === true && <div style={{ fontSize: 10, color: "#5cc8e8", marginTop: 4 }}>Encontrado en Loyverse · {money(finalUnitPrice)} c/u</div>}
                          {row.found === false && <div style={{ fontSize: 10, color: "#c0392b", marginTop: 4 }}>No existe en Loyverse. Créalo o revisa el código para poder agregarlo.</div>}
                        </div>
                      );
                    };
                    const renderLoyverseServiceAdder = () => {
                      const row = billingServiceAdd[s.id] || emptyQA();
                      return (
                        <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 7, padding: 8, marginBottom: 10 }}>
                          <div className="sk-mono" style={{ fontSize: 9, color: "var(--ink-3)", letterSpacing: 1, marginBottom: 5 }}>AGREGAR SERVICIO DESDE LOYVERSE</div>
                          <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" as const }}>
                            <input style={{ ...fc, width: 92, borderColor: row.found === true ? "#5cc8e8" : row.found === false ? "#c0392b" : "var(--line)" }} value={row.sku} onChange={e => setBillingServiceAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), sku: e.target.value, found: null, loyverseItemId: undefined, loyverseVariantId: undefined } }))} onKeyDown={e => { if (e.key === "Enter") handleBillingServiceLookup(s.id, row.sku); }} placeholder="Código" />
                            {loyverseToken && row.sku.trim() && !row.looking && <button className="action" style={{ fontSize: 10, padding: "3px 8px" }} onClick={() => handleBillingServiceLookup(s.id, row.sku)}>Buscar</button>}
                            {row.looking && <span className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>buscando...</span>}
                            <input style={{ ...fc, flex: 1, minWidth: 120 }} value={row.description} readOnly placeholder="Servicio desde Loyverse" />
                            <input style={{ ...fc, width: 42, textAlign: "center" as const }} type="number" min="1" value={row.quantity} onChange={e => setBillingServiceAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), quantity: e.target.value } }))} />
                            <input style={{ ...fc, width: 74, textAlign: "right" as const, background: "var(--paper-2)", color: "var(--ink-3)" }} type="number" min="0" value={row.unitPrice} readOnly title="Precio tomado de Loyverse. Ajusta solo con descuento." placeholder="Precio" />
                            <input style={{ ...fc, width: 50, textAlign: "right" as const }} type="number" min="0" max="100" value={row.discountPercent || ""} onChange={e => setBillingServiceAdd(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), discountPercent: e.target.value } }))} placeholder="%" />
                            <button className="action ink" style={{ fontSize: 10 }} onClick={() => addBillingServiceFromLoyverse(s)} disabled={row.looking || !row.sku.trim()}>+ Agregar</button>
                          </div>
                          {row.found === true && <div style={{ fontSize: 10, color: "#5cc8e8", marginTop: 4 }}>Servicio encontrado en Loyverse.</div>}
                          {row.found === false && <div style={{ fontSize: 10, color: "#c0392b", marginTop: 4 }}>No existe en Loyverse. Créalo o revisa el código para poder agregarlo.</div>}
                        </div>
                      );
                    };
                    return (
                      <div style={{ background: "var(--paper-2)", border: "1px dashed var(--line)", borderRadius: 8, padding: 12 }}>
                        <label style={la}>Repuestos / productos cobrados</label>
                        {renderLoyversePartAdder()}
                        {renderTable("parts")}
                        <label style={la}>Mano de obra / servicios cobrados</label>
                        {renderLoyverseServiceAdder()}
                        {renderTable("labor")}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
                          <div>
                            <label style={la}>Abono</label>
                            <input style={{ ...fi, resize: undefined }} type="number" min="0" value={draft.advance} onChange={e => setBillingDraft(p => ({ ...p, [s.id]: { ...draft, advance: e.target.value } }))} placeholder="0" />
                          </div>
                          <div>
                            <label style={la}>Estado de pago</label>
                            <select style={{ ...fi, resize: undefined }} value={draft.paymentStatus} onChange={e => setBillingDraft(p => ({ ...p, [s.id]: { ...draft, paymentStatus: e.target.value as ServiceBilling["paymentStatus"] } }))}>
                              <option value="pendiente">Pendiente</option>
                              <option value="adelanto">Adelanto</option>
                              <option value="pagado">Pagado</option>
                            </select>
                          </div>
                        </div>
                        <label style={la}>Observaciones finales</label>
                        <textarea rows={2} style={fi} value={draft.notes} onChange={e => setBillingDraft(p => ({ ...p, [s.id]: { ...draft, notes: e.target.value } }))} placeholder="Trabajo entregado, recomendaciones de uso, garantia..." />
                        <div className="sk-mono" style={{ fontSize: 10, background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 6, padding: "5px 8px", marginBottom: 8, display: "flex", gap: 12, flexWrap: "wrap" as const }}>
                          <span>Subtotal: <strong>{money(previewBill.subtotal)}</strong></span>
                          <span>Abono: <strong>{money(previewBill.advance)}</strong></span>
                          <span style={{ color: previewBill.balance > 0 ? "#c0392b" : "#2e7d32" }}>Saldo: <strong>{money(previewBill.balance)}</strong></span>
                        </div>
                        {/* Loyverse sync status */}
                        {s.finalBilling?.loyverseReceiptId ? (
                          <div style={{ fontSize: 10, color: "#5cc8e8", background: "rgba(92,200,232,.08)", border: "1px solid #5cc8e8", borderRadius: 6, padding: "5px 8px", marginBottom: 8, fontFamily: "var(--mono)" }}>
                            🔗 Loyverse: <strong>{s.finalBilling.loyverseReceiptId}</strong>
                            {s.finalBilling.loyverseSyncedAt && <span style={{ marginLeft: 8, color: "var(--ink-3)" }}>{new Date(s.finalBilling.loyverseSyncedAt).toLocaleDateString("es-CO")}</span>}
                            <button style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", color: "#5cc8e8", fontSize: 10, fontFamily: "inherit" }}
                              onClick={() => handleSendToLoyverse(s)} title="Re-enviar a Loyverse">↻ Re-enviar</button>
                          </div>
                        ) : (
                          <button className="action" style={{ fontSize: 11, width: "100%", marginBottom: 8, borderColor: "#5cc8e8", color: "#5cc8e8" }}
                            onClick={() => handleSendToLoyverse(s)} disabled={loyverseSending[s.id]}>
                            {loyverseSending[s.id] ? "Enviando a Loyverse..." : "🔗 Enviar a Loyverse"}
                          </button>
                        )}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                          <button className="action" style={{ fontSize: 12, flex: 1 }} onClick={() => saveBilling(s)}>Guardar factura</button>
                          <button className="action ink" style={{ fontSize: 12, flex: 1 }} onClick={() => saveBilling(s, true)}>Guardar y marcar terminada</button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
            {/* Botón imprimir recibo — visible solo si hay factura */}
            {hasFinalBilling(s) && (
              <div style={{ marginTop: 8 }}>
                <button className="action" style={{ fontSize: 11, borderColor: "#9c4a9e", color: "#6c1f6e" }}
                  onClick={() => setPrintService(s)}>
                  🖨 Imprimir recibo
                </button>
              </div>
            )}
          </div>}

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
                <button onClick={() => requestDeliverySignature(s)}
                  style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, border: "1.3px solid #4caf50", background: "rgba(76,175,80,.1)", color: "#2e7d32", cursor: "pointer", fontFamily: "inherit" }}>
                  Marcar entregada
                </button>
              )}
              {s.deliveryStatus === "entregada" && deliveryDateLabel(s) && (
                <span className="sk-mono" style={{ width: "100%", textAlign: "right" as const, fontSize: 10, color: "#2e7d32" }}>
                  Entregada: {deliveryDateLabel(s)}
                </span>
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
          </>
          )}
        </div>
        );
      })}

      {filteredDone.length > 0 && (
        <>
          <div className="sk-mono" style={{ fontSize: 11, color: "#2e7d32", letterSpacing: 1, marginTop: 24, marginBottom: 10 }}>✅ LISTAS PARA RECOGER ({done.length})</div>
          {filteredDone.map(s => (
            <div key={s.id} style={{ background: "rgba(76,175,80,.07)", border: "2px solid #4caf50", borderRadius: 12, padding: 14, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#1b5e20" }}>{s.clientName}</span>
                  <span style={{ color: "#388e3c", fontSize: 13 }}> · {s.bikeDescription}</span>
                  {s.serviceType && <div style={{ fontSize: 11, color: "#388e3c", marginTop: 1 }}>🛠 {s.serviceType}</div>}
                  <div className="sk-mono" style={{ fontSize: 10, color: "#4caf50", marginTop: 2 }}>📥 Ingresó: {s.date}</div>
                  {ticketSummary(s).subtotal > 0 && <div className="sk-mono" style={{ fontSize: 10, color: "#2e7d32", marginTop: 2 }}>TICKET · total {money(ticketSummary(s).subtotal)} · saldo {money(ticketSummary(s).balance)}</div>}
                  {s.technicianId && team.find(p => p.id === s.technicianId) && <div className="sk-mono" style={{ fontSize: 10, color: "#4caf50", marginTop: 1 }}>🔧 {team.find(p => p.id === s.technicianId)?.name}</div>}
                  {s.deliveryStatus === "entregada" && deliveryDateLabel(s) && <div className="sk-mono" style={{ fontSize: 10, color: "#2e7d32", marginTop: 1 }}>🏠 Entregada: {deliveryDateLabel(s)}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <span style={{ background: "#4caf50", color: "#fff", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>✅ Lista para recoger</span>
                  <button className="action" style={{ fontSize: 11, padding: "3px 10px", background: "#fff", color: "#1b5e20", borderColor: "#4caf50", fontWeight: 700 }} onClick={() => copyLink(s)}>
                    {copied === s.id ? "✓ Copiado" : "🔗 Copiar link cliente"}
                  </button>
                  {canDeleteService && (
                    <button type="button" onClick={() => requestDeleteService(s)}
                      style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, border: "1.3px solid #c0392b", background: "transparent", color: "#c0392b", cursor: "pointer", fontFamily: "inherit" }}>
                      Eliminar
                    </button>
                  )}
                  {s.deliveryStatus === "entregada"
                    ? <span style={{ fontSize: 11, color: "#2e7d32", fontWeight: 600, textAlign: "right" as const }}>
                        🏠 Entregada
                        {deliveryDateLabel(s) && <span className="sk-mono" style={{ display: "block", fontSize: 9, marginTop: 2 }}>Fecha: {deliveryDateLabel(s)}</span>}
                        {s.deliverySignatureName && <span className="sk-mono" style={{ display: "block", fontSize: 9, marginTop: 2 }}>Firma conforme: {s.deliverySignatureName}</span>}
                      </span>
                    : <button onClick={() => requestDeliverySignature(s)}
                        style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, border: "1.3px solid #4caf50", background: "transparent", color: "#2e7d32", cursor: "pointer", fontFamily: "inherit" }}>
                        Marcar entregada
                      </button>
                  }
                  {canEditBillingForService(s) && (
                    <button className="action" style={{ fontSize: 11, padding: "3px 10px", background: "#fff", color: "#1b5e20", borderColor: "#4caf50", fontWeight: 700 }} onClick={() => {
                      if (!billingDraft[s.id]) setBillingDraft(p => ({ ...p, [s.id]: getBillingDraft(s) }));
                      setShowBilling(p => ({ ...p, [s.id]: !p[s.id] }));
                    }}>
                      {showBilling[s.id] ? "Cerrar factura" : "Editar factura"}
                    </button>
                  )}
                </div>
              </div>
              {(s.quotedParts || []).length > 0 && (
                <div style={{ marginTop: 10, background: "#fff", border: "1.2px solid #b7dfba", borderRadius: 9, padding: 10 }}>
                  <div className="sk-mono" style={{ fontSize: 9, color: "#2e7d32", letterSpacing: 1, marginBottom: 6 }}>
                    REPUESTOS DEL SERVICIO · MARCAR INSTALADOS
                  </div>
                  {(s.quotedParts || []).map(p => {
                    const baseUnit = p.originalUnitPrice ?? p.unitPrice;
                    const discount = clampDiscount(p.discountPercent);
                    const finalUnit = discount ? discountedUnitPrice({ unitPrice: baseUnit, originalUnitPrice: baseUnit, discountPercent: discount }) : p.unitPrice;
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 0", borderTop: "1px dashed #b7dfba", flexWrap: "wrap" as const }}>
                        {p.sku && <span className="sk-mono" style={{ fontSize: 10, background: "rgba(76,175,80,.10)", color: "#2e7d32", padding: "1px 6px", borderRadius: 4, flexShrink: 0 }}>{p.sku}</span>}
                        {p.loyverseItemId && <span style={{ fontSize: 10, color: "#5cc8e8", flexShrink: 0 }} title="Código Loyverse verificado">🔗</span>}
                        <span style={{ flex: 1, minWidth: 160 }}>{p.description}</span>
                        <span className="sk-mono" style={{ fontSize: 10, color: "#2e7d32", flexShrink: 0 }}>
                          ×{p.quantity}{p.unitPrice > 0 ? ` · ${discount ? `${discount}% · ` : ""}${money(p.quantity * finalUnit)}` : ""}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleQuotedPartInstalled(s, p)}
                          className={"action" + (p.installed ? " ink" : "")}
                          style={{ fontSize: 10, padding: "2px 8px", color: p.installed ? "#fff" : "#7a5500", borderColor: p.installed ? "#2e7d32" : "#e8a020", background: p.installed ? "#2e7d32" : "#fff9c4", flexShrink: 0 }}
                          title={p.installed ? "Quitar de instalados y de la factura final" : "Marcar instalado y agregar a factura final"}
                        >
                          {p.installed ? "Instalado" : "Marcar instalado"}
                        </button>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: 10, color: "#388e3c", marginTop: 5 }}>
                    Si se instaló después de cerrar el mantenimiento, márcalo aquí para que pase a la factura final.
                  </div>
                </div>
              )}
              {showBilling[s.id] && canEditBillingForService(s) && (() => {
                const draft = getBillingDraft(s);
                const fi: React.CSSProperties = { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1.2px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 11, fontFamily: "inherit", boxSizing: "border-box" as const };
                const la: React.CSSProperties = { fontSize: 10, fontFamily: "var(--mono)", color: "#2e7d32", letterSpacing: 1, textTransform: "uppercase" as const, display: "block", margin: "8px 0 4px" };
                const updateRow = (section: "parts" | "labor", idx: number, field: keyof BillingRow, val: string) =>
                  setBillingDraft(p => { const d = p[s.id] || getBillingDraft(s); const rows = [...d[section]]; rows[idx] = { ...rows[idx], [field]: val }; return { ...p, [s.id]: { ...d, [section]: rows } }; });
                const removeRow = (section: "parts" | "labor", idx: number) =>
                  setBillingDraft(p => { const d = p[s.id] || getBillingDraft(s); const rows = d[section].filter((_, i) => i !== idx); return { ...p, [s.id]: { ...d, [section]: rows.length ? rows : [emptyBillingRow()] } }; });
                const previewBill = calcBilling({ ...blankBilling(draft.paymentStatus, parseFloat(draft.advance || "0") || 0), parts: itemsFromRows(draft.parts, "repuesto"), labor: itemsFromRows(draft.labor, "mano_obra") });
                const renderRows = (section: "parts" | "labor") => (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {draft[section].map((row, idx) => {
                      const quotedPart = section === "parts" && row.id?.startsWith("quoted-") ? (s.quotedParts || []).find(part => `quoted-${part.id}` === row.id) : null;
                      const basePrice = parseFloat(row.unitPrice) || 0;
                      const discountPercent = clampDiscount(parseFloat(row.discountPercent));
                      const finalUnitPrice = discountPercent ? discountedUnitPrice({ unitPrice: basePrice, originalUnitPrice: basePrice, discountPercent }) : basePrice;
                      const rowTotal = (parseFloat(row.quantity) || 0) * finalUnitPrice;
                      return (
                        <div key={idx} style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) 42px 76px 50px 22px", gap: 4, alignItems: "center" }}>
                          <div>
                            <input style={fi} value={row.description} onChange={e => updateRow(section, idx, "description", e.target.value)} placeholder="Descripción" />
                            {quotedPart && <span className="sk-mono" style={{ fontSize: 8.5, color: quotedPart.installed ? "#2e7d32" : "#9a6a00" }}>{quotedPart.installed ? "Instalado en taller" : "Pendiente taller"}</span>}
                            <span className="sk-mono" style={{ display: "block", fontSize: 8.5, color: rowTotal > 0 ? "#2e7d32" : "var(--ink-3)" }}>Total línea: {money(rowTotal)}</span>
                          </div>
                          <input style={{ ...fi, textAlign: "center" as const }} type="number" min="1" value={row.quantity} onChange={e => updateRow(section, idx, "quantity", e.target.value)} />
                          <input style={{ ...fi, textAlign: "right" as const, background: "#eef7ee", color: "#607d60" }} type="number" min="0" value={row.unitPrice} readOnly title="Precio tomado de Loyverse. Ajusta solo con descuento." />
                          <input style={{ ...fi, textAlign: "right" as const }} type="number" min="0" max="100" value={row.discountPercent} onChange={e => updateRow(section, idx, "discountPercent", e.target.value)} placeholder="%" />
                          <button onClick={() => removeRow(section, idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#388e3c", fontSize: 14, padding: 0 }}>×</button>
                        </div>
                      );
                    })}
                  </div>
                );
                const renderReadyLoyverseAdder = (kind: "parts" | "labor") => {
                  const state = kind === "parts" ? billingPartAdd : billingServiceAdd;
                  const setter = kind === "parts" ? setBillingPartAdd : setBillingServiceAdd;
                  const row = state[s.id] || emptyQA();
                  const lookup = kind === "parts" ? handleBillingPartLookup : handleBillingServiceLookup;
                  const add = kind === "parts" ? addBillingPartFromLoyverse : addBillingServiceFromLoyverse;
                  const basePrice = parseFloat(row.unitPrice) || 0;
                  const discountPercent = clampDiscount(parseFloat(row.discountPercent || ""));
                  const finalUnitPrice = discountPercent ? discountedUnitPrice({ unitPrice: basePrice, originalUnitPrice: basePrice, discountPercent }) : basePrice;
                  return (
                    <div style={{ background: "#f8fff8", border: "1px solid #b7dfba", borderRadius: 7, padding: 8, marginBottom: 8 }}>
                      <div className="sk-mono" style={{ fontSize: 9, color: "#2e7d32", letterSpacing: 1, marginBottom: 5 }}>{kind === "parts" ? "AGREGAR REPUESTO DESDE LOYVERSE" : "AGREGAR SERVICIO DESDE LOYVERSE"}</div>
                      {!loyverseToken && <div style={{ fontSize: 10, color: "#9a6a00", marginBottom: 5 }}>Configura el token de Loyverse para buscar y vincular este cobro.</div>}
                      <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap" as const }}>
                        <input style={{ ...fi, width: 88, borderColor: row.found === true ? "#5cc8e8" : row.found === false ? "#c0392b" : "var(--line)" }} value={row.sku} onChange={e => setter(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), sku: e.target.value, found: null, loyverseItemId: undefined, loyverseVariantId: undefined } }))} onKeyDown={e => { if (e.key === "Enter") lookup(s.id, row.sku); }} placeholder="Código" />
                        {loyverseToken && row.sku.trim() && !row.looking && <button className="action" style={{ fontSize: 10, padding: "3px 8px" }} onClick={() => lookup(s.id, row.sku)}>Buscar</button>}
                        {row.looking && <span className="sk-mono" style={{ fontSize: 10, color: "#2e7d32" }}>buscando...</span>}
                        <input style={{ ...fi, flex: 1, minWidth: 120 }} value={row.description} readOnly placeholder={kind === "parts" ? "Repuesto desde Loyverse" : "Servicio desde Loyverse"} />
                        <input style={{ ...fi, width: 42, textAlign: "center" as const }} type="number" min="1" value={row.quantity} onChange={e => setter(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), quantity: e.target.value } }))} />
                        <input style={{ ...fi, width: 74, textAlign: "right" as const, background: "#eef7ee", color: "#607d60" }} type="number" min="0" value={row.unitPrice} readOnly title="Precio tomado de Loyverse. Ajusta solo con descuento." />
                        <input style={{ ...fi, width: 50, textAlign: "right" as const }} type="number" min="0" max="100" value={row.discountPercent || ""} onChange={e => setter(p => ({ ...p, [s.id]: { ...(p[s.id] || emptyQA()), discountPercent: e.target.value } }))} placeholder="%" />
                        <button className="action ink" style={{ fontSize: 10 }} onClick={() => add(s)} disabled={row.looking || !row.sku.trim()}>+ Agregar</button>
                      </div>
                      {row.found === true && <div style={{ fontSize: 10, color: "#2e7d32", marginTop: 4 }}>Encontrado en Loyverse · se agregará vinculado · {money(finalUnitPrice)} c/u</div>}
                      {row.found === false && <div style={{ fontSize: 10, color: "#c0392b", marginTop: 4 }}>No existe en Loyverse. Créalo o revisa el código.</div>}
                    </div>
                  );
                };
                return (
                  <div style={{ marginTop: 12, background: "#fff", border: "1.4px dashed #4caf50", borderRadius: 10, padding: 12 }}>
                    <label style={la}>Productos / repuestos</label>
                    {renderReadyLoyverseAdder("parts")}
                    {renderRows("parts")}
                    <label style={la}>Servicio / mano de obra</label>
                    {renderReadyLoyverseAdder("labor")}
                    {renderRows("labor")}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                      <div><label style={la}>Abono</label><input style={fi} type="number" min="0" value={draft.advance} onChange={e => setBillingDraft(p => ({ ...p, [s.id]: { ...draft, advance: e.target.value } }))} /></div>
                      <div><label style={la}>Pago</label><select style={fi} value={draft.paymentStatus} onChange={e => setBillingDraft(p => ({ ...p, [s.id]: { ...draft, paymentStatus: e.target.value as ServiceBilling["paymentStatus"] } }))}><option value="pendiente">Pendiente</option><option value="adelanto">Adelanto</option><option value="pagado">Pagado</option></select></div>
                    </div>
                    <label style={la}>Observaciones</label>
                    <textarea rows={2} style={{ ...fi, resize: "vertical" as const }} value={draft.notes} onChange={e => setBillingDraft(p => ({ ...p, [s.id]: { ...draft, notes: e.target.value } }))} />
                    <div className="sk-mono" style={{ fontSize: 10, margin: "8px 0", color: "#2e7d32" }}>Total {money(previewBill.subtotal)} · Abono {money(previewBill.advance)} · Saldo {money(previewBill.balance)}</div>
                    <button className="action ink" style={{ fontSize: 12 }} onClick={() => saveBilling(s)}>Guardar factura</button>
                  </div>
                );
              })()}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Modal asignar tarea ──────────────────────────────────────────────────────
function MembershipSection({ memberships, onAdd, onUse, onCancel }: {
  memberships: Membership[];
  onAdd: (m: Membership) => void;
  onUse: (id: string, note: string) => void;
  onCancel: (id: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const today = _fmtDate(new Date());
  const statusOf = (m: Membership) => {
    if (m.usedUses >= m.includedUses) return { label: "Sin cupos", color: "#c0392b", bg: "rgba(192,57,43,.08)" };
    if (m.endDate < today) return { label: "Vencida", color: "#8a6d00", bg: "#fff9c4" };
    const daysLeft = Math.ceil((new Date(m.endDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
    if (daysLeft <= 5) return { label: `Por vencer · ${daysLeft}d`, color: "#e8a020", bg: "rgba(232,160,32,.12)" };
    return { label: "Activa", color: "#2e7d32", bg: "rgba(76,175,80,.10)" };
  };
  const active = memberships.filter(m => m.endDate >= today && m.usedUses < m.includedUses);
  const income = memberships.reduce((sum, m) => sum + (m.price || 0), 0);

  return (
    <div className="service-section" style={{ padding: "16px 16px", maxWidth: 920, margin: "0 auto", width: "100%", boxSizing: "border-box" as const }}>
      <div className="row between" style={{ marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <div className="sk-title text-2xl">Mensualidades</div>
          <div className="sk-mono text-xs muted">{active.length} activas · ${income.toLocaleString("es-CO")} registrados</div>
        </div>
        <button className="action ink" onClick={() => setShowNew(true)}><Icon d={I.plus} size={14} /> Nueva mensualidad</button>
      </div>

      <div className="dash-kanban-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        <div className="sk-box p-4"><div className="sk-mono text-xs tracked muted">ACTIVAS</div><div className="sk-title text-3xl">{active.length}</div></div>
        <div className="sk-box p-4"><div className="sk-mono text-xs tracked muted">USOS DISPONIBLES</div><div className="sk-title text-3xl">{memberships.reduce((s, m) => s + Math.max(0, m.includedUses - m.usedUses), 0)}</div></div>
        <div className="sk-box p-4"><div className="sk-mono text-xs tracked muted">VENTAS</div><div className="sk-title text-3xl">${income.toLocaleString("es-CO")}</div></div>
      </div>

      {memberships.length === 0 ? (
        <div className="placeholder" style={{ borderRadius: 12, padding: 48, textAlign: "center" }}>
          No hay mensualidades. Vende el plan en Loyverse y regístralo aquí para controlar cupos y vencimiento.
        </div>
      ) : (
        <div className="stack gap-3">
          {memberships.map(m => {
            const st = statusOf(m);
            const left = Math.max(0, m.includedUses - m.usedUses);
            return (
              <div key={m.id} className="sk-box p-4" style={{ borderColor: st.color }}>
                <div className="row between" style={{ alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                      <div className="sk-title text-xl">{m.clientName}</div>
                      <span className="chip" style={{ color: st.color, background: st.bg, borderColor: st.color }}>{st.label}</span>
                    </div>
                    <div className="text-sm sub">{m.planName} · ${m.price.toLocaleString("es-CO")}</div>
                    <div className="sk-mono text-xs muted">{m.startDate} → {m.endDate}{m.clientPhone ? ` · ${m.clientPhone}` : ""}</div>
                    {m.loyverseReceipt && <div className="sk-mono text-xs muted">Loyverse: {m.loyverseReceipt}</div>}
                  </div>
                  <div className="stack" style={{ alignItems: "flex-end", gap: 6 }}>
                    <div className="sk-title text-2xl">{left}/{m.includedUses}</div>
                    <div className="sk-mono text-xs muted">cupos disponibles</div>
                    <button className="action accent" disabled={left <= 0 || m.endDate < today} onClick={() => onUse(m.id, "Lavado registrado")}>Registrar uso</button>
                  </div>
                </div>
                <div className="prog-bar" style={{ marginTop: 12 }}><div className="prog-bar-fill" style={{ width: `${Math.min(100, (m.usedUses / Math.max(1, m.includedUses)) * 100)}%` }} /></div>
                {m.notes && <div className="text-sm sub" style={{ marginTop: 8 }}>{m.notes}</div>}
                {m.uses.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div className="sk-mono text-xs tracked muted">USOS</div>
                    {m.uses.slice(0, 4).map(u => <div key={u.id} className="list-row"><span>{u.note}</span><span className="sk-mono text-xs muted">{u.date}</span></div>)}
                  </div>
                )}
                <div className="row" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                  <button className="action" onClick={() => onCancel(m.id)}>Cerrar plan</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <MembershipModal onClose={() => setShowNew(false)} onAdd={m => { onAdd(m); setShowNew(false); }} />}
    </div>
  );
}

function MembershipModal({ onClose, onAdd }: { onClose: () => void; onAdd: (m: Membership) => void }) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [planName, setPlanName] = useState("Lavado mensual");
  const [price, setPrice] = useState("100000");
  const [startDate, setStartDate] = useState(_fmtDate(new Date()));
  const [durationDays, setDurationDays] = useState("30");
  const [includedUses, setIncludedUses] = useState("10");
  const [loyverseReceipt, setLoyverseReceipt] = useState("");
  const [notes, setNotes] = useState("");
  const endDate = _addDaysTo(startDate, Math.max(1, Number(durationDays) || 30) - 1);
  const canAdd = clientName.trim() && Number(price) > 0 && Number(includedUses) > 0;
  const submit = () => {
    if (!canAdd) return;
    onAdd({
      id: Date.now().toString(36),
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      planName: planName.trim() || "Mensualidad",
      price: Number(price) || 0,
      startDate,
      endDate,
      includedUses: Number(includedUses) || 1,
      usedUses: 0,
      notes,
      loyverseReceipt: loyverseReceipt.trim(),
      createdAt: new Date().toISOString(),
      uses: [],
    });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="row between" style={{ marginBottom: 16 }}>
          <div>
            <div className="sk-title text-xl">Nueva mensualidad</div>
            <div className="sk-mono text-xs muted">Cobro en Loyverse + control de cupos aquí</div>
          </div>
          <span className="serv-tag">PLAN</span>
        </div>
        <div className="field-group"><div className="field-label">Cliente *</div><input className="field-input" value={clientName} onChange={e => setClientName(e.target.value)} autoFocus /></div>
        <div className="field-group"><div className="field-label">Teléfono</div><input className="field-input" value={clientPhone} onChange={e => setClientPhone(e.target.value)} /></div>
        <div className="field-group"><div className="field-label">Plan</div><input className="field-input" value={planName} onChange={e => setPlanName(e.target.value)} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field-group"><div className="field-label">Precio</div><input className="field-input" type="number" value={price} onChange={e => setPrice(e.target.value)} /></div>
          <div className="field-group"><div className="field-label">Cupos</div><input className="field-input" type="number" value={includedUses} onChange={e => setIncludedUses(e.target.value)} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field-group"><div className="field-label">Inicio</div><input className="field-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div className="field-group"><div className="field-label">Duración días</div><input className="field-input" type="number" value={durationDays} onChange={e => setDurationDays(e.target.value)} /></div>
        </div>
        <div className="sk-mono text-xs muted" style={{ marginBottom: 12 }}>Vence: {endDate}</div>
        <div className="field-group"><div className="field-label">Recibo Loyverse</div><input className="field-input" value={loyverseReceipt} onChange={e => setLoyverseReceipt(e.target.value)} placeholder="Opcional" /></div>
        <div className="field-group"><div className="field-label">Notas</div><textarea className="field-input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        <div className="row gap-3" style={{ marginTop: 16 }}>
          <button className="action" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button className="action ink" onClick={submit} style={{ flex: 2 }} disabled={!canAdd}>Crear mensualidad</button>
        </div>
      </div>
    </div>
  );
}

function AssignTaskModal({ team, initialDate, onAdd, onClose }: { team: any[]; initialDate?: string; onAdd: (t: AppTask) => void; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState(team[0]?.id || "");
  const [tag, setTag] = useState("GENERAL");
  const [date, setDate] = useState(initialDate || _addDays(0));
  const [dueDate, setDueDate] = useState(initialDate || _addDays(0));
  const [priority, setPriority] = useState<"baja" | "media" | "alta">("media");
  const [points, setPoints] = useState("1");
  const [evidence, setEvidence] = useState("");
  const [hasTime, setHasTime] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const tags = ["GENERAL", "TALLER", "TIENDA", "LIMPIEZA", "CAJA", "PEDIDO"];
  const handleAdd = () => {
    if (!title.trim() || !assignedTo) return;
    onAdd({ id: Date.now().toString(36), title: title.trim(), description: description.trim(), assignedTo, tag, done: false, createdAt: new Date().toISOString(), date, dueDate, priority, points: Math.max(1, Number(points) || 1), evidence: evidence.trim(), qualityStatus: "pendiente", hasTime, startTime: hasTime ? startTime : "", endTime: hasTime ? endTime : "" });
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
          <div className="field-label">Título *</div>
          <input className="field-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Revisar frenos bici #108" autoFocus />
        </div>
        <div className="field-group">
          <div className="field-label">Descripción</div>
          <textarea className="field-input" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalles, instrucciones, enlaces o contexto para hacerla bien..." />
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <div className="field-group">
            <div className="field-label">Fecha límite</div>
            <input className="field-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
          <div className="field-group">
            <div className="field-label">Prioridad</div>
            <select className="field-input" value={priority} onChange={e => setPriority(e.target.value as any)}>
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
            </select>
          </div>
          <div className="field-group">
            <div className="field-label">Puntos</div>
            <input className="field-input" type="number" min="1" value={points} onChange={e => setPoints(e.target.value)} />
          </div>
        </div>
        <div className="field-group">
          <div className="field-label">Evidencia esperada / enlace</div>
          <input className="field-input" value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="Comentario, foto, link o nota opcional" />
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
  const workshopTeam = useMemo(() => workshopResponsibles(team), [team]);
  const [client, setClient] = useState("");
  const [service, setService] = useState("");
  const [assignedTo, setAssignedTo] = useState(workshopTeam[0]?.id || "");
  const [date, setDate] = useState(initialDate || _addDays(0));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:30");
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (!assignedTo && workshopTeam.length > 0) setAssignedTo(workshopTeam[0].id);
    if (assignedTo && !workshopTeam.some(m => m.id === assignedTo)) setAssignedTo("");
  }, [assignedTo, workshopTeam]);
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
              <option value="">Sin asignar</option>
              {workshopTeam.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
            </select>
            {workshopTeam.length === 0 && <div className="sk-mono text-xs muted" style={{ marginTop: 4 }}>Configura responsables de taller en Perfil.</div>}
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

function EditAppointmentModal({ appt, team, onClose, onSave, onDelete }: {
  appt: Appointment;
  team: any[];
  onClose: () => void;
  onSave: (id: string, changes: Partial<Appointment>) => void;
  onDelete: (id: string) => void;
}) {
  const workshopTeam = useMemo(() => {
    const filtered = workshopResponsibles(team);
    const current = team.find(m => m.id === appt.assignedTo);
    return current && !filtered.some(m => m.id === current.id) ? [current, ...filtered] : filtered;
  }, [team, appt.assignedTo]);
  const [client, setClient] = useState(appt.client);
  const [service, setService] = useState(appt.service);
  const [assignedTo, setAssignedTo] = useState(appt.assignedTo);
  const [date, setDate] = useState(appt.date);
  const [startTime, setStartTime] = useState(appt.startTime);
  const [endTime, setEndTime] = useState(appt.endTime);
  const [notes, setNotes] = useState(appt.notes || "");

  const handleSave = () => {
    if (!client.trim() || !service) return;
    onSave(appt.id, { client: client.trim(), service, assignedTo, date, startTime, endTime, notes });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <div className="row between" style={{ marginBottom: 16 }}>
          <div className="sk-title text-xl">Editar agendamiento</div>
          <span className="serv-tag">SERVICIO CLIENTE</span>
        </div>
        <div className="field-group">
          <div className="field-label">Nombre del cliente *</div>
          <input className="field-input" value={client} onChange={e => setClient(e.target.value)} autoFocus />
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
              <option value="">Sin asignar</option>
              {workshopTeam.map(m => <option key={m.id} value={m.id}>{m.name} · {m.role}</option>)}
            </select>
            {workshopTeam.length === 0 && <div className="sk-mono text-xs muted" style={{ marginTop: 4 }}>Configura responsables de taller en Perfil.</div>}
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
          <button className="action" style={{ color: "#c0392b", borderColor: "#c0392b" }}
            onClick={() => { if (window.confirm("¿Eliminar este agendamiento?")) onDelete(appt.id); }}>
            Eliminar
          </button>
          <button className="action" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button className="action ink" onClick={handleSave} style={{ flex: 2 }} disabled={!client.trim() || !service}>
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard del colaborador ────────────────────────────────────────────────
function ChangeEmployeePinModal({ currentPin = "", onClose, onSave, isPinAvailable = () => true }: { currentPin?: string; onClose: () => void; onSave: (newPin: string) => void; isPinAvailable?: (pin: string) => boolean }) {
  const [currentOne, setCurrentOne] = useState("");
  const [currentTwo, setCurrentTwo] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmNewPin, setConfirmNewPin] = useState("");
  const [msg, setMsg] = useState("");
  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.3px solid var(--line)", background: "var(--paper)", color: "var(--ink)", fontSize: 13, boxSizing: "border-box", fontFamily: "inherit", marginBottom: 8 };
  const submit = () => {
    if (!currentPin) { setMsg("Aún no tienes PIN configurado. Pídele a admin que lo cree primero."); return; }
    if (currentOne !== currentPin || currentTwo !== currentPin) { setMsg("La contraseña actual no coincide en ambas confirmaciones."); return; }
    if (newPin.length < 4) { setMsg("La nueva contraseña debe tener al menos 4 caracteres."); return; }
    if (newPin !== confirmNewPin) { setMsg("La nueva contraseña y su confirmación no coinciden."); return; }
    if (newPin === currentPin) { setMsg("La nueva contraseña debe ser diferente a la actual."); return; }
    if (!isPinAvailable(newPin)) { setMsg("Esa contraseña ya la usa otra persona del equipo. Elige una diferente."); return; }
    onSave(newPin);
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div className="sk-box p-5" style={{ width: "100%", maxWidth: 380, background: "var(--paper)" }}>
        <div className="sk-title text-xl" style={{ marginBottom: 4 }}>Cambiar contraseña</div>
        <div className="sk-mono text-xs muted" style={{ marginBottom: 14 }}>Confirma la actual dos veces y escribe la nueva.</div>
        <input style={inp} type="password" value={currentOne} onChange={e => setCurrentOne(e.target.value)} placeholder="Contraseña actual" autoFocus />
        <input style={inp} type="password" value={currentTwo} onChange={e => setCurrentTwo(e.target.value)} placeholder="Confirmar actual otra vez" />
        <input style={inp} type="password" value={newPin} onChange={e => setNewPin(e.target.value)} placeholder="Nueva contraseña" />
        <input style={inp} type="password" value={confirmNewPin} onChange={e => setConfirmNewPin(e.target.value)} placeholder="Confirmar nueva contraseña" onKeyDown={e => { if (e.key === "Enter") submit(); }} />
        {msg && <div className="sk-mono text-xs" style={{ color: "#c0392b", marginBottom: 10 }}>{msg}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="action" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="action ink" style={{ flex: 1 }} onClick={submit}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

function ServiceCatalogAccordion({ onSelect }: { onSelect: (selectedService: string) => void }) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    [SERVICES_CATALOG[0]?.category || ""]: true,
  }));
  const toggleGroup = (category: string) => setOpenGroups(p => ({ ...p, [category]: !p[category] }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {SERVICES_CATALOG.map(g => {
        const open = !!openGroups[g.category];
        return (
          <div key={g.category} style={{ border: "1.3px solid var(--line)", borderRadius: 10, background: "var(--paper-2)", overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => toggleGroup(g.category)}
              aria-expanded={open}
              style={{ width: "100%", border: "none", background: "transparent", color: "var(--ink)", cursor: "pointer", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontFamily: "inherit", textAlign: "left" as const }}
            >
              <span>
                <span style={{ display: "block", fontSize: 12, fontWeight: 800 }}>{g.category}</span>
                <span className="sk-mono" style={{ display: "block", fontSize: 9, color: "var(--ink-3)", marginTop: 2 }}>{g.items.length} servicios</span>
              </span>
              <span style={{ fontSize: 16, color: "var(--accent)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .16s ease", lineHeight: 1 }}>⌄</span>
            </button>
            {open && (
              <div style={{ padding: "0 10px 10px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 6 }}>
                {g.items.map(item => {
                  const selectedService = `${item.code} - ${item.name}`;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      className="maint-card"
                      onClick={() => onSelect(selectedService)}
                      style={{ padding: "10px 12px", textAlign: "left" as const, width: "100%" }}
                    >
                      <div className="serv-tag" style={{ marginBottom: 4, fontSize: 9 }}>{item.code}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "#6c1f6e", marginTop: 3, fontWeight: 700 }}>${item.price.toLocaleString("es-CO")}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmployeeServicesList({ services, session, perms, onAdvancePhase, onUpdateService, onNewService }: {
  services: BikeService[];
  session: Session;
  perms: any;
  onAdvancePhase: (id: string) => void;
  onUpdateService?: (id: string, changes: Partial<BikeService>) => void;
  onNewService: () => void;
}) {
  const [query, setQuery] = useState("");
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const q = normalizeLookup(query);
  const filtered = services
    .filter(s => {
      if (!q) return true;
      return normalizeLookup([
        s.clientName,
        s.clientDocument,
        s.clientPhone,
        s.bikeDescription,
        s.serviceType,
        s.intakeReportedIssue,
        serviceStatusLabel(s),
        s.date,
        s.scheduledDate,
      ].filter(Boolean).join(" ")).includes(q);
    })
    .sort((a, b) => {
      const ad = a.scheduledDate || a.date;
      const bd = b.scheduledDate || b.date;
      if ((a.phase < 4) !== (b.phase < 4)) return a.phase < 4 ? -1 : 1;
      return bd.localeCompare(ad);
    });
  const toggle = (id: string) => setOpenRows(p => ({ ...p, [id]: !p[id] }));
  const phName = (p: number) => p === 0 ? "Recibida" : PHASES.find(ph => ph.id === p)?.name || "";
  const phColor = (p: number) => PHASES.find(ph => ph.id === p)?.color || "#888";

  return (
    <div style={{ padding: "16px 16px 80px", maxWidth: 720, margin: "0 auto", width: "100%", boxSizing: "border-box" as const }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" as const }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Servicios</div>
          <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>{filtered.length} de {services.length} servicios</div>
        </div>
        {perms.canRegisterBikes && <button className="action ink" style={{ fontSize: 12 }} onClick={onNewService}>+ Registrar bici</button>}
      </div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar por cliente, cédula, bici, servicio, estado..."
        style={{ width: "100%", boxSizing: "border-box" as const, padding: "10px 12px", borderRadius: 10, border: "1.4px solid var(--line)", background: "var(--paper-2)", color: "var(--ink)", fontFamily: "inherit", fontSize: 13, marginBottom: 12 }}
      />
      {filtered.length === 0 ? (
        <div className="placeholder" style={{ borderRadius: 10, padding: 28, textAlign: "center", fontSize: 13 }}>No encontré servicios con esa búsqueda.</div>
      ) : filtered.map(s => {
        const open = !!openRows[s.id];
        const nextPhase = PHASES.find(ph => ph.id === s.phase + 1);
        const summary = ticketSummary(s);
        return (
          <div key={s.id} style={{ background: "var(--paper-2)", border: `1.4px solid ${s.phase >= 4 ? "#4caf50" : "var(--line)"}`, borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
            <button type="button" onClick={() => toggle(s.id)} style={{ width: "100%", border: "none", background: "transparent", color: "var(--ink)", cursor: "pointer", padding: 12, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, fontFamily: "inherit", textAlign: "left" as const }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 700, fontSize: 14 }}>{s.clientName}</span>
                <span style={{ display: "block", color: "var(--ink-3)", fontSize: 12, marginTop: 2 }}>{s.bikeDescription}</span>
                <span className="sk-mono" style={{ display: "block", color: phColor(s.phase), fontSize: 10, marginTop: 4 }}>{serviceStatusLabel(s)}{s.scheduledDate || s.date ? ` · ${s.scheduledDate || s.date}` : ""}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {summary.subtotal > 0 && <span className="sk-mono" style={{ color: "#2e7d32", fontSize: 10 }}>{money(summary.subtotal)}</span>}
                <span style={{ color: "var(--accent)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .16s ease" }}>⌄</span>
              </span>
            </button>
            {open && (
              <div style={{ padding: "0 12px 12px", borderTop: "1px solid var(--line)" }}>
                <div style={{ display: "flex", gap: 4, marginTop: 10, marginBottom: 8 }}>
                  {PHASES.map(ph => <div key={ph.id} style={{ flex: 1, height: 5, borderRadius: 3, background: s.phase >= ph.id ? ph.color : "var(--line)" }} />)}
                </div>
                {s.serviceType && <div style={{ fontSize: 12, color: "#6c1f6e", marginBottom: 4 }}>🛠 {s.serviceType}</div>}
                {(s.clientPhone || s.clientDocument) && <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 4 }}>{s.clientPhone || ""}{s.clientPhone && s.clientDocument ? " · " : ""}{s.clientDocument || ""}</div>}
                {s.intakeReportedIssue && <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>Motivo: {s.intakeReportedIssue}</div>}
                <div style={{ fontSize: 11, color: s.paymentStatus === "pagado" ? "#2e7d32" : s.paymentStatus === "adelanto" ? "#6c1f6e" : "var(--ink-3)", marginBottom: 6 }}>
                  {s.paymentStatus === "pagado" ? "✅ Pagado" : s.paymentStatus === "adelanto" ? `📤 Abono: $${(s.paymentAmount || 0).toLocaleString()}` : "💰 Pago pendiente"}
                </div>
                {summary.subtotal > 0 && <div className="sk-mono" style={{ fontSize: 10, color: "#2e7d32", marginBottom: 6 }}>Ticket {money(summary.subtotal)} · saldo {money(summary.balance)}</div>}
                <ServiceProcessChecklist service={s} editable={!!perms.canModifyServices} session={session} onChange={(items) => onUpdateService?.(s.id, { processChecklist: items, processChecklistUpdatedAt: new Date().toISOString() })} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8 }}>
                  <div style={{ fontSize: 12, color: phColor(s.phase), fontWeight: 700 }}>{s.phase === 0 ? "📋 Recibida" : `${PHASES.find(ph => ph.id === s.phase)?.icon} ${phName(s.phase)}`}</div>
                  {nextPhase && perms.canModifyServices && (
                    <button onClick={() => onAdvancePhase(s.id)} style={{ fontSize: 12, padding: "5px 12px", borderRadius: 999, background: nextPhase.color, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                      {nextPhase.icon} → {nextPhase.name}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmployeeDashboard({ session, team, shift, setShift, tasks, onToggleTask, appointments, onNewAppointment, services, onNewService, onAdvancePhase, onLogout, extendedData = {}, onChangePin = () => {}, setTasks, setAppointments, onNewBikeService, empLunch = {}, setEmpLunch, onUpdateService, loyverseToken = "", onStartAttendance, onCloseAttendance, onStartLunch, onEndLunch, attendanceRecords = [], lunchRecords = [], payrollConfirmations = [] }: {
  session: Session; team: any[]; shift: any; setShift: any;
  tasks: AppTask[]; onToggleTask: (id: string) => void;
  appointments: Appointment[]; onNewAppointment: () => void;
  services: BikeService[]; onNewService: (serviceType?: string) => void; onAdvancePhase: (id: string) => void; onLogout: () => void;
  extendedData?: any;
  onChangePin?: (id: string, newPin: string) => void;
  setTasks?: (fn: (prev: AppTask[]) => AppTask[]) => void;
  setAppointments?: (fn: (prev: Appointment[]) => Appointment[]) => void;
  onNewBikeService?: (date: string) => void;
  empLunch?: Record<string, boolean>;
  setEmpLunch?: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void;
  onUpdateService?: (id: string, changes: Partial<BikeService>) => void;
  loyverseToken?: string;
  onStartAttendance?: (member: any) => void;
  onCloseAttendance?: (member: any) => void;
  onStartLunch?: (member: any) => void;
  onEndLunch?: (member: any) => void;
  attendanceRecords?: AttendanceRecord[];
  lunchRecords?: LunchRecord[];
  payrollConfirmations?: PayrollConfirmation[];
}) {
  const me = team.find(m => m.id === session.id) || { name: session.name, role: session.role, initials: (session.name || "?")[0], id: session.id };
  const todayStr = _fmtDate(new Date());
  const myTasks = tasks.filter(t => t.assignedTo === session.id);
  const myTodayTasks = myTasks.filter(t => !t.done && (!t.date || t.date === todayStr));
  const myTodayAppts = appointments.filter(a => a.assignedTo === session.id && a.date === todayStr);
  const myTodayBikes = services.filter(s => s.technicianId === session.id && (s.scheduledDate || s.date) === todayStr && s.phase < 4);
  const myUpcomingAppts = appointments.filter(a => a.assignedTo === session.id && a.date > todayStr)
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const myUpcomingBikes = services.filter(s => s.technicianId === session.id && (s.scheduledDate || s.date) > todayStr && s.phase < 4)
    .sort((a, b) => (a.scheduledDate || a.date).localeCompare(b.scheduledDate || b.date)).slice(0, 3);
  const isIn = !!shift[session.id!];
  const isLunch = !!empLunch?.[session.id!];
  const extData = (extendedData as any)[session.id!] || {};
  const perms = { ...DEFAULT_PERMISSIONS, ...(extData.permissions || {}) };
  const phName = (p: number) => p === 0 ? "Recibida" : PHASES.find(ph => ph.id === p)?.name || "";
  const phColor = (p: number) => PHASES.find(ph => ph.id === p)?.color || "#888";
  const [tab, setTab] = useState<"inicio" | "calendario" | "servicios">("inicio");
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedCatalogService, setSelectedCatalogService] = useState("");
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);
  const shiftEntry = shift[session.id!];
  const elapsedSecs = (shiftEntry && typeof shiftEntry === "string") ? Math.floor((Date.now() - new Date(shiftEntry).getTime()) / 1000) : 0;
  const elapsedStr = elapsedSecs > 0 ? `${Math.floor(elapsedSecs / 3600)}h ${String(Math.floor((elapsedSecs % 3600) / 60)).padStart(2, "0")}m` : "";
  const entryTimeStr = (shiftEntry && typeof shiftEntry === "string") ? new Date(shiftEntry).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  const openLunchRecord = lunchRecords.find(r => r.employeeId === session.id && r.status === "abierto");
  const lunchElapsedSecs = openLunchRecord ? Math.max(0, Math.floor((Date.now() - new Date(openLunchRecord.startTime).getTime()) / 1000)) : 0;
  const lunchElapsedStr = lunchElapsedSecs > 0 ? `${Math.floor(lunchElapsedSecs / 3600)}h ${String(Math.floor((lunchElapsedSecs % 3600) / 60)).padStart(2, "0")}m` : "0h 00m";
  const lunchStartStr = openLunchRecord ? new Date(openLunchRecord.startTime).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  const payrollMonth = todayStr.slice(0, 7);
  const myMonthAttendance = attendanceRecords.filter(r => r.employeeId === session.id && r.date.startsWith(payrollMonth));
  const myMonthLunchRecords = lunchRecords.filter(r => r.employeeId === session.id && r.date.startsWith(payrollMonth));
  const myMonthLunchMinutes = myMonthLunchRecords.reduce((sum, r) => sum + (Number(r.minutes) || (r.status === "abierto" ? minutesBetween(r.startTime, new Date().toISOString()) : 0)), 0);
  const myMonthGrossHours = myMonthAttendance.reduce((sum, r) => sum + (r.status === "abierto" ? hoursBetween(r.entryTime, new Date().toISOString()) : (Number(r.hoursWorked) || 0)), 0);
  const myMonthHours = Math.max(0, Math.round((myMonthGrossHours - (myMonthLunchMinutes / 60)) * 100) / 100);
  const myPayrollConfirmations = payrollConfirmations
    .filter(c => c.employeeId === session.id)
    .sort((a, b) => `${b.month}-${b.period}`.localeCompare(`${a.month}-${a.period}`));
  const myCurrentPayroll = myPayrollConfirmations.filter(c => c.month === payrollMonth);
  const myPayrollMonthLabel = `${MONTH_NAMES_ES[Number(payrollMonth.slice(5, 7)) - 1]} ${payrollMonth.slice(0, 4)}`;
  const myPayrollCutDetails = (["q1", "q2"] as PayrollPeriod[]).map(period => {
    const range = payrollPeriodRange(payrollMonth, period);
    const attendance = myMonthAttendance.filter(r => r.date >= range.fromDate && r.date <= range.toDate);
    const lunches = myMonthLunchRecords.filter(r => r.date >= range.fromDate && r.date <= range.toDate);
    const grossHours = attendance.reduce((sum, r) => sum + (r.status === "abierto" ? hoursBetween(r.entryTime, new Date().toISOString()) : (Number(r.hoursWorked) || 0)), 0);
    const lunchMinutes = lunches.reduce((sum, r) => sum + (Number(r.minutes) || (r.status === "abierto" ? minutesBetween(r.startTime, new Date().toISOString()) : 0)), 0);
    const hours = Math.max(0, Math.round((grossHours - (lunchMinutes / 60)) * 100) / 100);
    const confirmation = myCurrentPayroll.find(c => c.period === period);
    return { period, label: payrollPeriodLabel(period), ...range, hours, lunchMinutes, confirmation };
  });

  return (
    <div style={{ height: "100dvh", minHeight: "100vh", background: "var(--paper)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{CSS}</style>
      {/* Header */}
      <div className="employee-header">
        <div className="employee-header-left">
          <Logo height={28} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{me.name}</div>
            <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{me.role}</div>
          </div>
        </div>
        <div className="employee-header-actions">
          <button className="action" style={{ fontSize: 12 }} onClick={() => setShowPinModal(true)}>Cambiar clave</button>
          <button className="action" style={{ fontSize: 12 }} onClick={onLogout}>Salir</button>
        </div>
      </div>
      {showPinModal && <ChangeEmployeePinModal currentPin={extData.pin || ""} onClose={() => setShowPinModal(false)} onSave={(newPin) => onChangePin(session.id!, newPin)} isPinAvailable={(pin) => !team.some((member: any) => member.id !== session.id && (extendedData as any)[member.id]?.pin && (extendedData as any)[member.id].pin === pin)} />}

      {/* Pestañas */}
      <div className="employee-tabs">
        {([
          { id: "inicio", label: "🏠 Inicio" },
          ...(perms.canViewServices ? [{ id: "servicios", label: "🚲 Servicios" }] : []),
          { id: "calendario", label: "📅 Calendario" },
        ] as { id: "inicio" | "servicios" | "calendario"; label: string }[]).map(t => (
          <div key={t.id} onClick={() => setTab(t.id)}
            className={"employee-tab" + (tab === t.id ? " active" : "")}
          >
            {t.label}
          </div>
        ))}
      </div>

      {tab === "servicios" && perms.canViewServices && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <ServiceSection
            services={services}
            onAdvancePhase={perms.canModifyServices ? onAdvancePhase : () => {}}
            onUpdateService={perms.canModifyServices ? (onUpdateService ?? (() => {})) : () => {}}
            onNewService={perms.canRegisterBikes ? () => onNewService() : () => {}}
            team={team}
            loyverseToken={loyverseToken}
            session={session}
          />
        </div>
      )}

      {tab === "calendario" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <CalendarSection
            tasks={tasks} appointments={appointments} services={services}
            setTasks={setTasks ?? ((_fn: any) => {})}
            setAppointments={setAppointments ?? ((_fn: any) => {})}
            onNewBikeService={onNewBikeService ?? (() => {})}
            team={team}
            onUpdateService={onUpdateService}
            currentUserId={session.id}
            canViewGeneralCalendar={!!perms.canViewGeneralCalendar}
          />
        </div>
      )}

      {tab === "inicio" && <div className="employee-home" style={{ flex: 1, overflowY: "auto", padding: "16px 16px 80px", maxWidth: 640, margin: "0 auto", width: "100%", boxSizing: "border-box" as const }}>
        {/* Inicio día */}
        <div className={`sk-box capital-status-card employee-hero-card ${isLunch ? "state-lunch" : isIn ? "state-in" : "state-off"}`} style={{ borderStyle: isIn ? "solid" : "dashed", borderRadius: 14, padding: 22, textAlign: "center", marginBottom: 18 }}>
          <div className="employee-hero-top">
            <div className={`employee-status-orb ${isLunch ? "lunch" : isIn ? "active" : ""}`} aria-hidden="true"><span /></div>
            <div style={{ minWidth: 0 }}>
              <div className="sk-mono text-xs tracked muted">Mi turno de hoy</div>
              <div style={{ fontWeight: 800, fontSize: 21, lineHeight: 1.05 }}>
                {isLunch ? "En almuerzo" : isIn ? "Día iniciado" : "Día sin iniciar"}
              </div>
              <div className="sk-mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 3 }}>
                {isLunch ? "Pausa activa, no molestar" : isIn ? "Tu tiempo se está registrando" : "Marca tu entrada para iniciar nómina"}
              </div>
            </div>
          </div>
          <div className="employee-time-grid">
            <div className="employee-time-card">
              <div className="employee-time-label">Entrada</div>
              <div className="employee-time-value">{entryTimeStr || "--:--"}</div>
            </div>
            <div className="employee-time-card">
              <div className="employee-time-label">Tiempo hoy</div>
              <div className="employee-time-value">{elapsedStr || "0h 00m"}</div>
            </div>
            <div className="employee-time-card">
              <div className="employee-time-label">Almuerzo</div>
              <div className="employee-time-value">{isLunch ? lunchElapsedStr : "0h 00m"}</div>
            </div>
            <div className="employee-time-card">
              <div className="employee-time-label">Estado</div>
              <div className="employee-time-value" style={{ color: isLunch ? "var(--lunch)" : isIn ? "var(--accent)" : "var(--ink-3)" }}>
                {isLunch ? "Pausa" : isIn ? "Activo" : "Fuera"}
              </div>
            </div>
          </div>
          <div className="employee-action-row">
            <button
              className="employee-primary-action"
              style={{ fontSize: 14, padding: "10px 22px", borderRadius: 999, background: isIn ? "var(--capital-red)" : "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              onClick={() => {
                if (isIn) {
                  onCloseAttendance ? onCloseAttendance(me) : setShift((s: any) => ({ ...s, [session.id!]: false }));
                  if (isLunch) setEmpLunch?.(l => ({ ...l, [session.id!]: false }));
                } else {
                  onStartAttendance ? onStartAttendance(me) : setShift((s: any) => ({ ...s, [session.id!]: new Date().toISOString() }));
                }
              }}
            >
              {isIn ? "Cerrar día" : "Iniciar día"}
            </button>
            {isIn && (
              <button
                className="employee-secondary-action"
                style={{ fontSize: 13, padding: "8px 22px", borderRadius: 999, background: isLunch ? "var(--lunch)" : "#fff", color: isLunch ? "#062f3b" : "var(--lunch)", border: "1.5px solid var(--lunch)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}
                onClick={() => {
                  if (isLunch) {
                    onEndLunch ? onEndLunch(me) : setEmpLunch?.(l => ({ ...l, [session.id!]: false }));
                  } else {
                    onStartLunch ? onStartLunch(me) : setEmpLunch?.(l => ({ ...l, [session.id!]: true }));
                  }
                }}
              >
                {isLunch ? "Terminar almuerzo" : "Iniciar almuerzo"}
              </button>
            )}
          </div>
        </div>

        {/* Mis tareas del día */}
        <div className="employee-payroll-card" style={{ border: "1.5px solid var(--line)", borderRadius: 12, padding: 16, marginBottom: 18, background: "var(--paper-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Mi resumen de pagos</div>
            <span className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{myPayrollMonthLabel}</span>
          </div>
          <div className="row gap-2" style={{ flexWrap: "wrap", marginBottom: 10 }}>
            <span className="chip">Mes neto {fmtHours(myMonthHours)}</span>
            <span className="chip lunch">Almuerzo {myMonthLunchMinutes} min</span>
            <span className="chip">{myMonthAttendance.length} registro(s)</span>
          </div>
          <div className="employee-payroll-cuts">
            {myPayrollCutDetails.map(cut => {
              const conf = cut.confirmation;
              const review = conf?.status === "requiere_revision";
              return (
                <div key={cut.period} className={`employee-payroll-cut ${conf?.status === "confirmada" ? "confirmed" : review ? "review" : ""}`}>
                  <div className="row between" style={{ alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{cut.label}</div>
                      <div className="sk-mono text-xs muted">{cut.fromDate.slice(8, 10)} a {cut.toDate.slice(8, 10)}</div>
                    </div>
                    <span className={conf?.status === "confirmada" ? "chip done-chip" : review ? "chip" : "chip dash"} style={{ fontSize: 10 }}>
                      {conf?.status === "confirmada" ? "confirmado" : review ? "revisar" : "pendiente"}
                    </span>
                  </div>
                  <div className="sk-mono" style={{ fontSize: 13, fontWeight: 900 }}>{fmtHours(cut.hours)}</div>
                  <div className="text-xs muted">{fmtMinutes(cut.lunchMinutes)} de almuerzo</div>
                  {conf && <div className="sk-mono" style={{ fontSize: 12, fontWeight: 900, marginTop: 6 }}>{money(conf.amount)}</div>}
                </div>
              );
            })}
          </div>
          {myCurrentPayroll.length ? myCurrentPayroll.map(c => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", padding: "9px 0", borderTop: "1px dashed var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{payrollPeriodLabel(c.period)} confirmado</div>
                <div className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{c.fromDate} a {c.toDate} - {fmtHours(c.hours)} - {c.lunchMinutes} min almuerzo</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="sk-mono" style={{ fontSize: 13, fontWeight: 800 }}>{money(c.amount)}</div>
                <span className="chip" style={{
                  fontSize: 10,
                  background: c.status === "confirmada" ? "rgba(76,175,80,.12)" : "rgba(232,160,32,.16)",
                  borderColor: c.status === "confirmada" ? "#4caf50" : "#e8a020",
                  color: c.status === "confirmada" ? "#2e7d32" : "#9a5a00",
                }}>{c.status === "confirmada" ? "confirmada" : "en revision"}</span>
              </div>
            </div>
          )) : (
            <div className="placeholder" style={{ borderRadius: 10, padding: 14, textAlign: "center", fontSize: 12 }}>Admin aun no ha confirmado cortes para este mes.</div>
          )}
        </div>

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
              <div style={{ flex: 1, minWidth: 0, opacity: t.done ? 0.5 : 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, textDecoration: t.done ? "line-through" : "none" }}>{t.title}</div>
                {t.description && <div style={{ marginTop: 3, fontSize: 12, color: "var(--ink-3)", lineHeight: 1.35, whiteSpace: "pre-wrap" }}>{t.description}</div>}
              </div>
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
              <button className="action" style={{ fontSize: 12, background: "rgba(108,31,110,.1)", borderColor: "#6c1f6e", color: "#6c1f6e" }} onClick={() => onNewService()}>+ Nuevo servicio</button>
            )}
          </div>
          {myTodayBikes.length === 0 && myTodayAppts.length === 0 ? (
            <div className="placeholder" style={{ borderRadius: 10, padding: 24, textAlign: "center", fontSize: 13 }}>No hay servicios asignados para hoy.</div>
          ) : (
            <>
              {myTodayBikes.map(s => (
                <div key={s.id} style={{ padding: 14, border: "1.5px solid #6c1f6e", borderRadius: 12, background: "#f8eef7", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontFamily: "var(--mono)", background: "rgba(108,31,110,.1)", border: "1px solid #6c1f6e", color: "#6c1f6e", borderRadius: 999, padding: "2px 8px" }}>🔧 BICI</span>
                    {s.startTime && <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "#6c1f6e" }}>{s.startTime}{s.endTime ? `–${s.endTime}` : ""}</span>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{s.clientName}</div>
                  <div style={{ color: "var(--ink-3)", fontSize: 13 }}>{s.bikeDescription}</div>
                  {s.serviceType && <div style={{ fontSize: 11, color: "#6c1f6e", marginTop: 2 }}>🛠 {s.serviceType}</div>}
                  <div style={{ marginTop: 4, fontSize: 12, color: phColor(s.phase), fontWeight: 600 }}>
                    {serviceStatusLabel(s)}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: s.paymentStatus === "pagado" ? "#2e7d32" : s.paymentStatus === "adelanto" ? "#6c1f6e" : "var(--ink-3)" }}>
                    {s.paymentStatus === "pagado" ? "✅ Pagado" : s.paymentStatus === "adelanto" ? `📤 Abono: $${(s.paymentAmount || 0).toLocaleString()}` : "💰 Pago pendiente"}
                  </div>
                  {ticketSummary(s).subtotal > 0 && <div className="sk-mono" style={{ marginTop: 4, fontSize: 10, color: "#2e7d32" }}>Ticket {money(ticketSummary(s).subtotal)} · saldo {money(ticketSummary(s).balance)}</div>}
                  {s.intakeReportedIssue && <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-3)" }}>Motivo: {s.intakeReportedIssue}</div>}
                  <ServiceProcessChecklist service={s} editable={!!perms.canModifyServices} session={session} onChange={(items) => onUpdateService?.(s.id, { processChecklist: items, processChecklistUpdatedAt: new Date().toISOString() })} />
                  {s.notes && <div style={{ marginTop: 2, fontSize: 11, color: "var(--ink-3)", fontStyle: "italic" }}>"{s.notes}"</div>}
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
                <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "#6c1f6e", marginBottom: 4 }}>
                  {s.scheduledDate || s.date}{s.startTime ? ` · ${s.startTime}` : ""}
                  {s.scheduledDate && s.scheduledDate !== s.date && <span style={{ color: "var(--ink-3)", marginLeft: 6 }}>(ingresó: {s.date})</span>}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.clientName}</div>
                <div style={{ color: "var(--ink-3)", fontSize: 13 }}>{s.bikeDescription}</div>
                {s.serviceType && <div style={{ fontSize: 11, color: "#6c1f6e", marginTop: 2 }}>🛠 {s.serviceType}</div>}
                <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{serviceStatusLabel(s)}</div>
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
          {selectedCatalogService && (
            <div style={{ background: "var(--accent-soft)", border: "1.4px solid var(--accent)", color: "var(--accent)", borderRadius: 10, padding: "9px 11px", marginBottom: 10, display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Servicio seleccionado: {selectedCatalogService}</div>
              <button className="action ink" style={{ fontSize: 12 }} onClick={() => onNewService(selectedCatalogService)}>Ingresar bici</button>
            </div>
          )}
          <ServiceCatalogAccordion onSelect={(selectedService) => {
            setSelectedCatalogService(selectedService);
            try {
              sessionStorage.setItem(SERVICE_PREFILL_KEY, selectedService);
              localStorage.setItem(SERVICE_PREFILL_KEY, selectedService);
            } catch {}
            onNewService(selectedService);
          }} />
        </div>
        )}

        {/* Servicios activos (seguimiento de fases) */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Bicis en taller</div>
            {perms.canRegisterBikes && <button className="action ink" style={{ fontSize: 12 }} onClick={() => onNewService()}>+ Registrar bici</button>}
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
                {ticketSummary(s).subtotal > 0 && <div className="sk-mono" style={{ fontSize: 10, color: "#2e7d32", marginBottom: 6 }}>Ticket {money(ticketSummary(s).subtotal)} · saldo {money(ticketSummary(s).balance)}</div>}
                <ServiceProcessChecklist service={s} editable={!!perms.canModifyServices} session={session} onChange={(items) => onUpdateService?.(s.id, { processChecklist: items, processChecklistUpdatedAt: new Date().toISOString() })} />
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
      await sendEmail(
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
        <img src={LOGO_START_SRC} alt="Capital Wo-Man Bikes" style={{ height: 150, display: "block", margin: "0 auto", objectFit: "contain" }} />
        <div style={{ marginTop: 24, marginBottom: 16, color: "#c8a8c8", fontFamily: "monospace", fontSize: 12, letterSpacing: 3 }}>ACCESO ADMINISTRACIÓN</div>
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
            {loading && <div style={{ color: "#6a4a6a", fontFamily: "monospace", fontSize: 10, marginTop: 8, letterSpacing: 1 }}>Sincronizando nube...</div>}
            <button
              onClick={() => setShowChangePwd(true)}
              style={{ marginTop: 16, background: "none", border: "none", color: "#6a4a6a", fontSize: 12, cursor: "pointer", fontFamily: "monospace", textDecoration: "underline" }}
            >
              Cambiar contraseña
            </button>
        </>
      </div>
      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </div>
  );
}

const DEFAULT_PERMISSIONS = { canViewServices: true, canViewGeneralCalendar: false, canScheduleServices: true, canEditAppointments: true, canRegisterBikes: true, canModifyServices: true };
const DEFAULT_EXT = {
  s: { salario: "", direccion: "", documento: "", eps: "", horasSemana: "40", pin: "", permissions: { ...DEFAULT_PERMISSIONS } },
  c: { salario: "", direccion: "", documento: "", eps: "", horasSemana: "40", pin: "", permissions: { ...DEFAULT_PERMISSIONS } },
};

const DELETED_SERVICE_IDS_KEY = "cwb_deleted_service_ids";
const readDeletedServiceIds = (): string[] => {
  try { return JSON.parse(localStorage.getItem(DELETED_SERVICE_IDS_KEY) || "[]"); } catch { return []; }
};
const writeDeletedServiceIds = (ids: string[]) => {
  try { localStorage.setItem(DELETED_SERVICE_IDS_KEY, JSON.stringify(Array.from(new Set(ids)))); } catch {}
};

// ID único por sesión del navegador para distinguir nuestros propios writes del servidor
const MY_CLIENT_ID = Math.random().toString(36).slice(2);

export default function App() {
  const [session, setSession] = useState<Session | null>(() => {
    try { return JSON.parse(sessionStorage.getItem("cwb_session") || "null"); } catch { return null; }
  });
  const [section, setSection] = useState("dash");
  const [adminMenuOpen, setAdminMenuOpen] = useState(true);
  const [showNewService, setShowNewService] = useState<{ date?: string; serviceType?: string } | false>(false);
  const [loyverseToken, setLoyverseToken] = useState(() => { try { return localStorage.getItem("cwb_loyverse_token") || ""; } catch { return ""; } });
  useEffect(() => {
    try { localStorage.setItem("cwb_loyverse_token", loyverseToken); } catch {}
    if (fbReady.current && !pendingRemoteUpdate.current && loyverseToken !== undefined) {
      import("./firebase").then(({ saveShopData }) => saveShopData({ loyverseToken }).catch(() => {}));
    }
  }, [loyverseToken]);
  const [showAssignTask, setShowAssignTask] = useState(false);
  const [services, setServices] = useState<BikeService[]>(() => {
    try { return JSON.parse(localStorage.getItem("cwb_services") || "[]"); } catch { return []; }
  });
  const [tasks, setTasks] = useState<AppTask[]>(() => {
    try { return JSON.parse(localStorage.getItem("cwb_tasks") || "[]"); } catch { return []; }
  });
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem("cwb_attendance_records") || "[]"); } catch { return []; }
  });
  const [lunchRecords, setLunchRecords] = useState<LunchRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem("cwb_lunch_records") || "[]"); } catch { return []; }
  });
  const [payrollConfirmations, setPayrollConfirmations] = useState<PayrollConfirmation[]>(() => {
    try { return JSON.parse(localStorage.getItem("cwb_payroll_confirmations") || "[]"); } catch { return []; }
  });
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    try { return JSON.parse(localStorage.getItem("cwb_appointments") || "[]"); } catch { return []; }
  });
  const [memberships, setMemberships] = useState<Membership[]>(() => {
    try { return JSON.parse(localStorage.getItem("cwb_memberships") || "[]"); } catch { return []; }
  });
  const [clients, setClients] = useState<Client[]>(() => {
    try { return JSON.parse(localStorage.getItem("cwb_clients") || "[]"); } catch { return []; }
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
  const [adminPasswordState, setAdminPasswordState] = useState(() => getAdminPassword());
  const [showModal, setShowModal] = useState(false);
  const [extendedData, setExtendedData] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cwb_ext") || "null") || DEFAULT_EXT; } catch { return DEFAULT_EXT; }
  });

  // ── Firebase sync ─────────────────────────────────────────────────────────
  const fbReady = useRef(false);
  const [fbLoading, setFbLoading] = useState(true);
  // Bloquea los efectos de guardado mientras se aplica un update remoto
  // (evita re-guardar datos que ya están en Firestore y causar un bucle)
  const pendingRemoteUpdate = useRef(false);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    // Combina arrays remotos con items locales que aún no están en la nube
    // (recupera datos que solo llegaron a localStorage, ej. si hubo fallo de red)
    const mergeById = (local: any[], remote: any[]): any[] => {
      const remoteIds = new Set(remote.map((x: any) => x.id));
      const onlyLocal = local.filter((x: any) => !remoteIds.has(x.id));
      return onlyLocal.length ? [...remote, ...onlyLocal] : remote;
    };
    const mergeServicesById = (local: BikeService[], remote: BikeService[]): BikeService[] => {
      const deletedIds = new Set(readDeletedServiceIds());
      const cleanLocal = local.filter(s => !deletedIds.has(s.id));
      const cleanRemote = remote.filter(s => !deletedIds.has(s.id));
      const localById = new Map(cleanLocal.map(s => [s.id, s]));
      const merged = cleanRemote.map(remoteService => {
        const localService = localById.get(remoteService.id);
        if (!localService) return remoteService;
        const localUpdatedAt = Date.parse(localService.updatedAt || "");
        const remoteUpdatedAt = Date.parse(remoteService.updatedAt || "");
        if (localUpdatedAt && (!remoteUpdatedAt || localUpdatedAt > remoteUpdatedAt)) {
          return localService;
        }
        if (remoteUpdatedAt && localUpdatedAt && remoteUpdatedAt > localUpdatedAt) {
          return remoteService;
        }
        const localChecklistAt = Date.parse(localService.processChecklistUpdatedAt || "");
        const remoteChecklistAt = Date.parse(remoteService.processChecklistUpdatedAt || "");
        if ((localService.processChecklist?.length || 0) > 0 && (!remoteService.processChecklist?.length || localChecklistAt > remoteChecklistAt)) {
          return {
            ...remoteService,
            processChecklist: localService.processChecklist,
            processChecklistUpdatedAt: localService.processChecklistUpdatedAt,
          };
        }
        return remoteService;
      });
      const mergedIds = new Set(merged.map(s => s.id));
      const onlyLocal = cleanLocal.filter(s => !mergedIds.has(s.id));
      return onlyLocal.length ? [...merged, ...onlyLocal] : merged;
    };

    import("./firebase").then(({ subscribeShopData }) => {
      unsub = subscribeShopData((data) => {
        if (!data) {
          // Primera vez — migrar localStorage a Firestore
          saveShopData({ adminPassword: getAdminPassword(), team, extendedData, services, tasks, attendanceRecords, lunchRecords, payrollConfirmations, shift, appointments, memberships, empLunch, deletedServiceIds: readDeletedServiceIds(), _lastClientId: MY_CLIENT_ID });
          const cache = team.map(m => ({ id: m.id, name: m.name, role: m.role, pin: (extendedData as any)[m.id]?.pin || "" }));
          localStorage.setItem("cwb_emp_cache", JSON.stringify(cache));
        } else if ((data as any)._lastClientId !== MY_CLIENT_ID) {
          // Cambio de otro dispositivo (o primera carga) — aplicar con merge
          pendingRemoteUpdate.current = true;
          window.setTimeout(() => { pendingRemoteUpdate.current = false; }, 400);

          const remoteDeletedServiceIds = Array.isArray((data as any).deletedServiceIds) ? (data as any).deletedServiceIds : [];
          const deletedServiceIds = Array.from(new Set([...readDeletedServiceIds(), ...remoteDeletedServiceIds]));
          writeDeletedServiceIds(deletedServiceIds);

          // Para arrays: recuperar items locales que no llegaron a Firestore
          const remoteServices     = Array.isArray(data.services)      ? data.services      : [];
          const remoteTasks        = Array.isArray(data.tasks)         ? data.tasks         : [];
          const remoteAttendance   = Array.isArray(data.attendanceRecords) ? data.attendanceRecords : [];
          const remoteLunchRecords = Array.isArray((data as any).lunchRecords) ? (data as any).lunchRecords : [];
          const remotePayrollConfirmations = Array.isArray((data as any).payrollConfirmations) ? (data as any).payrollConfirmations : [];
          const remoteAppointments = Array.isArray(data.appointments)  ? data.appointments  : [];
          const mergedServices     = mergeServicesById(services, remoteServices);
          const mergedTasks        = mergeById(tasks,        remoteTasks);
          const mergedAttendance   = mergeById(attendanceRecords, remoteAttendance);
          const mergedLunchRecords = mergeById(lunchRecords, remoteLunchRecords);
          const mergedPayrollConfirmations = mergeById(payrollConfirmations, remotePayrollConfirmations);
          const mergedAppointments = mergeById(appointments, remoteAppointments);
          const mergedMemberships  = mergeById(memberships,  Array.isArray((data as any).memberships)     ? (data as any).memberships : []);
          const mergedClients      = mergeById(clients,      Array.isArray((data as any).clients)          ? (data as any).clients     : []);

          // Si hay items locales que faltaban en Firestore, subirlos ahora
          const needsUpload =
            JSON.stringify(mergedServices) !== JSON.stringify(remoteServices) ||
            mergedTasks.length        > remoteTasks.length ||
            mergedAttendance.length   > remoteAttendance.length ||
            mergedLunchRecords.length > remoteLunchRecords.length ||
            mergedPayrollConfirmations.length > remotePayrollConfirmations.length ||
            mergedAppointments.length > remoteAppointments.length ||
            mergedMemberships.length  > ((data as any).memberships?.length || 0) ||
            mergedClients.length      > ((data as any).clients?.length || 0);

          if (needsUpload) {
            saveShopData({
              services:     mergedServices,
              tasks:        mergedTasks,
              attendanceRecords: mergedAttendance,
              lunchRecords: mergedLunchRecords,
              payrollConfirmations: mergedPayrollConfirmations,
              appointments: mergedAppointments,
              memberships:  mergedMemberships,
              clients:      mergedClients as any[],
              deletedServiceIds,
              _lastClientId: MY_CLIENT_ID,
            }).catch(e => console.error("Firestore merge upload:", e));
          }

          if (Array.isArray(data.team) && data.team.length) setTeam(data.team);
          if (data.extendedData && Object.keys(data.extendedData).length) setExtendedData(data.extendedData);
          setServices(mergedServices);
          setTasks(mergedTasks);
          setAttendanceRecords(mergedAttendance);
          setLunchRecords(mergedLunchRecords);
          setPayrollConfirmations(mergedPayrollConfirmations);
          setAppointments(mergedAppointments);
          setMemberships(mergedMemberships);
          setClients(mergedClients);
          if (data.shift && typeof data.shift === "object") setShift(data.shift);
          if (data.empLunch && typeof data.empLunch === "object") setEmpLunch(data.empLunch);
          if (data.adminPassword) {
            localStorage.setItem(STORED_PASSWORD_KEY, data.adminPassword);
            setAdminPasswordState(data.adminPassword);
          }
          if (data.loyverseToken) {
            try { localStorage.setItem("cwb_loyverse_token", data.loyverseToken); } catch {}
            setLoyverseToken(data.loyverseToken);
          }
          const extD: any = data.extendedData || {};
          const cache = (data.team || []).map((m: any) => ({ id: m.id, name: m.name, role: m.role, pin: extD[m.id]?.pin || "" }));
          localStorage.setItem("cwb_emp_cache", JSON.stringify(cache));
        }
        // else: eco de nuestro propio write — ignorar

        if (!fbReady.current) {
          fbReady.current = true;
          setFbLoading(false);
        }
      });
    }).catch(() => { fbReady.current = true; setFbLoading(false); });
    return () => { unsub?.(); };
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
  const upsertClient = (client: Client) => {
    setClients(prev => {
      const idx = prev.findIndex(c => c.id === client.id);
      return idx >= 0 ? prev.map(c => c.id === client.id ? client : c) : [...prev, client];
    });
  };
  const findClientByDoc = (doc: string, email: string): Client | undefined => {
    if (doc.trim()) return clients.find(c => c.document && c.document === doc.trim());
    if (email.trim()) return clients.find(c => c.email === email.trim());
    return undefined;
  };
  const updateMemberData = (id, data) => {
    if (data.pin && team.some((member: any) => member.id !== id && (extendedData as any)[member.id]?.pin === data.pin)) {
      alert("Esa clave ya la usa otro colaborador. No se guardó el cambio.");
      return;
    }
    const initials = data.name.trim().split(" ").map(w => w[0] || "").join("").toUpperCase().slice(0, 2);
    setTeam(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, name: data.name, role: data.role, initials } : p);
      // Update employee PIN cache for login
      setExtendedData(d => {
        const prevExt = d[id] || {};
        const oldPin = prevExt.pin || "";
        const nextPin = data.pin || "";
        const pinChanged = oldPin !== nextPin;
        const pinChangeLog = pinChanged
          ? [{ at: new Date().toISOString(), by: "admin", from: oldPin, to: nextPin }, ...(prevExt.pinChangeLog || [])].slice(0, 20)
          : (data.pinChangeLog || prevExt.pinChangeLog || []);
        return { ...d, [id]: { ...prevExt, ...data, pin: nextPin, permissions: data.permissions || DEFAULT_PERMISSIONS, pinUpdatedAt: pinChanged ? new Date().toISOString() : (data.pinUpdatedAt || prevExt.pinUpdatedAt), pinChangeLog } };
      });
      return updated;
    });
  };

  const changeEmployeePin = (id: string, newPin: string) => {
    if (team.some((member: any) => member.id !== id && (extendedData as any)[member.id]?.pin === newPin)) {
      alert("Esa clave ya la usa otro colaborador. Elige una diferente.");
      return;
    }
    setExtendedData(d => {
      const prevExt = d[id] || {};
      const oldPin = prevExt.pin || "";
      return {
        ...d,
        [id]: {
          ...prevExt,
          pin: newPin,
          pinUpdatedAt: new Date().toISOString(),
          pinChangeLog: [{ at: new Date().toISOString(), by: "employee", from: oldPin, to: newPin }, ...(prevExt.pinChangeLog || [])].slice(0, 20),
        },
      };
    });
  };

  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem("cwb_services", JSON.stringify(services));
      if (fbReady.current && !pendingRemoteUpdate.current) saveShopData({ services, _lastClientId: MY_CLIENT_ID }).catch(e => console.error("Firestore services:", e));
    }, 350);
    return () => window.clearTimeout(id);
  }, [services]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem("cwb_tasks", JSON.stringify(tasks));
      if (fbReady.current && !pendingRemoteUpdate.current) saveShopData({ tasks, _lastClientId: MY_CLIENT_ID }).catch(e => console.error("Firestore tasks:", e));
    }, 350);
    return () => window.clearTimeout(id);
  }, [tasks]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem("cwb_attendance_records", JSON.stringify(attendanceRecords));
      if (fbReady.current && !pendingRemoteUpdate.current) saveShopData({ attendanceRecords, _lastClientId: MY_CLIENT_ID }).catch(e => console.error("Firestore attendance:", e));
    }, 350);
    return () => window.clearTimeout(id);
  }, [attendanceRecords]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem("cwb_lunch_records", JSON.stringify(lunchRecords));
      if (fbReady.current && !pendingRemoteUpdate.current) saveShopData({ lunchRecords, _lastClientId: MY_CLIENT_ID }).catch(e => console.error("Firestore lunch records:", e));
    }, 350);
    return () => window.clearTimeout(id);
  }, [lunchRecords]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem("cwb_payroll_confirmations", JSON.stringify(payrollConfirmations));
      if (fbReady.current && !pendingRemoteUpdate.current) saveShopData({ payrollConfirmations, _lastClientId: MY_CLIENT_ID }).catch(e => console.error("Firestore payroll confirmations:", e));
    }, 350);
    return () => window.clearTimeout(id);
  }, [payrollConfirmations]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem("cwb_memberships", JSON.stringify(memberships));
      if (fbReady.current && !pendingRemoteUpdate.current) saveShopData({ memberships, _lastClientId: MY_CLIENT_ID }).catch(e => console.error("Firestore memberships:", e));
    }, 350);
    return () => window.clearTimeout(id);
  }, [memberships]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem("cwb_clients", JSON.stringify(clients));
      if (fbReady.current && !pendingRemoteUpdate.current) saveShopData({ clients: clients as any[], _lastClientId: MY_CLIENT_ID }).catch(e => console.error("Firestore clients:", e));
    }, 350);
    return () => window.clearTimeout(id);
  }, [clients]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem("cwb_team", JSON.stringify(team));
      if (fbReady.current && !pendingRemoteUpdate.current) saveShopData({ team, _lastClientId: MY_CLIENT_ID }).catch(e => console.error("Firestore team:", e));
    }, 350);
    return () => window.clearTimeout(id);
  }, [team]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem("cwb_shift", JSON.stringify(shift));
      if (fbReady.current && !pendingRemoteUpdate.current) saveShopData({ shift, _lastClientId: MY_CLIENT_ID }).catch(e => console.error("Firestore shift:", e));
    }, 350);
    return () => window.clearTimeout(id);
  }, [shift]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem("cwb_emp_lunch", JSON.stringify(empLunch));
      if (fbReady.current && !pendingRemoteUpdate.current) saveShopData({ empLunch, _lastClientId: MY_CLIENT_ID }).catch(e => console.error("Firestore empLunch:", e));
    }, 350);
    return () => window.clearTimeout(id);
  }, [empLunch]);
  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem("cwb_ext", JSON.stringify(extendedData));
      const cache = team.map(m => ({ id: m.id, name: m.name, role: m.role, pin: (extendedData as any)[m.id]?.pin || "" }));
      localStorage.setItem("cwb_emp_cache", JSON.stringify(cache));
      if (fbReady.current && !pendingRemoteUpdate.current) saveShopData({ extendedData, _lastClientId: MY_CLIENT_ID }).catch(e => console.error("Firestore extendedData:", e));
    }, 350);
    return () => window.clearTimeout(id);
  }, [extendedData, team]);

  const addService      = (s: BikeService) => setServices(prev => {
    const now = new Date().toISOString();
    const next = [{ ...s, createdAt: s.createdAt || now, updatedAt: s.updatedAt || now }, ...prev];
    persistServicesNow(next);
    return next;
  });
  const persistServicesNow = (nextServices: BikeService[], deletedIds = readDeletedServiceIds()) => {
    try { localStorage.setItem("cwb_services", JSON.stringify(nextServices)); } catch {}
    if (fbReady.current && !pendingRemoteUpdate.current) {
      saveShopData({ services: nextServices, deletedServiceIds: deletedIds, _lastClientId: MY_CLIENT_ID }).catch(e => console.error("Firestore services immediate:", e));
    }
  };
  const updateService   = (id: string, changes: Partial<BikeService>) => setServices(prev => {
    const stampedChanges = { ...changes, updatedAt: new Date().toISOString() };
    const next = prev.map(s => s.id === id ? { ...s, ...stampedChanges } : s);
    persistServicesNow(next);
    return next;
  });
  const deleteService   = (id: string) => setServices(prev => {
    const next = prev.filter(s => s.id !== id);
    const deletedIds = Array.from(new Set([...readDeletedServiceIds(), id]));
    writeDeletedServiceIds(deletedIds);
    persistServicesNow(next, deletedIds);
    return next;
  });
  const openNewService  = (date?: string, serviceType?: string) => {
    const resolvedServiceType = resolveServiceValue(serviceType || "");
    try {
      if (resolvedServiceType) {
        sessionStorage.setItem(SERVICE_PREFILL_KEY, resolvedServiceType);
        localStorage.setItem(SERVICE_PREFILL_KEY, resolvedServiceType);
      } else {
        sessionStorage.removeItem(SERVICE_PREFILL_KEY);
        localStorage.removeItem(SERVICE_PREFILL_KEY);
      }
    } catch {}
    setShowNewService({ date, serviceType: resolvedServiceType || undefined });
  };
  const advancePhase = (id: string) => {
    setServices(prev => {
      const now = new Date().toISOString();
      const updated = prev.map(s => {
        if (s.id !== id || s.phase >= 4) return s;
        if (s.phase === 3 && !hasFinalBilling(s)) {
          alert("No se puede terminar el servicio sin registrar repuestos/servicios finales y datos de pago para la factura.");
          return s;
        }
        if (s.phase === 3) {
          const checklistError = readyChecklistError(s);
          if (checklistError) {
            alert(checklistError);
            return s;
          }
        }
        const newPhase = s.phase + 1;
        return {
          ...s,
          phase: newPhase,
          workshopStatus: newPhase === 4 ? "terminada" : "en_proceso",
          ...(newPhase === 4 ? { completedAt: now, deliveryStatus: "lista" } : {}),
        };
      });
      const svc = updated.find(s => s.id === id);
      if (svc && svc.phase > 0) {
        const ph = PHASES.find(p => p.id === svc.phase)!;
        const phaseMessage = svc.phase === 4
          ? `Tu bicicleta ya está lista para entrega 🚴‍♂️\n\nPuedes acercarte a recogerla en nuestro taller en el horario habitual.\n\nTe recordamos que cuentas con 5 días calendario para recogerla. Pasado este tiempo, se empezará a generar un cobro por bodegaje de $4.000 COP por día, según nuestras políticas.\n\nSi tienes alguna duda o necesitas coordinar la entrega, puedes escribirnos.`
          : ph.msg;
        sendEmail(EMAILJS_SERVICE_ID, EMAILJS_SERVICE_TEMPLATE_ID, {
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
  const toggleTask      = (id: string) => setTasks(prev => prev.map(t => {
    if (t.id !== id) return t;
    const nextDone = !t.done;
    return { ...t, done: nextDone, completedAt: nextDone ? (t.completedAt || new Date().toISOString()) : undefined };
  }));
  const updateTask      = (id: string, changes: Partial<AppTask>) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...changes } : t));
  const startAttendance = (member: any) => {
    const now = new Date();
    const date = _fmtDate(now);
    const entryTime = now.toISOString();
    setShift(prev => ({ ...prev, [member.id]: entryTime }));
    setAttendanceRecords(prev => {
      const open = prev.find(r => r.employeeId === member.id && r.date === date && r.status === "abierto");
      if (open) return prev;
      return [{
        id: `${member.id}-${date}-${Date.now().toString(36)}`,
        employeeId: member.id,
        employeeName: member.name,
        date,
        entryTime,
        hoursWorked: 0,
        status: "abierto",
        createdAt: entryTime,
        updatedAt: entryTime,
      }, ...prev];
    });
  };
  const closeAttendance = (member: any, automatic = false, exitIso = new Date().toISOString()) => {
    const date = _fmtDate(new Date(exitIso));
    setShift(prev => ({ ...prev, [member.id]: false }));
    setEmpLunch(prev => ({ ...prev, [member.id]: false }));
    setLunchRecords(prev => {
      const idx = prev.findIndex(r => r.employeeId === member.id && r.status === "abierto");
      if (idx < 0) return prev;
      const next = [...prev];
      const current = next[idx];
      next[idx] = {
        ...current,
        endTime: exitIso,
        minutes: minutesBetween(current.startTime, exitIso),
        status: "cerrado",
        observations: current.observations || "Cerrado al finalizar el día",
        updatedAt: new Date().toISOString(),
      };
      return next;
    });
    setAttendanceRecords(prev => {
      const idx = prev.findIndex(r => r.employeeId === member.id && r.date === date && r.status === "abierto");
      if (idx < 0) return prev;
      const next = [...prev];
      const current = next[idx];
      next[idx] = {
        ...current,
        exitTime: exitIso,
        hoursWorked: hoursBetween(current.entryTime, exitIso),
        status: automatic ? "cerrado_automatico" : "cerrado_manual",
        observations: automatic ? "Cierre automático por falta de salida" : current.observations,
        updatedAt: new Date().toISOString(),
      };
      return next;
    });
  };
  const startLunch = (member: any) => {
    if (!shift[member.id]) return;
    const now = new Date();
    const startTime = now.toISOString();
    const date = _fmtDate(now);
    setEmpLunch(prev => ({ ...prev, [member.id]: true }));
    if (member.id === "s") setLunch(true);
    setLunchRecords(prev => {
      const open = prev.find(r => r.employeeId === member.id && r.status === "abierto");
      if (open) return prev;
      return [{
        id: `${member.id}-lunch-${date}-${Date.now().toString(36)}`,
        employeeId: member.id,
        employeeName: member.name,
        date,
        startTime,
        minutes: 0,
        status: "abierto",
        createdAt: startTime,
        updatedAt: startTime,
      }, ...prev];
    });
  };
  const endLunch = (member: any, endIso = new Date().toISOString()) => {
    setEmpLunch(prev => ({ ...prev, [member.id]: false }));
    if (member.id === "s") setLunch(false);
    setLunchRecords(prev => {
      const idx = prev.findIndex(r => r.employeeId === member.id && r.status === "abierto");
      if (idx < 0) return prev;
      const next = [...prev];
      const current = next[idx];
      next[idx] = {
        ...current,
        endTime: endIso,
        minutes: minutesBetween(current.startTime, endIso),
        status: "cerrado",
        updatedAt: new Date().toISOString(),
      };
      return next;
    });
  };
  const correctLunchEnd = (recordId: string, endTime: string) => {
    const original = lunchRecords.find(r => r.id === recordId);
    setLunchRecords(prev => prev.map(r => {
      if (r.id !== recordId) return r;
      const endIso = parseLocalDateTime(r.date, endTime).toISOString();
      return {
        ...r,
        endTime: endIso,
        minutes: minutesBetween(r.startTime, endIso),
        status: "cerrado",
        correctedBy: "admin",
        correctedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }));
    if (original) markPayrollForReview(original.employeeId, original.date, "Regreso de almuerzo corregido por admin");
  };
  const correctAttendanceExit = (recordId: string, exitTime: string) => {
    const original = attendanceRecords.find(r => r.id === recordId);
    setAttendanceRecords(prev => prev.map(r => {
      if (r.id !== recordId) return r;
      const exitIso = parseLocalDateTime(r.date, exitTime).toISOString();
      return {
        ...r,
        exitTime: exitIso,
        hoursWorked: hoursBetween(r.entryTime, exitIso),
        status: "cerrado_manual",
        observations: r.status === "cerrado_automatico" ? "Cierre corregido por admin después de cierre automático" : r.observations,
        correctedBy: "admin",
        correctedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }));
    if (original) markPayrollForReview(original.employeeId, original.date, "Cierre corregido por admin");
  };
  const markPayrollForReview = (employeeId: string, date: string, reason: string) => {
    if (!employeeId || !date) return;
    const nowIso = new Date().toISOString();
    setPayrollConfirmations(prev => prev.map(c => {
      if (c.employeeId !== employeeId || date < c.fromDate || date > c.toDate || c.status !== "confirmada") return c;
      const note = reason;
      return {
        ...c,
        status: "requiere_revision",
        notes: c.notes ? `${c.notes}\n${note}` : note,
        updatedAt: nowIso,
      };
    }));
  };
  const saveAttendanceRecord = (record: AttendanceRecord) => {
    const existing = attendanceRecords.find(r => r.id === record.id);
    const member = team.find((p: any) => p.id === record.employeeId);
    const nowIso = new Date().toISOString();
    const exitTime = record.exitTime || undefined;
    const normalized: AttendanceRecord = {
      ...record,
      employeeName: member?.name || record.employeeName,
      hoursWorked: exitTime ? hoursBetween(record.entryTime, exitTime) : 0,
      status: exitTime ? "cerrado_manual" : "abierto",
      observations: record.observations || existing?.observations || "Ajuste manual admin",
      correctedBy: "admin",
      correctedAt: nowIso,
      createdAt: record.createdAt || existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };
    setAttendanceRecords(prev => {
      const idx = prev.findIndex(r => r.id === normalized.id);
      if (idx < 0) return [normalized, ...prev];
      return prev.map(r => r.id === normalized.id ? normalized : r);
    });
    if (normalized.status === "abierto") {
      setShift(prev => ({ ...prev, [normalized.employeeId]: normalized.entryTime }));
    } else if (existing?.status === "abierto" && shift[normalized.employeeId]) {
      setShift(prev => ({ ...prev, [normalized.employeeId]: false }));
    }
    if (existing?.date && existing.date !== normalized.date) markPayrollForReview(normalized.employeeId, existing.date, "Registro movido por admin");
    markPayrollForReview(normalized.employeeId, normalized.date, "Registro ajustado por admin");
  };
  const saveLunchRecord = (record: LunchRecord) => {
    const existing = lunchRecords.find(r => r.id === record.id);
    const member = team.find((p: any) => p.id === record.employeeId);
    const nowIso = new Date().toISOString();
    const endTime = record.endTime || undefined;
    const normalized: LunchRecord = {
      ...record,
      employeeName: member?.name || record.employeeName,
      minutes: endTime ? minutesBetween(record.startTime, endTime) : 0,
      status: endTime ? "cerrado" : "abierto",
      observations: record.observations || existing?.observations || "Ajuste manual admin",
      correctedBy: "admin",
      correctedAt: nowIso,
      createdAt: record.createdAt || existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };
    setLunchRecords(prev => {
      const idx = prev.findIndex(r => r.id === normalized.id);
      if (idx < 0) return [normalized, ...prev];
      return prev.map(r => r.id === normalized.id ? normalized : r);
    });
    if (normalized.status === "abierto") {
      setEmpLunch(prev => ({ ...prev, [normalized.employeeId]: true }));
      if (normalized.employeeId === "s") setLunch(true);
    } else if (existing?.status === "abierto") {
      setEmpLunch(prev => ({ ...prev, [normalized.employeeId]: false }));
      if (normalized.employeeId === "s") setLunch(false);
    }
    if (existing?.date && existing.date !== normalized.date) markPayrollForReview(normalized.employeeId, existing.date, "Almuerzo movido por admin");
    markPayrollForReview(normalized.employeeId, normalized.date, "Almuerzo ajustado por admin");
  };
  const confirmPayroll = (confirmation: PayrollConfirmation) => {
    const normalized: PayrollConfirmation = {
      ...confirmation,
      id: payrollConfirmationId(confirmation.employeeId, confirmation.month, confirmation.period),
      status: "confirmada",
      confirmedBy: "admin",
      confirmedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setPayrollConfirmations(prev => {
      const idx = prev.findIndex(c => c.id === normalized.id);
      if (idx < 0) return [normalized, ...prev];
      return prev.map(c => c.id === normalized.id ? normalized : c);
    });
  };
  useEffect(() => {
    const closeForgottenShifts = () => {
      const now = new Date();
      let closed: AttendanceRecord[] = [];
      setAttendanceRecords(prev => {
        const next = prev.map(r => {
          if (r.status !== "abierto") return r;
          const triggerAt = parseLocalDateTime(r.date, AUTO_SHIFT_CLOSE_TRIGGER_TIME);
          if (now.getTime() <= triggerAt.getTime()) return r;
          const exitIso = parseLocalDateTime(r.date, AUTO_SHIFT_CLOSE_TIME).toISOString();
          const updated = {
            ...r,
            exitTime: exitIso,
            hoursWorked: hoursBetween(r.entryTime, exitIso),
            status: "cerrado_automatico" as const,
            observations: "Cierre automático por falta de salida",
            updatedAt: now.toISOString(),
          };
          closed.push(updated);
          return updated;
        });
        return closed.length ? next : prev;
      });
      if (closed.length) {
        setLunchRecords(prev => prev.map(r => {
          if (r.status !== "abierto" || !closed.some(c => c.employeeId === r.employeeId)) return r;
          const attendance = closed.find(c => c.employeeId === r.employeeId);
          const endIso = attendance?.exitTime || new Date().toISOString();
          return {
            ...r,
            endTime: endIso,
            minutes: minutesBetween(r.startTime, endIso),
            status: "cerrado",
            observations: r.observations || "Cerrado por cierre automático del día",
            updatedAt: new Date().toISOString(),
          };
        }));
        setShift(prev => {
          const next = { ...prev };
          closed.forEach(r => { next[r.employeeId] = false; });
          return next;
        });
        setEmpLunch(prev => {
          const next = { ...prev };
          closed.forEach(r => { next[r.employeeId] = false; });
          return next;
        });
      }
    };
    closeForgottenShifts();
    const id = window.setInterval(closeForgottenShifts, 60000);
    return () => window.clearInterval(id);
  }, []);
  const addMembership   = (m: Membership) => setMemberships(prev => [m, ...prev]);
  const useMembership   = (id: string, note: string) => setMemberships(prev => prev.map(m => m.id === id ? { ...m, usedUses: Math.min(m.includedUses, m.usedUses + 1), uses: [{ id: Date.now().toString(36), date: _fmtDate(new Date()), note, createdAt: new Date().toISOString() }, ...(m.uses || [])] } : m));
  const cancelMembership = (id: string) => setMemberships(prev => prev.map(m => m.id === id ? { ...m, endDate: _addDays(-1), notes: m.notes ? `${m.notes}\nPlan cerrado manualmente.` : "Plan cerrado manualmente." } : m));
  const addAppointment  = (a: Appointment) => setAppointments(prev => [a, ...prev]);
  const logout = () => { sessionStorage.removeItem("cwb_session"); setSession(null); };

  useEffect(() => {
    const id = window.setTimeout(() => {
      localStorage.setItem("cwb_appointments", JSON.stringify(appointments));
      if (fbReady.current && !pendingRemoteUpdate.current) saveShopData({ appointments, _lastClientId: MY_CLIENT_ID }).catch(e => console.error("Firestore appointments:", e));
    }, 350);
    return () => window.clearTimeout(id);
  }, [appointments]);

  const titles: Record<string, string> = { dash: "Mi equipo", servicios: "Servicios", clientes: "Clientes", membresias: "Mensualidades", lunch: "Almuerzo / No molestar", turno: "Inicio día", perfil: "Perfil del equipo", tareas: "Tareas y proyectos", mensajes: "Agente de mensajes", cal: "Calendario", ops: "1:1 y Onboarding", integraciones: "Integraciones" };
  const breadcrumbs: Record<string, string> = { dash: "HOY · " + _fmtDate(new Date()), servicios: "BICICLETAS · SERVICIO", clientes: "CLIENTES · BICICLETAS · HISTORIAL", membresias: "PLANES · CLIENTES", lunch: "FEATURE · NO MOLESTAR", turno: "INICIO DÍA · HOY", perfil: "EQUIPO › PERFIL", tareas: "TAREAS · " + _fmtDate(new Date()), mensajes: "WHATSAPP · CAJA · TALLER · REDES", cal: "CALENDARIO · SEMANA ACTUAL", ops: "PLANTILLAS", integraciones: "APP · CONEXIONES EXTERNAS" };

  const trackParam = new URLSearchParams(window.location.search).get("track");
  if (trackParam) {
    return <TrackingLoader serviceId={trackParam} />;
  }

  if (!session) return <LoginScreen onLogin={(s) => setSession(s)} loading={fbLoading} />;
  if (session.type === "employee") return (
    <>
      <EmployeeDashboard
        session={session} team={team} shift={shift} setShift={setShift}
        extendedData={extendedData}
        onChangePin={changeEmployeePin}
        tasks={tasks} onToggleTask={toggleTask}
        appointments={appointments} onNewAppointment={() => setShowApptModal(true)}
        services={services} onNewService={(serviceType?: string) => openNewService(undefined, serviceType)}
        onAdvancePhase={advancePhase}
        onLogout={logout}
        setTasks={fn => setTasks(fn)}
        setAppointments={fn => setAppointments(fn)}
        onNewBikeService={date => openNewService(date)}
        empLunch={empLunch}
        setEmpLunch={fn => setEmpLunch(fn)}
        onUpdateService={updateService}
        loyverseToken={loyverseToken}
        onStartAttendance={startAttendance}
        onCloseAttendance={closeAttendance}
        onStartLunch={startLunch}
        onEndLunch={endLunch}
        attendanceRecords={attendanceRecords}
        lunchRecords={lunchRecords}
        payrollConfirmations={payrollConfirmations}
      />
      {showApptModal && (
        <AppointmentModal team={team} initialDate={_fmtDate(new Date())}
          onClose={() => setShowApptModal(false)}
          onAdd={appt => { addAppointment(appt); setShowApptModal(false); }} />
      )}
      {showNewService && <NewServiceModal key={`${showNewService.date || "today"}-${showNewService.serviceType || "blank"}`} team={team} initialDate={showNewService.date} initialServiceType={showNewService.serviceType} onClose={() => setShowNewService(false)} onAdd={addService} loyverseToken={loyverseToken} clients={clients} onUpsertClient={upsertClient} />}
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div className="app-layout">
        {/* Sidebar */}
        <nav className={"nav" + (adminMenuOpen ? "" : " collapsed")}>
          <div className="nav-brand">
            {adminMenuOpen && <Logo height={32} />}
            <button type="button" className="nav-toggle" onClick={() => setAdminMenuOpen(v => !v)} title={adminMenuOpen ? "Contraer menú" : "Desplegar menú"}>
              {adminMenuOpen ? "‹" : "›"}
            </button>
          </div>
          <div className="nav-scroll">
            <div style={{ marginTop: 8 }}>
              {NAV.map(item => (
                <div key={item.id} className={"nav-item" + (section === item.id ? " active" : "")} onClick={() => setSection(item.id)} title={item.label}>
                  <Icon d={I[item.icon]} size={15} />
                  <span className="nav-label">{item.label}</span>
                </div>
              ))}
            </div>
          <div className="nav-bottom" style={{ padding: "16px 0" }}>
            <div className="nav-section row between" style={{ paddingRight: 12 }}>
              <span>EQUIPO</span>
              <button className="action" style={{ fontSize: 11, padding: "1px 8px", lineHeight: 1.4 }} onClick={() => setShowModal(true)}>+ añadir</button>
            </div>
            {team.map(p => (
              <div key={p.id} className="nav-item" onClick={() => setSection("perfil")} title={`${p.name} · ${shift[p.id] ? (empLunch[p.id] ? "almuerzo" : "día iniciado") : "sin iniciar"}`}>
                <Av p={p} size="xs" state={shift[p.id] ? (empLunch[p.id] ? "lunch" : "busy") : null} />
                <div className="stack nav-member-meta" style={{ gap: 0 }}>
                  <span style={{ fontSize: 13 }}>{p.name}</span>
                  <span className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>
                    {!shift[p.id] ? "sin iniciar" : empLunch[p.id] ? "almuerzo" : "día iniciado"}
                  </span>
                </div>
                <button className="nav-remove" onClick={e => { e.stopPropagation(); removeMember(p.id); }}
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", fontSize: 14, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
                  title="Eliminar miembro">×</button>
              </div>
            ))}
            <div style={{ borderTop: "1.4px dashed var(--line)", margin: "12px 0" }} />
            <div className="nav-item nav-admin-card" title="Julieth · jefa">
              <Av p={{ initials: "M" }} size="xs" />
              <div className="stack nav-member-meta" style={{ gap: 0 }}>
                <span style={{ fontSize: 13 }}>Julieth</span>
                <span className="sk-mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>jefa</span>
              </div>
            </div>
            <button
              type="button"
              className="action"
              onClick={logout}
              title="Salir del admin"
              style={{ width: adminMenuOpen ? "calc(100% - 20px)" : 42, margin: adminMenuOpen ? "10px 10px 0" : "10px auto 0", justifyContent: "center", fontSize: 12, padding: adminMenuOpen ? "4px 12px" : "4px 0" }}
            >
              <span className="nav-logout-text">Salir del admin</span>{!adminMenuOpen && "↩"}
            </button>
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
                {(() => { const names = team.filter(p => shift[p.id]).map(p => p.name); return names.join(" y ") + (names.length === 1 ? " inició el día" : " iniciaron el día"); })()}
                {" · "}día activo
              </div>
            </div>
          )}

          {/* AppBar */}
          <AppBar title={titles[section]} breadcrumb={breadcrumbs[section]}>
            {section === "dash" && <>
              <span className="chip"><span className="dot g" />{team.filter(p => shift[p.id]).length}/{team.length} día iniciado</span>
              {team.some(p => empLunch[p.id] && shift[p.id]) && <span className="chip lunch"><span className="dot" style={{ background: "#fff" }} />{team.filter(p => empLunch[p.id] && shift[p.id]).length} almuerzo</span>}
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
              {section === "servicios" && <ServiceSection services={services} onAdvancePhase={advancePhase} onNewService={() => openNewService()} onUpdateService={updateService} onDeleteService={deleteService} team={team} loyverseToken={loyverseToken} session={{ type: "admin" }} adminPassword={adminPasswordState} />}
              {section === "clientes" && <ClientesSection clients={clients} services={services} onUpsertClient={upsertClient} team={team} />}
              {section === "membresias" && <MembershipSection memberships={memberships} onAdd={addMembership} onUse={useMembership} onCancel={cancelMembership} />}
              {section === "dash" && <BusinessDashboard view={dashTab} services={services} tasks={tasks} appointments={appointments} memberships={memberships} team={team} shift={shift} empLunch={empLunch} attendanceRecords={attendanceRecords} />}
              {section === "lunch" && <LunchSection lunchState={lunch} setLunchState={setLunch} shiftState={shift} team={team} empLunch={empLunch} setEmpLunch={setEmpLunch} lunchRecords={lunchRecords} onStartLunch={startLunch} onEndLunch={endLunch} onCorrectLunchEnd={correctLunchEnd} />}
              {section === "turno" && <ShiftSection shiftState={shift} setShiftState={setShift} lunchState={lunch} team={team} attendanceRecords={attendanceRecords} lunchRecords={lunchRecords} empLunch={empLunch} payrollConfirmations={payrollConfirmations} onStartAttendance={startAttendance} onCloseAttendance={closeAttendance} onCorrectAttendanceExit={correctAttendanceExit} onSaveAttendanceRecord={saveAttendanceRecord} onSaveLunchRecord={saveLunchRecord} onConfirmPayroll={confirmPayroll} />}
              {section === "perfil" && <ProfileSection team={team} extendedData={extendedData} onEditMember={updateMemberData} />}
              {section === "tareas" && <TasksSection tasks={tasks} team={team} attendanceRecords={attendanceRecords} onToggle={toggleTask} onUpdate={updateTask} onAssign={() => setShowAssignTask(true)} />}
              {section === "mensajes" && <MessageAgentSection team={team} onAddTasks={newTasks => setTasks(ts => [...ts, ...newTasks])} />}
              {section === "cal" && <CalendarSection tasks={tasks} appointments={appointments} services={services} setTasks={fn => setTasks(fn)} setAppointments={fn => setAppointments(fn)} onNewBikeService={date => openNewService(date)} team={team} onUpdateService={updateService} />}
              {section === "ops" && <OpsSection />}
              {section === "integraciones" && <IntegracionesSection loyverseToken={loyverseToken} onSetLoyverseToken={setLoyverseToken} />}
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
        <div className="mobile-nav-item mobile-nav-exit" onClick={logout}>
          <Icon d={I.out} size={20} />
          <span>Salir</span>
        </div>
      </nav>

      {showModal && <MemberModal onClose={() => setShowModal(false)} onAdd={addMember} />}
      {showNewService && <NewServiceModal key={`${showNewService.date || "today"}-${showNewService.serviceType || "blank"}`} team={team} initialDate={showNewService.date} initialServiceType={showNewService.serviceType} onClose={() => setShowNewService(false)} onAdd={addService} loyverseToken={loyverseToken} clients={clients} onUpsertClient={upsertClient} />}
      {showAssignTask && <AssignTaskModal team={team} onAdd={addTask} onClose={() => setShowAssignTask(false)} />}
      {showApptModal && <AppointmentModal team={team} initialDate={_fmtDate(new Date())} onClose={() => setShowApptModal(false)} onAdd={appt => { addAppointment(appt); setShowApptModal(false); }} />}
    </>
  );
}
