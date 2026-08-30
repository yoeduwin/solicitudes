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

Lo más cómodo es entrar luego desde **Extensiones → Apps Script** en esa misma hoja: el
proyecto queda vinculado y te ahorras el paso 3. Si ya creaste el proyecto por separado
en `script.google.com`, no pasa nada — el paso 3 resuelve el vínculo.

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

### 3. Asignar la hoja (solo si el proyecto es independiente)

Hay dos formas de tener el proyecto, y solo una necesita este paso:

- **Proyecto vinculado** — lo creaste desde **Extensiones → Apps Script** dentro del Sheet.
  No hagas nada: el código toma la hoja que lo contiene. **Salta al paso 4.**
- **Proyecto independiente** — lo creaste desde `script.google.com`. Google **no permite
  vincularlo a un Sheet después**; en su lugar se le indica qué hoja usar:

  1. Abre tu Google Sheet y copia su URL completa.
  2. En el editor de Apps Script, selecciona la función **`configurarHoja`**.
  3. Ejecútala una vez pasándole la URL o el ID. Como el editor no permite escribir
     argumentos, agrega temporalmente una función así y ejecútala:

     ```javascript
     function asignarMiHoja() {
       configurarHoja('https://docs.google.com/spreadsheets/d/PEGA_AQUI_EL_ID/edit');
     }
     ```

     Acepta la URL completa o solo el ID. Guarda el valor en las propiedades del script,
     así que **se hace una sola vez**; después puedes borrar esa función.

> Si no quieres lidiar con esto, la alternativa es empezar de cero: crea el Sheet, entra por
> **Extensiones → Apps Script** y pega ahí el código. Queda vinculado desde el inicio.

### 4. Crear las hojas automáticamente

En el editor, selecciona la función **`instalar`** y pulsa **Ejecutar**.
Google pedirá autorización la primera vez (acepta los permisos de Sheets, Drive y Gmail).

`instalar()` crea:

- Las hojas `SOLICITUDES`, `COMENTARIOS`, `HISTORIAL`, `ADJUNTOS`, `USUARIOS` y `CONFIG`
  con sus encabezados.
- La configuración por defecto (categorías, prefijo de folio, límites de adjuntos…).
- La carpeta de Drive para adjuntos.
- Un directorio de personas de ejemplo (sin correos).

Es seguro volver a ejecutarla: no borra ni duplica datos existentes.

### 5. Configurar la carpeta de Drive

`instalar()` crea la carpeta **"Solicitudes Internas - Adjuntos"** y guarda su ID en
`CONFIG → carpeta_drive_id`.

Si prefieres una carpeta propia (por ejemplo dentro de una unidad compartida):
copia su ID desde la URL de Drive
(`https://drive.google.com/drive/folders/`**`ESTE_ES_EL_ID`**) y pégalo en
`CONFIG → carpeta_drive_id`.

Los archivos **no** se hacen públicos: heredan los permisos de la carpeta.
Comparte esa carpeta con el personal que deba abrir los adjuntos.

### 6. Agregar las personas y sus correos

Dos caminos, equivalentes:

- **Desde la hoja `USUARIOS`**: llena `id` (cualquier texto único), `nombre`, `correo`,
  `area` y `activo` (`SI` / `NO`).
- **Desde la aplicación**: cambia a modo **Administración** y abre **Directorio**.

Sin correo, la persona aparece en los catálogos pero no recibe notificaciones
(el sistema lo avisa en pantalla y lo registra en el historial).

### 7. Crear el Trigger diario

En el editor, ejecuta una vez la función **`crearTriggerDiario`**. Programa
`enviarRecordatoriosDiarios` alrededor de las 8:00 AM.

También puedes hacerlo a mano: **Activadores → Añadir activador** →
función `enviarRecordatoriosDiarios`, origen *Basado en tiempo*, *Temporizador diario*.

### 8. Desplegar la Web App

**Implementar → Nueva implementación → Aplicación web**:

- *Ejecutar como*: **Yo** (así todos escriben en el mismo Sheet y Drive).
- *Quién tiene acceso*: **Cualquier usuario de <tu dominio>**
  (o *Cualquier usuario con la cuenta de Google*, según convenga).

Copia la URL `/exec` y compártela con el personal. Tras editar el código,
usa **Implementar → Administrar implementaciones → Editar → Nueva versión**.

---

## Uso

### Modos

Sin usuarios ni contraseñas. Cada persona elige su nombre en **"Soy"** (se recuerda
en el navegador) y el botón **Modo** alterna entre General y Administración.

| | General | Administración |
|---|---|---|
| Crear, consultar y comentar solicitudes | ✅ | ✅ |
| Ver las propias y las asignadas | ✅ | ✅ |
| Estados Pendiente / En proceso / Atendida | ✅ | ✅ |
| Ver todas las solicitudes | ✅ | ✅ |
| Reasignar responsable | — | ✅ |
| Editar datos de la solicitud | — | ✅ |
| Cerrar y Cancelar | — | ✅ |
| Administrar el directorio | — | ✅ |

El cambio de modo es por confianza; en esta versión no hay autenticación administrativa.
Aun así, el backend rechaza cerrar o cancelar cuando la llamada no viene en modo
Administración, y valida todos los datos por su cuenta.

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
| `max_mb_archivo` | Tamaño máximo por archivo, en MB |

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
- **USUARIOS** — `id`, `nombre`, `correo`, `area`, `activo` (catálogo, no cuentas)
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
Administración, notificaciones, historial y la garantía de que un fallo de correo
no pierde la solicitud.

---

## Estructura

```
src/
  appsscript.json     Manifiesto (zona horaria, scopes, Web App)
  Code.gs             doGet + API expuesta a google.script.run
  Utils.gs            Acceso a Sheets (configurarHoja), fechas, validación, LockService
  Config.gs           Hoja CONFIG, instalar(), crearTriggerDiario()
  Users.gs            Directorio de personas
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
