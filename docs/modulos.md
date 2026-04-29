# Guía de módulos — Capital Wo-Man Bikes

Esta guía explica el funcionamiento de cada módulo del sistema desde el punto de vista operativo y técnico.

---

## Índice

1. [Login y acceso](#1-login-y-acceso)
2. [Dashboard (Mi equipo)](#2-dashboard-mi-equipo)
3. [Módulo de Servicios](#3-módulo-de-servicios)
4. [Calendario](#4-calendario)
5. [Tareas](#5-tareas)
6. [Turnos y Fichajes](#6-turnos-y-fichajes)
7. [Almuerzo](#7-almuerzo)
8. [Perfil del equipo](#8-perfil-del-equipo)
9. [Dashboard de colaborador](#9-dashboard-de-colaborador)
10. [Vista de seguimiento del cliente](#10-vista-de-seguimiento-del-cliente)

---

## 1. Login y acceso

**Componente:** `LoginScreen`

Al abrir la app, el sistema espera a que Firestore cargue los datos antes de habilitar el formulario (indicado con "CARGANDO..."). Esto garantiza que el caché de PINs esté actualizado antes de cualquier intento de login.

### Tipos de acceso

| Quién | Credencial | Destino |
|-------|-----------|---------|
| Administrador | Contraseña (configurable) | Panel completo |
| Colaborador | PIN de 4 dígitos | Dashboard personal |

### Flujo técnico

1. Se comprueba primero la contraseña de administrador (almacenada en localStorage bajo `cwb_admin_pwd`)
2. Si no coincide, se busca en `cwb_emp_cache` (caché de PINs de colaboradores)
3. Como respaldo, se verifica directamente en `cwb_ext` + `cwb_team` para evitar fallos por caché desactualizado
4. La sesión se guarda en `sessionStorage` y se pierde al cerrar el navegador

---

## 2. Dashboard (Mi equipo)

**Componente:** `DashLista` / `DashMapa` / `DashKanban` / `DashTimeline`

Vista general del estado del equipo en tiempo real, con cuatro subvistas:

- **Lista** — tarjetas por colaborador con estado de turno y almuerzo
- **Mapa** — distribución visual del equipo en el taller
- **Kanban** — tablero de flujo (experimental)
- **Timeline** — línea de tiempo de actividad del día

### Banners dinámicos

En la parte superior del panel de administración aparecen banners contextuales:

- **Banner morado** ("en turno") — cuando uno o más colaboradores están en turno activo
- **Banner naranja** ("en almuerzo") — cuando alguien en turno ha iniciado almuerzo

Los nombres son dinámicos: se leen del estado real del equipo, no están hardcodeados.

---

## 3. Módulo de Servicios

**Componente:** `ServiceSection` + `NewServiceModal`

El núcleo operativo del taller. Gestiona el ciclo completo de un servicio de bicicleta.

### Crear un servicio

Al crear un servicio se captura:

| Campo | Obligatorio | Descripción |
|-------|------------|-------------|
| Nombre del cliente | Sí | Nombre completo |
| Email del cliente | Sí | Para notificaciones automáticas |
| Descripción de la bici | Sí | Marca, modelo, color |
| Servicio solicitado | No | Lista predefinida (`SERVICES_CATALOG`) |
| Fecha de ingreso | Sí | Default: hoy |
| Técnico asignado | No | Colaborador responsable |
| ¿Cuándo necesita la bici? | No | Fecha límite del cliente → genera alertas |
| Hora inicio / fin | No | Para el calendario |
| Estado de pago | Sí | Pendiente / Adelanto / Pagado |
| Monto del abono | Si es adelanto | Valor en COP |
| Notas | No | Observaciones adicionales |

Al crear el servicio se envía automáticamente un email al cliente con el mensaje de recepción y el link de seguimiento.

### Fases del servicio

```
0 - Recibida      → 1 - Desarme → 2 - Lavado → 3 - Ensamble → 4 - Lista para recoger
```

Cada avance de fase dispara un email automático al cliente. Al llegar a la fase 4 ("Lista para recoger"), el email incluye la política de recogida:

> Tienes **5 días calendario** para recoger la bici. Después se cobra **$4.000 COP/día** por bodegaje.

### Fecha límite y alertas de urgencia

Si se registró una fecha en "¿Cuándo necesita la bici el cliente?", el sistema calcula los días restantes y muestra un badge:

| Situación | Badge |
|-----------|-------|
| Más de 3 días | `📅 Normal (Xd)` — verde |
| 2-3 días | `⚠️ Necesaria en Xd` — naranja |
| Hoy o mañana | `🔴 Necesaria hoy/mañana` — rojo |
| Fecha vencida | `🔴 Vencida hace Xd` — rojo |

Esta alerta aparece en la tarjeta de servicio y en el calendario.

### Diagnóstico técnico

Desde cada tarjeta activa se puede agregar una actualización de diagnóstico con:

- **Estado general** — descripción del estado de la bici
- **Hallazgos** — qué se encontró al revisar
- **Problemas detectados** — fallas identificadas
- **Recomendaciones** — acciones sugeridas
- **Repuestos recomendados** — lista de repuestos (uno por línea)

El historial de diagnósticos es visible para el colaborador en la tarjeta y para el cliente en su link de seguimiento.

### Estado de pago y entrega

En cada tarjeta se puede actualizar:
- **Pago:** Pendiente / Adelanto (con monto editable) / Pagado
- **Entrega:** Marcar como entregada cuando el cliente recoge la bici

---

## 4. Calendario

**Componente:** `CalendarSection`

Vista semanal que unifica tres tipos de eventos en una misma grilla:

| Tipo | Color | Qué muestra |
|------|-------|------------|
| Servicio de bicicleta | Morado `#6c1f6e` | Cliente, bici, técnico, fase, urgencia |
| Agendamiento | Amarillo `#e8a020` | Cliente, servicio, responsable |
| Tarea | Azul `#3b82f6` | Título, asignado, etiqueta |

Hacer clic en el "+" de cualquier día abre directamente el modal de nuevo servicio con la fecha prellenada.

Las tarjetas de servicio con fecha límite crítica (rojo) se resaltan con borde rojo en el calendario.

---

## 5. Tareas

**Componente:** `TasksSection` + `AssignTaskModal`

Sistema de tareas asignables a cualquier colaborador del equipo.

Cada tarea tiene:
- Título
- Colaborador asignado
- Etiqueta (`GENERAL`, `TALLER`, `TIENDA`, `LIMPIEZA`, `CAJA`, `PEDIDO`)
- Fecha (default: hoy)
- Hora de inicio y fin (opcional)
- Estado: pendiente / completada

Las tareas completadas se marcan con checkbox y quedan en la lista para referencia del día.

---

## 6. Turnos y Fichajes

**Componente:** `ShiftSection`

Cada colaborador puede fichar su **entrada** y **salida** del turno. El sistema muestra:

- Estado actual (en turno / fuera de turno)
- Tiempo transcurrido en turno (timer en tiempo real, sin NaN)
- Historial simulado del día

El estado de turno se guarda en Firestore y se sincroniza entre dispositivos.

---

## 7. Almuerzo

**Componente:** `LunchSection`

Control del estado de pausa de almuerzo. Solo disponible para colaboradores que están **en turno activo**.

Al iniciar almuerzo:
- El estado del colaborador cambia visualmente (tarjeta naranja)
- El banner del dashboard de admin muestra quién está en almuerzo
- Se puede terminar el almuerzo desde el dashboard del colaborador o desde esta sección

---

## 8. Perfil del equipo

**Componente:** `ProfileSection` (con subcomponente `EditMemberModal`)

Gestión de información de cada colaborador:

| Campo | Descripción |
|-------|------------|
| Nombre | Nombre completo |
| Rol | Mecánico, Tienda/Caja, Administración, etc. |
| Salario | Referencia interna |
| Dirección | Domicilio |
| Documento | Cédula |
| EPS | Entidad de salud |
| Horas semanales | Default: 40h |
| PIN de acceso | 4 dígitos para login como colaborador |
| Permisos | Ver sección de permisos |

### Permisos por colaborador

Cada colaborador tiene 4 permisos activables/desactivables:

| Permiso | Qué controla |
|---------|-------------|
| `canScheduleServices` | Puede crear nuevos servicios |
| `canEditAppointments` | Puede editar agendamientos |
| `canRegisterBikes` | Puede registrar bicicletas |
| `canModifyServices` | Puede modificar servicios existentes |

Todos los permisos están activos por defecto.

---

## 9. Dashboard de colaborador

**Componente:** `EmployeeDashboard`

Vista personalizada que ven los colaboradores al iniciar sesión con su PIN. Tiene dos pestañas:

### Pestaña Inicio

- **Tarjeta de turno** — botón de entrada/salida, estado visual, botón de almuerzo
- **Mis tareas hoy** — tareas del día asignadas a este colaborador, con checkbox
- **Servicios hoy** — bicis asignadas con fecha de hoy
- **Próximos agendamientos** — citas futuras asignadas

### Pestaña Calendario

- Vista semanal completa (igual que la del admin), solo lectura

---

## 10. Vista de seguimiento del cliente

**Componente:** `CustomerTrackingView`

Página pública accesible desde el link de seguimiento enviado por email. No requiere login.

Muestra al cliente:

1. **Nombre y descripción de la bici**
2. **Fecha límite** (si se registró) con badge de urgencia
3. **Progreso de fases** — línea de tiempo visual con la fase actual resaltada
4. **Historial de diagnósticos** — actualizaciones técnicas del equipo con:
   - Estado general, hallazgos, problemas, recomendaciones
   - Lista de repuestos recomendados (destacada en naranja)
5. **Política de recogida** — cuando la bici está lista, muestra el aviso de 5 días y el cobro por bodegaje, más el contador de días transcurridos

El link se genera codificando los datos del servicio en Base64 en la URL (parámetro `?track=`). No requiere backend.
