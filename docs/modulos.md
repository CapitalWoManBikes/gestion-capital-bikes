# Guía de módulos — Capital Wo-Man Bikes

Esta guía explica el funcionamiento de cada módulo del sistema desde el punto de vista operativo y técnico.

Nota de lenguaje: la operación se maneja como prestación de servicios. En textos visibles se debe evitar lenguaje laboral como "turno", "nómina", "salario", "sueldo", "jornada", "empleado" o "trabajador"; usar "servicio", "registro de servicio", "valor hora", "referencia de pago", "periodo de pago" y "colaborador/prestador" según corresponda.

---

## Índice

1. [Login y acceso](#1-login-y-acceso)
2. [Dashboard (Mi equipo)](#2-dashboard-mi-equipo)
3. [Módulo de Servicios](#3-módulo-de-servicios)
4. [Calendario](#4-calendario)
5. [Tareas](#5-tareas)
6. [Servicio y Registros](#6-servicio-y-registros)
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

- **Lista** — tarjetas por colaborador con estado de servicio iniciado y almuerzo
- **Mapa** — distribución visual del equipo en el taller
- **Kanban** — tablero de flujo (experimental)
- **Timeline** — línea de tiempo de actividad del día

### Banners dinámicos

En la parte superior del panel de administración aparecen banners contextuales:

- **Banner morado** ("servicio iniciado") — cuando uno o más colaboradores iniciaron su servicio
- **Banner naranja** ("en almuerzo") — cuando alguien con servicio iniciado ha iniciado almuerzo

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

### Ingreso digital de bicicleta

El ingreso ya no queda solo en papel. El modal de nuevo servicio captura datos base del formato de ingreso:

- Datos del cliente: nombre, email, teléfono y documento.
- Datos de la bici: descripción, servicio solicitado y técnico asignado.
- Motivo de ingreso o falla reportada por el cliente.
- Estado inicial visible de la bicicleta.
- Accesorios recibidos.
- Nombre de quien entrega/autoriza.

Estos campos quedan guardados dentro del servicio para que taller, caja y administración puedan consultarlos durante todo el ciclo.

### Fases del servicio (visibles al cliente)

```
0 - Recibida → 1 - Desarme → 2 - Lavado → 3 - Ensamble → 4 - Lista para recoger
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

### Fases internas del taller (8 pasos del formato físico)

El técnico maneja un segundo selector de fases más detallado, independiente de las fases visibles al cliente:

| Fase | Descripción | Color |
|------|-------------|-------|
| Diagnóstico | Revisión inicial de la bicicleta | Naranja |
| Autorizada ✅ | Cliente aprobó el diagnóstico — trabajo puede comenzar | Verde |
| Desarme | Desmontaje de componentes | Naranja |
| Limpieza | Lavado y desengrase | Azul claro |
| Inspección | Revisión detallada de partes | Azul claro |
| Ensamble | Montaje y ajuste de componentes | Morado |
| Detalle | Acabado final | Morado |
| Prueba | Prueba de funcionamiento | Morado oscuro |
| Listo entregar | Trabajo terminado, listo para entregar | Verde |

**Botón "Autorizar trabajo":** aparece automáticamente cuando la fase es "Diagnóstico" y existe al menos un diagnóstico guardado. Al confirmarlo, mueve el estado a "Autorizada" indicando que el cliente aprobó el presupuesto o diagnóstico.

### Edición del ingreso

Después de crear el servicio, el bloque **INGRESO DIGITAL** muestra el botón **✎ Editar** que abre un formulario inline con todos los campos:
- Nombre, email, teléfono, documento del cliente
- Técnico asignado (todo el equipo disponible)
- Fecha de entrega acordada y fecha de elaboración
- Motivo de ingreso, estado inicial, accesorios
- Entregó/Autoriza, notas generales

### Diagnóstico técnico

Desde cada tarjeta activa se puede agregar una actualización de diagnóstico con:

- **Estado general** — descripción del estado de la bici
- **Hallazgos** — qué se encontró al revisar
- **Problemas detectados** — fallas identificadas
- **Recomendaciones** — acciones sugeridas
- **Repuestos recomendados** — lista de repuestos (uno por línea)
- **Mano de obra sugerida** — trabajo posible después de la revisión

El historial de diagnósticos es visible para el colaborador en la tarjeta y para el cliente en su link de seguimiento.

Importante: los repuestos recomendados son partes posibles después de la revisión. No son todavía repuestos vendidos ni usados.

### Repuestos a cambiar (REPUESTOS A CAMBIAR)

Sección visible en cada tarjeta de servicio activo, antes y durante el trabajo:

- Permite agregar repuestos estimados con SKU (código de tienda), descripción, cantidad y precio
- El botón 🔍 busca el código en Loyverse y auto-completa nombre y precio
- Los repuestos cotizados aparecen en el **link de seguimiento del cliente** para que vea el estimado
- Son independientes de los repuestos usados finales — no afectan la factura hasta que se confirmen
- Si el servicio ya está en **Lista para recoger**, todavía se pueden marcar repuestos cotizados como instalados desde la tarjeta verde; al hacerlo pasan a la factura final.

### Permisos por rol

El sistema adapta la vista según el rol del colaborador:

| Rol | Puede ver/hacer | No puede ver |
|-----|-----------------|--------------|
| **Admin** | Todo | — |
| **Mecánico / Técnico / Taller** | Diagnósticos, fases, repuestos a cambiar | Sección de factura y cobros |
| **Caja** | Factura, cobros, pagos | Formulario de diagnóstico |

El rol se detecta automáticamente por la palabra clave en el campo "Rol" del perfil (mecánico, técnico, taller, caja).

### Trabajo final y factura interna

Antes de marcar una bici como terminada/lista para recoger, la app exige registrar el trabajo final:

- Repuestos realmente usados.
- Cantidad.
- Valor unitario.
- Mano de obra o servicios cobrados.
- Abono.
- Estado de pago.
- Observaciones finales.

La app calcula subtotal, total y saldo. Si faltan estos datos, el avance hacia "Lista para recoger" queda bloqueado. Esta información queda en `finalBilling` y sirve como base para generar factura o recibo después.

**Descuento 20% en mantenimientos:** si el servicio es de tipo "Mant..." (cualquier mantenimiento del catálogo), al agregar repuestos usados la app aplica automáticamente un 20% de descuento en el precio. El precio con descuento se muestra en verde antes de confirmar. El descuento NO aplica a mano de obra ni servicios.

**Botón "🖨 Imprimir recibo":** aparece cuando hay factura registrada. Abre una vista imprimible con los datos del cliente, la bicicleta, los ítems cobrados, totales y saldo. Al hacer clic en "Imprimir" se abre el diálogo del sistema.

**Integración Loyverse POS:** botón "🔗 Enviar a Loyverse" crea un recibo abierto (sin pago) en el POS. Solo se envían ítems que tienen código y variante Loyverse (`loyverseVariantId`). Si falla, los datos locales quedan intactos. El ID del recibo queda guardado en el servicio para trazabilidad.

Notas de conexión:
- La app consulta Loyverse por el proxy interno `/api/loyverse/...`; no se llama directo a `https://api.loyverse.com` desde el navegador.
- En desarrollo local, Vite redirige `/api` hacia el hosting de producción para que el proxy exista también en `localhost`.
- El botón "Probar conexión" valida una respuesta JSON real del catálogo. Si el token, proxy o servidor falla, muestra el error; no lo trata como producto no encontrado.
- Si un ítem viejo solo tiene `loyverseItemId` y no `loyverseVariantId`, debe volver a buscarse por código antes de enviarlo a Loyverse.

### Estado de pago y entrega

En cada tarjeta se puede actualizar:
- **Pago:** Pendiente / Adelanto (con monto editable) / Pagado
- **Entrega:** Marcar como entregada cuando el cliente recoge la bici. Al confirmar, se guarda `deliveredAt` y la fecha queda visible en el link del cliente, historial del cliente y tarjetas del módulo Servicios.

El link público de seguimiento del cliente usa un contenedor con scroll propio en móvil, independiente del panel interno de la app, para que se pueda deslizar completo desde celular.

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

## 6. Servicio y Registros

**Componente:** `ShiftSection`

Cada colaborador puede registrar **inicio** y **cierre** de su servicio. El sistema muestra:

- Estado actual (servicio iniciado / servicio sin iniciar)
- Tiempo transcurrido del servicio (timer en tiempo real, sin NaN)
- Historial real del día
- Resumen mensual por colaborador con totales netos por periodo
- Editor Admin por día para corregir inicio, cierre, tiempo calculado y almuerzo
- Confirmación Admin de periodos de pago

El estado de servicio iniciado se guarda en Firestore y se sincroniza entre dispositivos.
El tiempo neto se recalcula desde inicio/cierre menos el almuerzo registrado. Ejemplo: 9:00 a 18:00 con 90 minutos de almuerzo queda en 7h 30m netos. El valor hora se toma de cada colaborador (`extendedData[memberId].hourlyRate`), no de un valor global. Si Admin cambia un registro o almuerzo que ya estaba dentro de un periodo confirmado, esa confirmación queda en estado `requiere_revision` hasta reconfirmarla.

---

## 7. Almuerzo

**Componente:** `LunchSection`

Control del estado de pausa de almuerzo. Solo disponible para colaboradores que tienen **servicio iniciado**.

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
| Referencia de pago | Referencia interna |
| Valor hora servicio | Valor por hora individual usado en los periodos |
| Dirección | Domicilio |
| Documento | Cédula |
| EPS | Entidad de salud |
| Tiempo referencia semanal | Default: 40h |
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

- **Tarjeta de servicio** — botón de inicio/cierre, estado visual, botón de almuerzo y contador de almuerzo activo
- **Mi resumen de pagos** — tiempo neto del mes, almuerzo acumulado y periodos confirmados por Admin
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
