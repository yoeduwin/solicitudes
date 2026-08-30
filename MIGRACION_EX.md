# Mejora de Employee Experience — Solicitudes

Esta rama incorpora una capa de coordinación y acuerdo sin cambiar la estructura de la hoja `SOLICITUDES`.

## Qué cambia

- La vista inicial del usuario general es **Mi trabajo**; Administración conserva la vista global.
- Se agrega **En espera** con `espera de` + motivo, para distinguir un bloqueo de un incumplimiento.
- Una solicitud En espera no se marca como vencida en la interfaz ni entra al recordatorio diario hasta que se reanuda.
- La persona responsable puede **proponer una nueva fecha** y quien solicitó puede aceptarla o conservar la fecha actual.
- Cuando el responsable marca **Atendida**, quien solicitó puede elegir **Sí, cerrar** o **Requiere ajuste**.
- Se agrega **Solicitud privada**, visible solo para solicitante, responsable y Administración dentro de la aplicación.
- La prioridad **Urgente** exige una justificación breve.
- Se suaviza el lenguaje de ayuda para orientar a coordinación, no a vigilancia.

## Archivos nuevos

En el proyecto de Apps Script deben existir también:

- `Experience.gs` — lógica de privacidad, bloqueos, acuerdo de fecha y confirmación.
- `experience.html` — mejoras de interfaz y comportamiento.

`Code.gs` incluye automáticamente `experience.html` después de `scripts.html`.

## Hoja auxiliar

No hay que crearla manualmente. En la primera carga, el sistema crea la hoja:

`EXPERIENCIA`

Ahí se guardan únicamente los metadatos nuevos. Las solicitudes existentes siguen funcionando y se consideran públicas, sin bloqueo y sin propuesta de fecha hasta que se les agregue alguno de esos datos.

No se modifican los encabezados existentes de `SOLICITUDES`, `COMENTARIOS`, `HISTORIAL`, `ADJUNTOS`, `USUARIOS` ni `CONFIG`.

## Archivos modificados

- `Code.gs` — aplica privacidad al listado/detalle y usa la capa EX en altas y cambios de estado.
- `Notifications.gs` — el correo de Atendida pide confirmación y los recordatorios omiten solicitudes En espera.
- `pruebas/correr.js` — carga `Experience.gs` dentro del simulador de pruebas.

## Publicación

1. Copiar/actualizar en Apps Script los archivos de `src/` de esta rama.
2. Crear `Experience.gs` y `experience.html` si todavía no existen en el proyecto.
3. Guardar.
4. Implementar → Administrar implementaciones → Editar → **Nueva versión**.
5. Abrir la URL `/exec` con una cuenta registrada.

La hoja `EXPERIENCIA` se crea automáticamente al cargar el sistema.

## Reversibilidad

La capa es deliberadamente poco invasiva. Si se vuelve a la versión anterior, las solicitudes principales siguen intactas porque los datos nuevos están separados en `EXPERIENCIA`.
