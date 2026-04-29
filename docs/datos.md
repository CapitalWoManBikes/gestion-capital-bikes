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
}
```

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
      "salario": "string",
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
| `cwb_shift` | Estado de turnos | Cuando cambia el turno |
| `cwb_emp_lunch` | Estado de almuerzo por colaborador | Cuando cambia el almuerzo |
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
