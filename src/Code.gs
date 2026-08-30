/**
 * Code.gs — Punto de entrada de la Web App y API expuesta a google.script.run.
 *
 * Todas las funciones api* devuelven {ok:true, datos:...} o {ok:false, error:'...'}
 * para que el frontend nunca tenga que adivinar qué pasó.
 */

function doGet() {
  var cfg = leerConfig_();
  var t = HtmlService.createTemplateFromFile('index');
  t.nombreSistema = texto_(cfg.nombre_sistema) || 'Solicitudes Internas';
  return t.evaluate()
    .setTitle(t.nombreSistema)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Permite componer index.html con styles.html y scripts.html. */
function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}

/* ------------------------------------------------------------------ */
/* Carga inicial                                                       */
/* ------------------------------------------------------------------ */

/** Catálogos + todas las solicitudes en una sola llamada. */
function apiInicio() {
  return ejecutar_('apiInicio', function () {
    // La Web App puede admitir cualquier cuenta Google autenticada para no depender
    // de un único dominio. Por eso toda lectura de datos exige además que el correo
    // de la sesión exista y esté activo en el directorio interno.
    var yo = exigirUsuarioActual_();
    var cfg = leerConfig_();
    return {
      nombre_sistema: texto_(cfg.nombre_sistema) || 'Solicitudes Internas',
      usuarios: listarUsuarios_(false),
      categorias: categorias_(),
      estados: ESTADOS,
      estados_admin: ESTADOS_ADMIN,
      prioridades: PRIORIDADES,
      max_archivos: limiteArchivos_(),
      max_mb_archivo: Math.round(limiteBytesArchivo_() / 1048576),
      hoy: hoyISO_(),
      solicitudes: listarSolicitudes_(),
      sesion: { correo: yo.correo, usuario: yo }
    };
  });
}

function apiListarSolicitudes() {
  return ejecutar_('apiListarSolicitudes', function () {
    exigirUsuarioActual_();
    return { solicitudes: listarSolicitudes_(), hoy: hoyISO_() };
  });
}

function apiDetalle(id) {
  return ejecutar_('apiDetalle', function () {
    exigirUsuarioActual_();
    if (!texto_(id)) throw new Error('Falta el identificador de la solicitud.');
    return detalleSolicitud_(texto_(id));
  });
}

/* ------------------------------------------------------------------ */
/* Operaciones                                                         */
/* ------------------------------------------------------------------ */

/**
 * Agrega comentarios, historial y adjuntos al resultado de una operación.
 *
 * Antes el frontend hacía una segunda llamada (apiDetalle) para repintar la
 * pantalla después de cada cambio. Enviando todo de una vez se elimina ese
 * viaje de ida y vuelta, que era la mitad de la espera percibida.
 */
function conDetalle_(resultado) {
  var id = resultado && resultado.solicitud ? resultado.solicitud.id : null;
  if (!id) return resultado;
  resultado.comentarios = comentariosDe_(id);
  resultado.historial = historialDe_(id);
  resultado.adjuntos = adjuntosDe_(id);
  return resultado;
}

function apiCrearSolicitud(payload) {
  return ejecutar_('apiCrearSolicitud', function () {
    var yo = exigirUsuarioActual_();
    return crearSolicitud_(payload, yo);
  });
}

function apiCambiarEstado(id, estado, motivo) {
  return ejecutar_('apiCambiarEstado', function () {
    var yo = exigirUsuarioActual_();
    return conDetalle_(cambiarEstado_(texto_(id), estado, yo.nombre, yo.admin, motivo));
  });
}

function apiAgregarComentario(id, payload) {
  return ejecutar_('apiAgregarComentario', function () {
    var yo = exigirUsuarioActual_();
    return conDetalle_(agregarComentario_(texto_(id), yo, payload));
  });
}

/* --- Administración ------------------------------------------------ */

function apiReasignar(id, responsableId) {
  return ejecutar_('apiReasignar', function () {
    var yo = exigirAdmin_();
    return conDetalle_(reasignar_(texto_(id), responsableId, yo.nombre));
  });
}

function apiActualizarSolicitud(id, cambios) {
  return ejecutar_('apiActualizarSolicitud', function () {
    var yo = exigirAdmin_();
    return conDetalle_(actualizarSolicitud_(texto_(id), cambios, yo.nombre));
  });
}

function apiListarUsuarios() {
  return ejecutar_('apiListarUsuarios', function () {
    exigirAdmin_();
    return { usuarios: listarUsuarios_(true) };
  });
}

function apiGuardarUsuario(payload) {
  return ejecutar_('apiGuardarUsuario', function () {
    exigirAdmin_();
    return { usuario: guardarUsuario_(payload), usuarios: listarUsuarios_(true) };
  });
}

/** Dispara el resumen diario a mano (útil para probar el trigger). */
function apiEnviarRecordatorios() {
  return ejecutar_('apiEnviarRecordatorios', function () {
    exigirAdmin_();
    return { resultado: enviarRecordatoriosDiarios() };
  });
}