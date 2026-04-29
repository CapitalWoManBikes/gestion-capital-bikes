# Capital Wo-Man Bikes — Sistema de Gestión de Taller

Sistema web interno para la gestión operativa del taller de bicicletas **Capital Wo-Man Bikes**. Permite administrar el equipo de trabajo, servicios de mantenimiento, seguimiento de clientes, tareas, turnos y comunicación automática por email.

**URL de producción:** [equipocapital.netlify.app](https://equipocapital.netlify.app)

---

## Tabla de contenidos

- [Características principales](#características-principales)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Primeros pasos (desarrollo local)](#primeros-pasos-desarrollo-local)
- [Despliegue en producción](#despliegue-en-producción)
- [Módulos del sistema](#módulos-del-sistema)
- [Modelo de datos](#modelo-de-datos)
- [Autenticación y PINs](#autenticación-y-pins)
- [Configuración de servicios externos](#configuración-de-servicios-externos)
- [Historial de versiones](#historial-de-versiones)

---

## Características principales

| Área | Funcionalidades |
|------|----------------|
| **Servicios** | Registro de bicis, fases de mantenimiento, diagnóstico técnico, repuestos, pago, entrega |
| **Clientes** | Link de seguimiento personal, notificaciones automáticas por email en cada fase |
| **Equipo** | Perfiles, PINs de acceso, permisos por colaborador |
| **Turnos** | Fichaje de entrada/salida, estado de almuerzo, timer en tiempo real |
| **Tareas** | Asignación por colaborador con fecha y hora |
| **Calendario** | Vista semanal unificada: servicios, tareas y agendamientos |
| **Dashboard** | Estado del equipo en tiempo real, banners dinámicos |
| **Persistencia** | Firestore (nube) + localStorage (caché offline) |

---

## Stack tecnológico

```
React 19 + TypeScript     → UI y lógica de negocio
Vite 8                    → Bundler y servidor de desarrollo
Firebase Firestore        → Base de datos en la nube (proyecto: capital-bikes)
EmailJS                   → Envío de emails al cliente sin backend
Netlify                   → Hosting y despliegue continuo desde GitHub
```

---

## Estructura del proyecto

```
/
├── src/
│   ├── App.tsx          # Toda la aplicación (componentes, lógica, estilos)
│   ├── firebase.ts      # Configuración de Firestore y helpers de persistencia
│   ├── main.tsx         # Entry point de React
│   └── App.css          # Estilos base (mínimos, la mayoría están inline)
├── public/              # Archivos estáticos
├── dist/                # Build de producción (generado, no versionado)
├── docs/                # Documentación técnica adicional
│   ├── modulos.md       # Guía de cada módulo
│   ├── datos.md         # Modelo de datos completo
│   └── configuracion.md # Guía de configuración (Firebase, EmailJS, PINs)
├── index.html
├── package.json
└── vite.config.ts
```

> **Nota:** La aplicación es un Single File Component — toda la UI y lógica vive en `src/App.tsx`. Esto facilita el mantenimiento para un equipo pequeño sin infraestructura compleja.

---

## Primeros pasos (desarrollo local)

### Requisitos
- Node.js 18 o superior
- npm 9 o superior

### Instalación

```bash
# Clonar el repositorio
git clone https://github.com/CapitalWoManBikes/gestion-capital-bikes.git
cd gestion-capital-bikes

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (http://localhost:5173)
npm run dev
```

### Comandos disponibles

```bash
npm run dev      # Servidor de desarrollo con HMR
npm run build    # Build de producción en /dist
npm run preview  # Vista previa del build local
npm run lint     # Verificación de código con ESLint
```

---

## Despliegue en producción

El despliegue es automático mediante **Netlify + GitHub**:

1. Cada `git push` a la rama `master` dispara un build en Netlify
2. Netlify ejecuta `npm run build`
3. El contenido de `/dist` se publica en [equipocapital.netlify.app](https://equipocapital.netlify.app)

**No se requiere ninguna acción manual para desplegar.**

Para forzar un redespliegue sin cambios de código, puedes hacer un commit vacío:
```bash
git commit --allow-empty -m "redeploy" && git push
```

---

## Módulos del sistema

Ver documentación detallada en [`docs/modulos.md`](docs/modulos.md).

### Resumen rápido

| Módulo | Ruta en la app | Descripción |
|--------|---------------|-------------|
| Dashboard | `dash` | Estado del equipo, banners de turno/almuerzo |
| Servicios | `servicios` | Gestión completa de bicis en taller |
| Calendario | `cal` | Vista semanal unificada |
| Tareas | `tareas` | Asignación y seguimiento de tareas |
| Turnos | `turno` | Fichajes de entrada/salida |
| Almuerzo | `lunch` | Estado de pausa de almuerzo |
| Perfil del equipo | `perfil` | Datos, PIN y permisos por colaborador |
| Vista cliente | `?track=...` | Seguimiento público del servicio |

---

## Modelo de datos

Ver documentación completa en [`docs/datos.md`](docs/datos.md).

### Entidades principales

- **`BikeService`** — Servicio de mantenimiento (cliente, bici, fases, pago, diagnóstico)
- **`AppTask`** — Tarea asignada a un colaborador
- **`Appointment`** — Agendamiento de cita
- **`DiagnosticUpdate`** — Actualización técnica de un servicio
- **`Session`** — Sesión activa (admin o colaborador)

---

## Autenticación y PINs

El sistema tiene **dos tipos de acceso**:

| Tipo | Cómo se accede | Qué puede hacer |
|------|---------------|-----------------|
| **Administrador** | Contraseña (configurable desde la app) | Acceso completo a todos los módulos |
| **Colaborador** | PIN de 4 dígitos (asignado en Perfil) | Dashboard personal, servicios asignados, calendario |

Los PINs se configuran desde **Administración → Perfil del equipo → editar colaborador**.

Ver más detalles en [`docs/configuracion.md`](docs/configuracion.md).

---

## Configuración de servicios externos

Ver guía completa en [`docs/configuracion.md`](docs/configuracion.md).

### Resumen

| Servicio | Para qué | Dónde configurar |
|----------|----------|-----------------|
| **Firebase Firestore** | Base de datos en la nube | `src/firebase.ts` |
| **EmailJS** | Emails automáticos al cliente | Constantes en `src/App.tsx` |

---

## Historial de versiones

| Versión | Fecha | Cambios principales |
|---------|-------|---------------------|
| **v1.1** | Abr 2026 | Diagnóstico técnico, repuestos, fecha límite cliente, emails mejorados, logo blanco en vista cliente |
| **v1.0** | Abr 2026 | Versión inicial: servicios, equipo, turnos, calendario, PINs, Firestore |

Ver [releases completos en GitHub](https://github.com/CapitalWoManBikes/gestion-capital-bikes/releases).
