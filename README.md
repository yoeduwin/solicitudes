# Sistema de Solicitudes Internas · Ejecutiva Ambiental

Sistema interno de solicitudes (tickets) entre áreas. Permite saber en todo momento
**qué se solicitó, quién lo solicitó, a quién se asignó, para cuándo se necesita,
en qué estado está y qué movimientos ha tenido**.

- **Backend y hosting:** Google Apps Script (Web App)
- **Base de datos:** Google Sheets
- **Adjuntos:** Google Drive
- **Notificaciones:** MailApp
- **Frontend:** HTML + Tailwind CSS (CDN) + JavaScript sin frameworks, dentro de la Web App

Este repositorio es únicamente el versionado del código; **no** hospeda el frontend.

---

## Instalación

### 1. Crear el Google Sheet

Crea una hoja de cálculo nueva en Drive, por ejemplo
**"Solicitudes Internas — Ejecutiva Ambiental"**. No hace falta crear pestañas:
el script las genera solo.

### 2. Copiar el código a Apps Script

Desde el Sheet: **Extensiones → Apps Script**. Se abre un proyecto vinculado.

Crea un archivo por cada uno de estos y pega el contenido de `src/`:

| Archivo en el editor | Tipo | Origen |
|---|---|---|
| `Code.gs` | Script | `src/Code.gs` |
| `Utils.gs` | Script | `src/Utils.gs` |
| `Config.gs` | Script | `src/Config.gs` |
| `Users.gs` | Script | `src/Users.gs` |
| `Tickets.gs` | Script | `src/Tickets.gs` |
| `Notifications.gs` | Script | `src/Notifications.gs` |
| `Drive.gs` | Script | `src/Drive.gs` |
| `index.html` | HTML | `src/index.html` |
| `styles.html` | HTML | `src/styles.html` |
| `scripts.html` | HTML | `src/scripts.html` |

En **Configuración del proyecto**, activa *"Mostrar el archivo de manifiesto
appsscript.json"* y pega el contenido de `src/appsscript.json`.

> Si usas [clasp](https://github.com/google/clasp), basta con `clasp clone <scriptId>`
> dentro de `src/` y `clasp push`.

### 3. Crear las hojas automáticamente

En el editor, selecciona la función **`instalar`** y pulsa **Ejecutar**.
Google pedirá autorización la primera vez (acepta los permisos de Sheets, Drive y Gmail).

`instalar()` crea:

- Las hojas `SOLICITUDES`, `COMENTARIOS`, `HISTORIAL`, `ADJUNTOS`, `USUARIOS` y `CONFIG`
  con sus encabezados.
- La configuración por defecto (categorías, prefijo de folio, límites de adjuntos…).
- La carpeta de Drive para adjuntos.
- Un directorio de personas de ejemplo.

Es seguro volver a ejecutarla: no borra ni duplica datos existentes.

### 4. Configurar y compartir la carpeta de Drive

`instalar()` crea la carpeta **"Solicitudes Internas - Adjuntos"** y guarda su ID en
`CONFIG → carpeta_drive_id`.

Si prefieres una carpeta propia (por ejemplo dentro de una unidad compartida):
copia su ID desde la URL de Drive
(`https://drive.google.com/drive/folders/`**`ESTE_ES_EL_ID`**) y pégalo en
`CONFIG → carpeta_drive_id`.

Los archivos **no** se hacen públicos: heredan los permisos de la carpeta.
Como la Web App se ejecuta con la identidad de quien la usa, comparte esta carpeta
con todas las personas que deban subir o abrir adjuntos.

### 5. Agregar las personas, correos y administrador

La identidad se obtiene del correo de la cuenta de Google con la que cada persona
abre la Web App. Por eso el correo ya no es opcional para operar el sistema.

Primero completa la hoja `USUARIOS` con `id`, `nombre`, `correo`, `area`, `activo`
y `admin`. Un mismo correo no puede corresponder a dos usuarios activos.

Para la primera persona administradora puedes:

- dejar a **Eduwin** con su correo y `admin = SI` en la instalación inicial; o
- ejecutar una vez `otorgarPrimerAdmin_(correo, nombre)` desde el editor.

Después, Administración puede gestionar el directorio desde la propia aplicación.

### 6. Compartir el Sheet

La Web App está configurada para ejecutarse como **el usuario que accede**. Por ello,
comparte el Google Sheet con las personas que usarán el sistema, con permisos suficientes
para leer y escribir. No hace falta que entren al Sheet para operar: la aplicación sigue
siendo la interfaz de trabajo, pero Apps Script necesita esos permisos para ejecutar.

### 7. Crear el Trigger diario

En el editor, ejecuta una vez la función **`crearTriggerDiario`**. Programa
`enviarRecordatoriosDiarios` alrededor de las 8:00 AM.

También puedes hacerlo a mano: **Activadores → Añadir activador** →
función `enviarRecordatoriosDiarios`, origen *Basado en tiempo*, *Temporizador diario*.

El trigger se ejecuta con la cuenta que lo crea; conviene crearlo desde la cuenta
administradora propietaria del sistema.

### 8. Desplegar la Web App

**Implementar → Nueva implementación → Aplicación web**:

- *Ejecutar como*: **Usuario que accede a la aplicación web**.
- *Quién tiene acceso*: **Cualquier usuario con una cuenta de Google**
  (o restringido al dominio si todo el equipo pertenece al mismo Google Workspace).

Esta configuración es necesaria para que `Session.getActiveUser().getEmail()` identifique
al usuario de forma fiable. Si se despliega como **Yo**, Apps Script puede devolver el
correo activo vacío y el sistema no podrá identificar a la persona.

La primera vez, cada usuario deberá autorizar los permisos solicitados por Apps Script.

Copia la URL `/exec` y compártela con el personal. Tras editar el código,
usa **Implementar → Administrar implementaciones → Editar → Nueva versión**.

---

## Uso

### Identidad y permisos

No existe selector **"Soy"** ni botón manual de modo. El sistema cruza el correo de la
cuenta de Google activa contra `USUARIOS` y muestra la persona detectada.

| Acción | Usuario activo | Administración |
|---|---|---|
| Crear, consultar y comentar solicitudes | ✅ | ✅ |
| Ver solicitudes | ✅ | ✅ |
| Estados Pendiente / En proceso / Atendida | ✅ | ✅ |
| Reasignar responsable | — | ✅ |
| Editar datos de la solicitud | — | ✅ |
| Cerrar y Cancelar | — | ✅ |
| Administrar el directorio | — | ✅ |

Los permisos administrativos se validan también en el servidor mediante la columna
`admin`; no dependen de un botón, parámetro o selección enviada desde el navegador.

El formulario permite registrar una solicitud a nombre de otra persona, pero el historial
siempre conserva como actor real a quien tenía la sesión abierta.

### Guía de uso dentro de la app

El botón **Ayuda** de la barra superior abre la guía de *cuándo levantar una solicitud y
cuándo no*, los cinco estados explicados y las reglas de convivencia. Se abre sola la
primera vez que alguien entra desde ese navegador.

El formulario de **Nueva solicitud** repite el criterio en corto, en el momento en que
importa: si se resuelve con un mensaje en los próximos minutos, no hace falta levantarla.

Los controles principales tienen **tooltips** al pasar el cursor (en pantallas táctiles se
desactivan, donde estorbarían). Para cambiar los textos, busca `data-tip="…"` en
`index.html` y en la función `pintarDetalle` de `scripts.html`.

### Estados y vencimiento

`Pendiente` · `En proceso` · `Atendida` · `Cerrada` · `Cancelada`

**Vencida no es un estado.** Se calcula: la fecha límite ya pasó *y* el estado no es
Atendida, Cerrada ni Cancelada. Se muestra como marca sobre el estado real —
por ejemplo `En proceso · VENCIDA`.

### Prioridades

`Normal` · `Alta` · `Urgente`. Sin SLA por horas: cada solicitud lleva su fecha límite.

### Folio

`SI-260829-001` → prefijo + `AAMMDD` + consecutivo del día. Se genera bajo
`LockService`, igual que toda escritura, para evitar duplicados por concurrencia.

### Correos

Se envía correo solo en eventos relevantes:

| Evento | Destinatario |
|---|---|
| Se crea una solicitud | Responsable |
| Se reasigna | Nuevo responsable |
| Se marca como Atendida | Solicitante |
| Comentario con **"Notificar por correo"** activo | La contraparte |
| Trigger diario | Un correo consolidado por responsable |

El recordatorio diario agrupa por persona en tres bloques —vencidas, vencen hoy y
próximas a vencer— en **un solo correo**, nunca uno por ticket.

Si un envío falla, la solicitud **no se pierde**: el fallo queda en `HISTORIAL`
y la operación continúa.

### Adjuntos

PDF, JPG y PNG. Máximo 5 archivos de 5 MB cada uno (ajustable en `CONFIG`).
Se validan en el navegador y otra vez en el servidor.

---

## Configuración (hoja `CONFIG`)

| Clave | Para qué sirve |
|---|---|
| `nombre_sistema` | Título mostrado en la aplicación |
| `categorias` | Categorías disponibles, separadas por `|` |
| `carpeta_drive_id` | Carpeta de Drive para los adjuntos |
| `prefijo_folio` | Prefijo del folio (`SI` por defecto) |
| `dias_proximos_vencer` | Anticipación del aviso "próximas a vencer" |
| `notificaciones_activas` | `SI` / `NO` — interruptor general del correo |
| `correo_copia_admin` | Correo que recibe copia de las notificaciones |
| `max_archivos` | Máximo de adjuntos por solicitud |
| `max_mb_archivo` | Tamaño máximo por archivo en MB |

Los cambios aplican en la siguiente carga de la aplicación.

---

## Modelo de datos

- **SOLICITUDES** — `id`, `folio`, `created_at`, `solicitante_nombre`, `solicitante_email`,
  `responsable_nombre`, `responsable_email`, `categoria`, `prioridad`, `titulo`,
  `descripcion`, `cliente_proyecto` *(opcional)*, `fecha_limite`, `estado`, `updated_at`,
  `fecha_atendida`, `fecha_cierre`
- **COMENTARIOS** — `id`, `solicitud_id`, `fecha`, `autor_nombre`, `autor_email`,
  `comentario`, `notificar`
- **HISTORIAL** — `id`, `solicitud_id`, `fecha`, `actor`, `accion`, `detalle`
  (creación, cambio de estado, reasignación, comentarios, cierre, cancelación,
  edición y fallos de notificación)
- **ADJUNTOS** — `id`, `solicitud_id`, `fecha`, `drive_id`, `nombre`, `tipo`, `tamano`, `url`
- **USUARIOS** — `id`, `nombre`, `correo`, `area`, `activo`, `admin`
- **CONFIG** — `clave`, `valor`, `descripcion`

No edites los encabezados de la fila 1: el código lee las columnas por nombre.

---

## Pruebas

La lógica del backend se puede correr fuera de Google con un simulador de los
servicios de Apps Script:

```bash
node pruebas/correr.js
```

Cubre folios consecutivos, validaciones, cálculo de vencidas, permisos de
Administración, identidad por correo, rechazo de cuentas no registradas, correos
duplicados, notificaciones, historial y la garantía de que un fallo de correo no pierde
la solicitud.

---

## Rendimiento

Apps Script tarda 1–2 s en arrancar en frío; eso no se puede evitar. Lo que sí se hizo:

- **Un solo viaje por operación.** Cambiar estado, comentar, reasignar o editar devuelven
  ya la solicitud con sus comentarios, historial y adjuntos (`conDetalle_` en `Code.gs`),
  en vez de encadenar una segunda llamada a `apiDetalle`.
- **Caché de lectura por ejecución** (`cacheLeer_` en `Utils.gs`). Antes, una sola petición
  releía la hoja `CONFIG` tres o cuatro veces y `USUARIOS` dos.
- **Sin relecturas tras escribir.** Las operaciones arman la respuesta con los datos que ya
  tienen en memoria (`fusionar_`) en lugar de volver a leer la hoja.
- **Esqueletos de carga** en vez de un texto "Cargando…", y la solicitud abre mostrando de
  inmediato lo que ya está en memoria mientras llegan historial y comentarios.

El envío de correo **sigue siendo síncrono**: al crear una solicitud o marcarla como
Atendida, la respuesta espera a que MailApp termine. Se mantuvo así a propósito, porque es
lo que permite registrar en `HISTORIAL` si el correo falló.

## Estructura

```
src/
  appsscript.json     Manifiesto (zona horaria, scopes, Web App)
  Code.gs             doGet + API expuesta a google.script.run
  Utils.gs            Acceso a Sheets, fechas, validación, LockService
  Config.gs           Hoja CONFIG, instalar(), crearTriggerDiario()
  Users.gs            Directorio de personas e identidad de sesión
  Tickets.gs          Solicitudes, estados, comentarios, historial
  Notifications.gs    Correos y recordatorio diario consolidado
  Drive.gs            Carpeta y guardado de adjuntos
  index.html          Estructura de la interfaz
  styles.html         Clases de apoyo sobre Tailwind
  scripts.html        Lógica del frontend
pruebas/
  correr.js           Ejecutor de pruebas
  simulador.js        Simulación de los servicios de Apps Script
  pruebas.js          Aserciones
```