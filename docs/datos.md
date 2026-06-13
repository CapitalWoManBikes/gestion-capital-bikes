# Modelo de datos — Capital Wo-Man Bikes

Toda la información se persiste en dos capas: **localStorage** (caché rápido en el navegador) y **Firestore** (nube, sincronizado entre dispositivos).

---

## Interfaces TypeScript

### `BikeService` — Servicio de mantenimiento

```typescript
interface BikeService {
  // Campos principales
  id: string;                  // ID único generado (base36 + random)
  clientName: string;          // Nombre del cliente
  clientEmail: string;         // Email para notificaciones
  bikeDescription: string;     // Descripción de la bicicleta
  date: string;                // Fecha de ingreso (YYYY-MM-DD)
  phase: number;               // Fase actual: 0=Recibida, 1=Desarme, 2=Lavado, 3=Ensamble, 4=Lista
  createdAt: string;           // ISO timestamp de creación
  notes: string;               // Notas generales

  // Campos opcionales
  serviceType?: string;        // Tipo de servicio del catálogo
  startTime?: string;          // Hora de inicio (HH:MM)
  endTime?: string;            // Hora de fin estimado (HH:MM)
  technicianId?: string;       // ID del colaborador responsable
  paymentStatus?: "pendiente" | "pagado" | "adelanto";
  paymentAmount?: number;      // Monto del abono en COP (solo si paymentStatus="adelanto")
  deliveryStatus?: "en_taller" | "lista" | "entregada";
  deliverySignatureName?: string; // Nombre/firma de quien recibe la bici
  deliverySignedAt?: string;   // ISO timestamp de firma de entrega
  deliveredAt?: string;        // ISO timestamp usado como fecha general de entrega
  neededByDate?: string;       // Fecha en que el cliente necesita la bici (YYYY-MM-DD)
  completedAt?: string;        // ISO timestamp cuando llegó a fase 4
  diagnosticUpdates?: DiagnosticUpdate[];  // Historial de diagnósticos técnicos
}
```

### `DiagnosticUpdate` — Actualización de diagnóstico técnico

```typescript
interface DiagnosticUpdate {
  id: string;              // ID único (base36)
  date: string;            // ISO timestamp de la actualización
  estado: string;          // Estado general de la bici
  hallazgos: string;       // Qué se encontró en la revisión
  problemas: string;       // Problemas detectados
  recomendaciones: string; // Qué se recomienda hacer
  partes: string[];        // Lista de repuestos recomendados
  labor?: string;          // Mano de obra sugerida
}
```

### `ServiceBilling` — Trabajo final y datos para factura

```typescript
interface ServiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  type: "repuesto" | "mano_obra" | "servicio";
}

interface ServiceBilling {
  parts: ServiceLineItem[];    // Repuestos realmente usados
  labor: ServiceLineItem[];    // Mano de obra / servicios cobrados
  subtotal: number;
  advance: number;             // Abono
  total: number;
  balance: number;             // Saldo
  paymentStatus: "pendiente" | "pagado" | "adelanto";
  closedAt?: string;
  cashierId?: string;
  notes?: string;
}
```

Campos completos de `BikeService` agregados al modelo base:

```typescript
// Datos adicionales del cliente
clientPhone?: string;
clientDocument?: string;

// Ingreso digital (formato físico de taller)
intakeCondition?: string;       // Estado visible inicial de la bicicleta
intakeAccessories?: string[];   // Accesorios recibidos
intakeReportedIssue?: string;   // Falla reportada por el cliente
intakeSignatureName?: string;   // Nombre de quien entrega/autoriza
workshopStartDate?: string;     // FECHA ELABORACIÓN del formato físico (YYYY-MM-DD)
pauseNotes?: string;            // "Quedó pendiente" — notas de pausa de trabajo

// Estado interno del taller (8 fases del formato físico)
workshopStatus?: "ingresada" | "diagnostico" | "autorizada" | "desarme" |
                 "limpieza" | "inspeccion" | "ensamble" | "detalle" |
                 "prueba" | "terminada" | "entregada";

// Repuestos a cambiar (estimado / pre-inspección)
quotedParts?: QuotedPart[];

// Trabajo final
finalBilling?: ServiceBilling;
scheduledDate?: string;         // Fecha programada para el trabajo (puede diferir de date)
deliverySignatureName?: string; // Nombre/firma de quien recibe la bici
deliverySignedAt?: string;      // Momento en que se firmó la entrega
deliveredAt?: string;           // Fecha general de entrega mostrada en link cliente, historial y tarjetas
```

### `QuotedPart` — Repuesto cotizado (pre-inspección)

```typescript
interface QuotedPart {
  id: string;
  sku?: string;                // Código SKU de Loyverse
  description: string;
  quantity: number;
  unitPrice: number;
  loyverseItemId?: string;     // ID del item en Loyverse (si fue verificado con API)
  loyverseVariantId?: string;  // ID de la variante. Requerido para enviar recibos a Loyverse
}
```

### `ServiceLineItem` — Ítem de factura

```typescript
interface ServiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  type: "repuesto" | "mano_obra" | "servicio";
  sku?: string;
  loyverseItemId?: string;     // ID del item en Loyverse
  loyverseVariantId?: string;  // ID de la variante. Requerido para enviar recibos a Loyverse
}
```

### `ServiceBilling` — Trabajo final y datos para factura

```typescript
interface ServiceBilling {
  parts: ServiceLineItem[];    // Repuestos realmente usados
  labor: ServiceLineItem[];    // Mano de obra / servicios cobrados
  subtotal: number;
  advance: number;             // Abono
  total: number;
  balance: number;             // Saldo a pagar
  paymentStatus: "pendiente" | "pagado" | "adelanto";
  closedAt?: string;
  cashierId?: string;
  notes?: string;
  loyverseReceiptId?: string;  // ID del recibo creado en Loyverse
  loyverseSyncedAt?: string;   // ISO timestamp de último envío a Loyverse
}
```

**Reglas operativas importantes:**
- `diagnosticUpdates[].partes` → repuestos recomendados o posibles. NO son venta final.
- `quotedParts` → estimado/cotización de repuestos a cambiar. Visible al cliente en el link de seguimiento.
- `finalBilling.parts` → repuestos realmente usados para factura/cobro. Obligatorios para cerrar servicio.
- Si el `serviceType` contiene "Mant" (mantenimiento), al agregar repuestos usados se aplica automáticamente **20% de descuento** en el precio del repuesto. Este descuento NO aplica a mano de obra o servicios.

**Loyverse:**
- Las llamadas del navegador deben usar siempre el proxy interno `/api/loyverse/...`.
- La búsqueda por código trae nombre, precio base, `loyverseItemId` y `loyverseVariantId`; acepta SKU/barcode exacto y códigos al inicio del nombre o `handle` de Loyverse, como `CAJ001 - ...`.
- Para enviar un recibo a Loyverse, cada línea enviada debe tener `loyverseVariantId`; las líneas antiguas que solo tengan item deben volver a buscarse por código.
- Un SKU no encontrado es distinto de un error de conexión/token/proxy. La UI debe mostrar el error real cuando Loyverse no responde correctamente.
- En desarrollo local, Vite redirige `/api` hacia `https://capital-bikes.web.app` para evitar que `/api/loyverse` devuelva el HTML de la app.

### Fases internas del taller (`WORKSHOP_PHASES`)

```typescript
const WORKSHOP_PHASES = [
  { key: "diagnostico",  label: "Diagnóstico",    color: "#e8a020" },
  { key: "autorizada",   label: "Autorizada ✅",  color: "#4caf50" },  // cliente aprobó diagnóstico
  { key: "desarme",      label: "Desarme",         color: "#e8a020" },
  { key: "limpieza",     label: "Limpieza",        color: "#5cc8e8" },
  { key: "inspeccion",   label: "Inspección",      color: "#5cc8e8" },
  { key: "ensamble",     label: "Ensamble",        color: "#9c4a9e" },
  { key: "detalle",      label: "Detalle",         color: "#9c4a9e" },
  { key: "prueba",       label: "Prueba",          color: "#6c1f6e" },
  { key: "terminada",    label: "Listo entregar",  color: "#4caf50" },
];
```

La fase "autorizada" aparece con un botón prominente de confirmación cuando `workshopStatus === "diagnostico"` y existe al menos un diagnóstico guardado.

### `AppTask` — Tarea asignada

```typescript
interface AppTask {
  id: string;          // ID único
  title: string;       // Descripción de la tarea
  assignedTo: string;  // ID del colaborador
  tag: string;         // Etiqueta: GENERAL | TALLER | TIENDA | LIMPIEZA | CAJA | PEDIDO
  done: boolean;       // Completada o no
  createdAt: string;   // ISO timestamp
  date?: string;       // Fecha asignada (YYYY-MM-DD)
  hasTime?: boolean;   // Si tiene hora específica
  startTime?: string;  // HH:MM
  endTime?: string;    // HH:MM
}
```

### `Appointment` — Agendamiento de cita

```typescript
interface Appointment {
  id: string;          // ID único
  client: string;      // Nombre del cliente
  service: string;     // Servicio agendado
  assignedTo: string;  // ID del colaborador
  date: string;        // YYYY-MM-DD
  startTime: string;   // HH:MM
  endTime: string;     // HH:MM
  notes: string;       // Notas adicionales
  createdAt: string;   // ISO timestamp
}
```

### `Session` — Sesión activa

```typescript
interface Session {
  type: "admin" | "employee";
  id?: string;    // ID del colaborador (solo si type="employee")
  name?: string;  // Nombre del colaborador
  role?: string;  // Rol del colaborador
}
```

---

## Estructura en Firestore

Todo se guarda en un único documento en Firestore:

```
Colección: shop
Documento: data
```

```json
{
  "adminPassword": "string",
  "team": [
    {
      "id": "string",
      "name": "string",
      "role": "string",
      "initials": "string"
    }
  ],
  "extendedData": {
    "[memberId]": {
      "salario": "string // referencia interna de pago",
      "hourlyRate": "string // valor hora individual usado para cortes de nómina",
      "direccion": "string",
      "documento": "string",
      "eps": "string",
      "horasSemana": "string",
      "pin": "string",
      "permissions": {
        "canScheduleServices": true,
        "canEditAppointments": true,
        "canRegisterBikes": true,
        "canModifyServices": true
      }
    }
  },
  "services": [ /* array de BikeService */ ],
  "tasks": [ /* array de AppTask */ ],
  "attendanceRecords": [ /* array de AttendanceRecord */ ],
  "lunchRecords": [ /* array de LunchRecord */ ],
  "payrollConfirmations": [ /* array de PayrollConfirmation */ ],
  "appointments": [ /* array de Appointment */ ],
  "shift": {
    "[memberId]": false
  },
  "empLunch": {
    "[memberId]": false
  }
}
```

---

## Claves de localStorage

| Clave | Contenido | Cuándo se escribe |
|-------|-----------|-------------------|
| `cwb_services` | `BikeService[]` | Cuando cambian los servicios |
| `cwb_tasks` | `AppTask[]` | Cuando cambian las tareas |
| `cwb_appointments` | `Appointment[]` | Cuando cambian los agendamientos |
| `cwb_team` | Miembros del equipo | Cuando cambia el equipo |
| `cwb_ext` | `extendedData` completo | Cuando cambia algún perfil |
| `cwb_emp_cache` | `[{id, name, role, pin}]` | Al guardar extendedData o cargar Firestore |
| `cwb_shift` | Estado de inicio día | Cuando cambia el registro de inicio/cierre |
| `cwb_emp_lunch` | Estado de almuerzo por colaborador | Cuando cambia el almuerzo |
| `cwb_attendance_records` | Entradas/salidas del equipo | Al fichar, corregir o crear registros manuales |
| `cwb_lunch_records` | Registros de almuerzo | Al iniciar, cerrar o corregir almuerzos |
| `cwb_payroll_confirmations` | Confirmaciones de cortes de pago | Cuando Admin confirma o reabre un corte por ajustes |
| `cwb_admin_pwd` | Contraseña del admin (hash) | Al cambiar la contraseña |
| `cwb_session` | (sessionStorage) Sesión actual | Al hacer login/logout |

---

## Fases del servicio

```typescript
const PHASES = [
  { id: 1, name: "Desarme",            icon: "🔧", color: "#e8a020" },
  { id: 2, name: "Lavado",             icon: "💧", color: "#5cc8e8" },
  { id: 3, name: "Ensamble",           icon: "⚙️", color: "#9c4a9e" },
  { id: 4, name: "Lista para recoger", icon: "✅", color: "#4caf50" },
];
// phase === 0 → "Recibida" (recién ingresada, no en PHASES)
```

---

## Catálogo de servicios

```typescript
const SERVICES_CATALOG = [
  "Puesta a punto básica",
  "Puesta a punto completa",
  "Cambio cadena",
  "Cambio cadena + piñones",
  "Revisión frenos",
  "Revisión completa",
  "Revisión completa e-bike",
  "Montaje bici nueva",
  "Cambio rueda",
  "Otro servicio",
];
```

---

## Sincronización Firestore

El patrón de sincronización usa un `useRef` para evitar ciclos de escritura al cargar datos:

```typescript
const fbReady = useRef(false);

// Al cargar datos de Firestore → NO dispara escritura de vuelta
// Al cambiar datos por acción del usuario → SÍ escribe a Firestore
// Ejemplo:
useEffect(() => {
  localStorage.setItem("cwb_services", JSON.stringify(services));
  if (fbReady.current) saveShopData({ services });  // solo si ya cargó Firestore
}, [services]);
```

La carga inicial de Firestore tiene prioridad sobre localStorage: si existe dato en la nube, reemplaza el caché local.
