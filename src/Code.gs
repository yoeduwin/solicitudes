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
  var contenido = HtmlService.createHtmlOutputFromFile(nombre).getContent();
  // La capa de Employee Experience se carga después del frontend base para poder
  // enriquecerlo sin duplicar ni reescribir todo scripts.html.
  if (nombre === 'scripts') {
    contenido += '\n' + HtmlService.createHtmlOutputFromFile('experience').getContent();
  }
  return contenido;
}

/* ------------------------------------------------------------------ */
/* Carga inicial                                                       */
/* ------------------------------------------------------------------ */

/** Catálogos + solicitudes visibles para la sesión actual en una sola llamada. */
function apiInicio() {
  return ejecutar_('apiInicio', function () {
    var yo = exigirUsuarioActual_();
    var cfg = leerConfig_();
    return {
      nombre_sistema: texto_(cfg.nombre_sistema) || 'Solicitudes Internas',
      usuarios: listarUsuarios_(false),
      categorias: categorias_(),
      estados: ESTADOS.concat(['En espera']),
      estados_admin: ESTADOS_ADMIN,
      prioridades: PRIORIDADES,
      max_archivos: limiteArchivos_(),
      max_mb_archivo: Math.round(limiteBytesArchivo_() / 1048576),
      hoy: hoyISO_(),
      solicitudes: listarSolicitudesExperiencia_(yo),
      sesion: { correo: yo.correo, usuario: yo }
    };
  });
}

function apiListarSolicitudes() {
  return ejecutar_('apiListarSolicitudes', function () {
    var yo = exigirUsuarioActual_();
    return { solicitudes: listarSolicitudesExperiencia_(yo), hoy: hoyISO_() };
  });
}

function apiDetalle(id) {
  return ejecutar_('apiDetalle', function () {
    var yo = exigirUsuarioActual_();
    if (!texto_(id)) throw new Error('Falta el identificador de la solicitud.');
    return detalleSolicitudExperiencia_(texto_(id), yo);
  });
}

/* ------------------------------------------------------------------ */
/* Operaciones                                                         */
/* ------------------------------------------------------------------ */

/**
 * Compatibilidad con llamadas existentes: mantiene el detalle completo en la
 * respuesta para que el frontend no haga una segunda llamada.
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
    return crearSolicitudExperiencia_(payload, yo);
  });
}

function apiCambiarEstado(id, estado, motivo) {
  return ejecutar_('apiCambiarEstado', function () {
    var yo = exigirUsuarioActual_();
    exigirAccesoSolicitudExperiencia_(texto_(id), yo);
    return conDetalleExperiencia_(
      cambiarEstadoExperiencia_(texto_(id), estado, yo, motivo), yo);
  });
}

function apiAgregarComentario(id, payload) {
  return ejecutar_('apiAgregarComentario', function () {
    var yo = exigirUsuarioActual_();
    exigirAccesoSolicitudExperiencia_(texto_(id), yo);
    return conDetalleExperiencia_(agregarComentario_(texto_(id), yo, payload), yo);
  });
}

/* --- Administración ------------------------------------------------ */

function apiReasignar(id, responsableId) {
  return ejecutar_('apiReasignar', function () {
    var yo = exigirAdmin_();
    return conDetalleExperiencia_(reasignar_(texto_(id), responsableId, yo.nombre), yo);
  });
}

function apiActualizarSolicitud(id, cambios) {
  return ejecutar_('apiActualizarSolicitud', function () {
    var yo = exigirAdmin_();
    return conDetalleExperiencia_(actualizarSolicitud_(texto_(id), cambios, yo.nombre), yo);
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
