# Guía de configuración — Capital Wo-Man Bikes

Esta guía explica cómo configurar y mantener los servicios externos (Firebase, EmailJS) y las opciones operativas del sistema (contraseña, PINs, equipo).

---

## 1. Firebase Firestore

### Proyecto actual

| Dato | Valor |
|------|-------|
| Proyecto | `capital-bikes` |
| Firestore | `capital-bikes.firebaseapp.com` |
| Documento | `shop/data` |

La configuración está en `src/firebase.ts`. Si en algún momento se necesita migrar a otro proyecto de Firebase, editar el objeto `firebaseConfig` en ese archivo.

### Reglas de seguridad de Firestore

El documento `shop/data` está configurado para ser de lectura y escritura pública (sin autenticación Firebase). Esto es intencional porque la autenticación se maneja dentro de la propia app (contraseña de admin + PINs). Si se desea agregar seguridad adicional en el futuro, se pueden configurar reglas en la consola de Firebase:

```
// Firestore Rules (ejemplo restrictivo)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /shop/data {
      allow read, write: if true; // Cambiar según necesidad
    }
  }
}
```

---

## 2. EmailJS

El sistema usa EmailJS para enviar correos al cliente **sin necesidad de backend**. Los emails se envían desde el navegador del usuario.

### Credenciales actuales

Las constantes están en `src/App.tsx`, líneas 6-9:

```typescript
const EMAILJS_SERVICE_ID          = "service_dzchw0a";
const EMAILJS_TEMPLATE_ID         = "2ux0vlp";
const EMAILJS_SERVICE_TEMPLATE_ID = "template_fcgenmc";
const EMAILJS_PUBLIC_KEY          = "UgKvCtUeZVka8ji8t";
const ADMIN_EMAIL                 = "capital.woman.bikes@gmail.com";
```

### Templates de EmailJS

El sistema usa el template `template_fcgenmc` para todos los emails de servicio. Los parámetros que recibe son:

| Parámetro | Contenido |
|-----------|-----------|
| `email` / `client_email` | Email del destinatario |
| `client_name` | Nombre del cliente |
| `bike_description` | Descripción de la bicicleta |
| `phase_name` | Nombre de la fase actual |
| `phase_icon` | Emoji de la fase |
| `phase_message` | Mensaje personalizado según el evento |
| `tracking_link` | URL del link de seguimiento |

### Cuándo se envían emails

| Evento | Mensaje enviado |
|--------|----------------|
| Se registra una bici | "Hemos recibido tu bicicleta... 1 a 5 días hábiles..." |
| Se avanza a Desarme (fase 1) | "Tu bici está siendo desarmada para su revisión." |
| Se avanza a Lavado (fase 2) | "Tu bici está siendo limpiada a fondo." |
| Se avanza a Ensamble (fase 3) | "Tu bici está siendo ensamblada y ajustada." |
| Se avanza a Lista (fase 4) | "Lista para entrega... 5 días para recoger... $4.000/día bodegaje" |
| Admin presiona "Notificar cliente" | Reenvía el email de la fase actual |

### Si el email falla

Si aparece un error `❌ No se pudo enviar el email`, verificar:

1. Las credenciales en `src/App.tsx` coincidan con las de la cuenta EmailJS
2. El template `template_fcgenmc` esté activo en [dashboard.emailjs.com](https://dashboard.emailjs.com)
3. El servicio `service_dzchw0a` esté conectado a la cuenta de Gmail correcta
4. La cuenta EmailJS no haya excedido el límite mensual de emails gratuitos (200/mes en plan Free)

---

## 3. Contraseña de administrador

La contraseña de administrador se puede cambiar desde la propia app sin tocar el código:

1. Ir a la pantalla de login
2. Hacer clic en "Cambiar contraseña"
3. Ingresar la contraseña actual y la nueva
4. La nueva contraseña se guarda en localStorage y se sincroniza con Firestore

La contraseña se almacena en localStorage bajo la clave `cwb_admin_pwd` y en Firestore en el campo `adminPassword`.

> **Contraseña por defecto:** si no se ha configurado nunca, la contraseña es `cwb2024` (definida en el código como `DEFAULT_PASSWORD`).

---

## 4. Gestión del equipo y PINs

### Agregar un colaborador

1. Ir a **Dashboard → Perfil del equipo**
2. Hacer clic en **"+ Añadir miembro"**
3. Ingresar nombre y rol
4. Ir al perfil del colaborador para completar datos (salario, documento, PIN, etc.)

### Configurar PIN de un colaborador

1. Ir a **Perfil del equipo**
2. Seleccionar el colaborador
3. Hacer clic en el ícono de edición
4. Ingresar el PIN de 4 dígitos en el campo "PIN DE ACCESO COLABORADOR"
5. Guardar

El PIN se sincroniza con Firestore y el caché de PINs se actualiza automáticamente. El colaborador puede iniciar sesión desde cualquier dispositivo.

### Configurar permisos

En la misma pantalla de edición del colaborador, se pueden activar o desactivar los permisos:

| Permiso | Descripción |
|---------|------------|
| Agendar servicios | Puede crear nuevos servicios desde su dashboard |
| Editar agendamientos | Puede modificar citas |
| Registrar bicis | Puede registrar el ingreso de bicicletas |
| Modificar servicios | Puede editar servicios existentes |

Todos están activos por defecto.

---

## 5. Despliegue en Netlify

El sitio está conectado al repositorio de GitHub. Configuración de Netlify:

| Ajuste | Valor |
|--------|-------|
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | 18 (o superior) |
| Branch de producción | `master` |

Cada push a `master` activa un despliegue automático. No se necesitan variables de entorno en Netlify porque las credenciales están en el código fuente (apropiado para un sistema interno de uso privado).

---

## 6. Link de seguimiento del cliente

El link de seguimiento se genera automáticamente al crear un servicio. Tiene este formato:

```
https://equipocapital.netlify.app/?track=BASE64_ENCODED_DATA
```

El dato codificado incluye toda la información del servicio necesaria para mostrar la vista al cliente (nombre, bici, fase actual, diagnósticos, fecha límite, etc.). No se requiere consulta a la base de datos para cargar esta vista.

Para obtener el link de cualquier servicio existente:
1. Ir a **Servicios**
2. En la tarjeta del servicio → botón **"🔗 Copiar link"**
3. El link se copia al portapapeles

> **Nota:** Si el servicio avanza de fase, el link antiguo seguirá mostrando la fase anterior. Siempre usar el botón "Copiar link" para obtener el link actualizado.

---

## 7. Respaldo y recuperación de datos

### Respaldo automático

Firestore guarda todos los datos en la nube en tiempo real. No se necesita respaldo manual.

### Si localStorage se pierde

Si el localStorage del navegador se borra (por ejemplo, al limpiar el historial), la app recupera todos los datos de Firestore en la próxima carga. La pantalla mostrará "CARGANDO..." durante unos segundos.

### Exportar datos manualmente

Desde la consola de Firebase ([console.firebase.google.com](https://console.firebase.google.com)), en el proyecto `capital-bikes`, se puede ver y exportar el documento `shop/data` con toda la información del taller.

---

## 8. Solución de problemas comunes

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| PIN no funciona | La app no ha terminado de cargar | Esperar a que desaparezca "CARGANDO..." |
| Pantalla blanca al entrar con PIN | Error en el dashboard del colaborador | Recargar la página, reportar el error |
| Email no llega al cliente | EmailJS sin cuota o template mal configurado | Ver sección de EmailJS arriba |
| Datos no se actualizan en otro dispositivo | Firestore tarda un momento | Recargar la página |
| App no carga | Error de conexión a Firebase | Verificar conexión a internet |
