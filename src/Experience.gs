/**
 * Experience.gs — Capa de Employee Experience sobre Solicitudes.
 *
 * Mantiene la tabla SOLICITUDES compatible con la versión anterior y guarda
 * metadatos nuevos en una hoja auxiliar EXPERIENCIA: privacidad, espera,
 * propuesta de fecha y justificación de urgencia.
 */

var EX_HOJA = 'EXPERIENCIA';
var EX_ENCABEZADOS = [
  'solicitud_id', 'privada', 'justificacion_urgente',
  'en_espera', 'espera_de', 'motivo_espera', 'estado_previo',
  'fecha_propuesta', 'motivo_propuesta', 'propuesta_por', 'propuesta_created_at',
  'updated_at'
];

var EX_ESPERA_DE = ['Solicitante', 'Cliente', 'Proveedor', 'Otro'];

function hojaExperiencia_() {
  var ss = libro_();
  var sh = ss.getSheetByName(EX_HOJA);
  if (!sh) {
    sh = ss.insertSheet(EX_HOJA);
    sh.getRange(1, 1, 1, EX_ENCABEZADOS.length).setValues([EX_ENCABEZADOS])
      .setFontWeight('bold').setBackground('#f1f5f9');
    sh.setFrozenRows(1);
  }
  return sh;
}

function leerMetasExperiencia_() {
  return cacheLeer_('ex_metas', function () {
    var sh = hojaExperiencia_();
    var filas = sh.getLastRow();
    if (filas < 2) return [];
    var datos = sh.getRange(1, 1, filas, EX_ENCABEZADOS.length).getValues();
    var salida = [];
    for (var r = 1; r < datos.length; r++) {
      if (!datos[r][0]) continue;
      var obj = { _fila: r + 1 };
      for (var c = 0; c < EX_ENCABEZADOS.length; c++) {
        obj[EX_ENCABEZADOS[c]] = normalizarCelda_(datos[r][c]);
      }
      salida.push(obj);
    }
    return salida;
  });
}

function mapaMetasExperiencia_() {
  var mapa = {};
  leerMetasExperiencia_().forEach(function (m) {
    mapa[texto_(m.solicitud_id)] = m;
  });
  return mapa;
}

function metaExperiencia_(id) {
  return mapaMetasExperiencia_()[String(id)] || { solicitud_id: String(id) };
}

function guardarMetaExperiencia_(id, cambios) {
  id = texto_(id);
  cambios = cambios || {};
  if (!id) throw new Error('Falta el identificador de la solicitud.');

  return conLock_(function () {
    var sh = hojaExperiencia_();
    var filas = sh.getLastRow();
    var fila = null;
    if (filas >= 2) {
      var ids = sh.getRange(2, 1, filas - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (texto_(ids[i][0]) === id) { fila = i + 2; break; }
      }
    }

    var actual = {};
    EX_ENCABEZADOS.forEach(function (k) { actual[k] = ''; });
    actual.solicitud_id = id;

    if (fila) {
      var vals = sh.getRange(fila, 1, 1, EX_ENCABEZADOS.length).getValues()[0];
      EX_ENCABEZADOS.forEach(function (k, idx) { actual[k] = normalizarCelda_(vals[idx]); });
    }

    Object.keys(cambios).forEach(function (k) {
      if (EX_ENCABEZADOS.indexOf(k) !== -1) actual[k] = cambios[k];
    });
    actual.updated_at = ahoraISO_();

    var salida = EX_ENCABEZADOS.map(function (k) {
      var v = actual[k];
      return v === undefined || v === null ? '' : v;
    });

    if (fila) sh.getRange(fila, 1, 1, salida.length).setValues([salida]);
    else sh.appendRow(salida);

    cacheOlvidar_('ex_metas');
    return actual;
  });
}

function copiarPlano_(obj) {
  var salida = {};
  Object.keys(obj || {}).forEach(function (k) { salida[k] = obj[k]; });
  return salida;
}

function decorarSolicitudExperiencia_(solicitud, meta) {
  var s = copiarPlano_(solicitud);
  meta = meta || {};

  s.estado_base = s.estado;
  s.privada = esVerdadero_(meta.privada);
  s.justificacion_urgente = texto_(meta.justificacion_urgente);
  s.en_espera = esVerdadero_(meta.en_espera);
  s.espera_de = texto_(meta.espera_de);
  s.motivo_espera = texto_(meta.motivo_espera);
  s.estado_previo = texto_(meta.estado_previo);
  s.fecha_propuesta = aFechaISO_(meta.fecha_propuesta);
  s.motivo_propuesta = texto_(meta.motivo_propuesta);
  s.propuesta_por = texto_(meta.propuesta_por);
  s.propuesta_created_at = texto_(meta.propuesta_created_at);
  s.propuesta_pendiente = !!s.fecha_propuesta;
  s.requiere_confirmacion = s.estado_base === 'Atendida';

  if (s.en_espera && ESTADOS_NO_VENCIBLES.indexOf(s.estado_base) === -1) {
    s.estado = 'En espera';
    // Un bloqueo explícito no debe presentarse como incumplimiento del responsable.
    s.vencida = false;
    s.vence_hoy = false;
  }

  return s;
}

function mismoCorreo_(a, b) {
  return texto_(a).toLowerCase() && texto_(a).toLowerCase() === texto_(b).toLowerCase();
}

function esSolicitanteExperiencia_(s, yo) {
  return !!(yo && mismoCorreo_(s.solicitante_email, yo.correo));
}

function esResponsableExperiencia_(s, yo) {
  return !!(yo && mismoCorreo_(s.responsable_email, yo.correo));
}

function esParteExperiencia_(s, yo) {
  return !!(yo && (yo.admin || esSolicitanteExperiencia_(s, yo) || esResponsableExperiencia_(s, yo)));
}

function puedeVerSolicitudExperiencia_(s, yo) {
  if (!s.privada) return true;
  return esParteExperiencia_(s, yo);
}

function listarSolicitudesExperiencia_(yo) {
  var metas = mapaMetasExperiencia_();
  return listarSolicitudes_().map(function (s) {
    return decorarSolicitudExperiencia_(s, metas[s.id]);
  }).filter(function (s) {
    return puedeVerSolicitudExperiencia_(s, yo);
  });
}

function exigirAccesoSolicitudExperiencia_(id, yo) {
  var fila = filaSolicitud_(id);
  var s = decorarSolicitudExperiencia_(mapearSolicitud_(fila, hoyISO_()), metaExperiencia_(id));
  if (!puedeVerSolicitudExperiencia_(s, yo)) {
    throw new Error('No tienes acceso a esta solicitud.');
  }
  return s;
}

function detalleSolicitudExperiencia_(id, yo) {
  exigirAccesoSolicitudExperiencia_(id, yo);
  var d = detalleSolicitud_(id);
  d.solicitud = decorarSolicitudExperiencia_(d.solicitud, metaExperiencia_(id));
  return d;
}

/** Añade comentarios/historial/adjuntos decorados a una respuesta ya guardada. */
function conDetalleExperiencia_(resultado, yo) {
  var id = resultado && resultado.solicitud ? resultado.solicitud.id : null;
  if (!id) return resultado;
  var detalle = detalleSolicitudExperiencia_(id, yo);
  Object.keys(resultado).forEach(function (k) {
    if (k !== 'solicitud' && k !== 'comentarios' && k !== 'historial' && k !== 'adjuntos') {
      detalle[k] = resultado[k];
    }
  });
  return detalle;
}

/* ------------------------------------------------------------------ */
/* Alta con privacidad y urgencia                                      */
/* ------------------------------------------------------------------ */

function crearSolicitudExperiencia_(payload, creador) {
  payload = payload || {};
  var prioridad = texto_(payload.prioridad, 20) || 'Normal';
  var justificacion = texto_(payload.justificacion_urgente, 500);
  var privada = payload.privada === true || String(payload.privada).toUpperCase() === 'SI';

  if (prioridad === 'Urgente' && !justificacion) {
    throw new Error('Indica brevemente por qué esta solicitud requiere atención urgente.');
  }

  var r = crearSolicitud_(payload, creador);
  guardarMetaExperiencia_(r.solicitud.id, {
    privada: privada ? 'SI' : 'NO',
    justificacion_urgente: justificacion
  });

  if (privada || justificacion) {
    conLock_(function () {
      if (privada) agregarHistorial_(r.solicitud.id, creador.nombre, 'Privacidad', 'Solicitud marcada como privada.');
      if (justificacion) agregarHistorial_(r.solicitud.id, creador.nombre, 'Urgencia', justificacion);
    });
  }

  r.solicitud = decorarSolicitudExperiencia_(r.solicitud, metaExperiencia_(r.solicitud.id));
  return r;
}

/* ------------------------------------------------------------------ */
/* Estado En espera                                                    */
/* ------------------------------------------------------------------ */

function ponerEnEsperaExperiencia_(id, esperaDe, motivo, yo) {
  var s = exigirAccesoSolicitudExperiencia_(id, yo);
  if (!esParteExperiencia_(s, yo)) throw new Error('Solo las personas involucradas pueden poner la solicitud en espera.');
  if (ESTADOS_NO_VENCIBLES.indexOf(s.estado_base) !== -1) throw new Error('Una solicitud concluida no puede ponerse en espera.');

  esperaDe = texto_(esperaDe, 40);
  motivo = texto_(motivo, 700);
  if (EX_ESPERA_DE.indexOf(esperaDe) === -1) throw new Error('Indica de quién se está esperando respuesta o insumo.');
  if (!motivo) throw new Error('Describe brevemente qué está bloqueando la solicitud.');

  guardarMetaExperiencia_(id, {
    en_espera: 'SI',
    espera_de: esperaDe,
    motivo_espera: motivo,
    estado_previo: s.estado_base
  });

  conLock_(function () {
    agregarHistorial_(id, yo.nombre, 'En espera', 'En espera de ' + esperaDe + '. ' + motivo);
  });
  return detalleSolicitudExperiencia_(id, yo);
}

function quitarEsperaExperiencia_(id, yo) {
  var s = exigirAccesoSolicitudExperiencia_(id, yo);
  if (!esParteExperiencia_(s, yo)) throw new Error('Solo las personas involucradas pueden reanudar la solicitud.');
  if (!s.en_espera) return detalleSolicitudExperiencia_(id, yo);

  guardarMetaExperiencia_(id, {
    en_espera: 'NO', espera_de: '', motivo_espera: '', estado_previo: ''
  });
  conLock_(function () {
    agregarHistorial_(id, yo.nombre, 'Reanudación', 'La solicitud dejó de estar en espera.');
  });
  return detalleSolicitudExperiencia_(id, yo);
}

/* ------------------------------------------------------------------ */
/* Acuerdo de fecha                                                    */
/* ------------------------------------------------------------------ */

function proponerFechaExperiencia_(id, fecha, motivo, yo) {
  var s = exigirAccesoSolicitudExperiencia_(id, yo);
  if (!(yo.admin || esResponsableExperiencia_(s, yo))) {
    throw new Error('La nueva fecha la propone la persona responsable de la solicitud.');
  }
  if (ESTADOS_NO_VENCIBLES.indexOf(s.estado_base) !== -1) throw new Error('La solicitud ya está concluida.');

  fecha = aFechaISO_(fecha);
  motivo = texto_(motivo, 700);
  if (!fecha) throw new Error('Indica una fecha propuesta válida.');
  if (!motivo) throw new Error('Explica brevemente por qué propones cambiar la fecha.');

  guardarMetaExperiencia_(id, {
    fecha_propuesta: fecha,
    motivo_propuesta: motivo,
    propuesta_por: yo.nombre,
    propuesta_created_at: ahoraISO_()
  });
  conLock_(function () {
    agregarHistorial_(id, yo.nombre, 'Propuesta de fecha',
      'Propone ' + fechaLegible_(fecha) + '. ' + motivo);
  });
  return detalleSolicitudExperiencia_(id, yo);
}

function resolverFechaExperiencia_(id, aceptar, yo) {
  var s = exigirAccesoSolicitudExperiencia_(id, yo);
  if (!(yo.admin || esSolicitanteExperiencia_(s, yo))) {
    throw new Error('La propuesta de fecha la confirma quien hizo la solicitud.');
  }
  if (!s.fecha_propuesta) throw new Error('No hay una propuesta de fecha pendiente.');

  var propuesta = s.fecha_propuesta;
  if (aceptar) {
    conLock_(function () {
      var fila = filaSolicitud_(id);
      actualizarFila_(HOJAS.SOLICITUDES, fila._fila, { fecha_limite: propuesta, updated_at: ahoraISO_() });
      agregarHistorial_(id, yo.nombre, 'Fecha acordada', 'Nueva fecha límite: ' + fechaLegible_(propuesta) + '.');
    });
  } else {
    conLock_(function () {
      agregarHistorial_(id, yo.nombre, 'Propuesta de fecha no aceptada',
        'Se conserva la fecha límite actual.');
    });
  }

  guardarMetaExperiencia_(id, {
    fecha_propuesta: '', motivo_propuesta: '', propuesta_por: '', propuesta_created_at: ''
  });
  return detalleSolicitudExperiencia_(id, yo);
}

/* ------------------------------------------------------------------ */
/* Confirmación por quien solicitó                                     */
/* ------------------------------------------------------------------ */

function cerrarPorSolicitanteExperiencia_(id, yo) {
  var s = exigirAccesoSolicitudExperiencia_(id, yo);
  if (!(yo.admin || esSolicitanteExperiencia_(s, yo))) {
    throw new Error('La solicitud la confirma quien la solicitó.');
  }
  if (!yo.admin && s.estado_base !== 'Atendida') {
    throw new Error('Primero debe estar marcada como Atendida.');
  }

  conLock_(function () {
    var fila = filaSolicitud_(id);
    var ahora = ahoraISO_();
    var cambios = { estado: 'Cerrada', fecha_cierre: ahora, updated_at: ahora };
    if (!texto_(fila.fecha_atendida)) cambios.fecha_atendida = ahora;
    actualizarFila_(HOJAS.SOLICITUDES, fila._fila, cambios);
    agregarHistorial_(id, yo.nombre, 'Confirmación y cierre', 'El solicitante confirmó que quedó resuelta.');
  });

  guardarMetaExperiencia_(id, {
    en_espera: 'NO', espera_de: '', motivo_espera: '', estado_previo: '',
    fecha_propuesta: '', motivo_propuesta: '', propuesta_por: '', propuesta_created_at: ''
  });
  return detalleSolicitudExperiencia_(id, yo);
}

function pedirAjusteExperiencia_(id, comentario, yo) {
  var s = exigirAccesoSolicitudExperiencia_(id, yo);
  if (!(yo.admin || esSolicitanteExperiencia_(s, yo))) {
    throw new Error('Solo quien hizo la solicitud puede pedir un ajuste en este punto.');
  }
  if (s.estado_base !== 'Atendida') throw new Error('La solicitud no está pendiente de confirmación.');

  comentario = texto_(comentario, 2000) || 'Requiere un ajuste antes de cerrar.';
  cambiarEstado_(id, 'En proceso', yo.nombre, yo.admin, 'El solicitante solicita ajuste.');
  agregarComentario_(id, yo, { comentario: comentario, notificar: true });
  return detalleSolicitudExperiencia_(id, yo);
}

/* ------------------------------------------------------------------ */
/* Cambio de estado compatible con la capa EX                          */
/* ------------------------------------------------------------------ */

function cambiarEstadoExperiencia_(id, nuevoEstado, yo, motivo) {
  var s = exigirAccesoSolicitudExperiencia_(id, yo);

  if (nuevoEstado === 'En espera') {
    throw new Error('Para ponerla En espera indica primero de quién se espera y el motivo.');
  }

  if (nuevoEstado === 'Cerrada' && !yo.admin && esSolicitanteExperiencia_(s, yo)) {
    var dCerrar = cerrarPorSolicitanteExperiencia_(id, yo);
    return { solicitud: dCerrar.solicitud, correo_enviado: false, aviso: '' };
  }

  var r = cambiarEstado_(id, nuevoEstado, yo.nombre, yo.admin, motivo);
  if (s.en_espera) {
    guardarMetaExperiencia_(id, {
      en_espera: 'NO', espera_de: '', motivo_espera: '', estado_previo: ''
    });
  }
  r.solicitud = decorarSolicitudExperiencia_(r.solicitud, metaExperiencia_(id));
  return r;
}

/* ------------------------------------------------------------------ */
/* API adicionales                                                     */
/* ------------------------------------------------------------------ */

function apiPonerEnEsperaExperiencia(id, esperaDe, motivo) {
  return ejecutar_('apiPonerEnEsperaExperiencia', function () {
    var yo = exigirUsuarioActual_();
    return ponerEnEsperaExperiencia_(texto_(id), esperaDe, motivo, yo);
  });
}

function apiQuitarEsperaExperiencia(id) {
  return ejecutar_('apiQuitarEsperaExperiencia', function () {
    var yo = exigirUsuarioActual_();
    return quitarEsperaExperiencia_(texto_(id), yo);
  });
}

function apiProponerFechaExperiencia(id, fecha, motivo) {
  return ejecutar_('apiProponerFechaExperiencia', function () {
    var yo = exigirUsuarioActual_();
    return proponerFechaExperiencia_(texto_(id), fecha, motivo, yo);
  });
}

function apiResolverFechaExperiencia(id, aceptar) {
  return ejecutar_('apiResolverFechaExperiencia', function () {
    var yo = exigirUsuarioActual_();
    return resolverFechaExperiencia_(texto_(id), !!aceptar, yo);
  });
}

function apiResolverAtendidaExperiencia(id, accion, comentario) {
  return ejecutar_('apiResolverAtendidaExperiencia', function () {
    var yo = exigirUsuarioActual_();
    if (accion === 'cerrar') return cerrarPorSolicitanteExperiencia_(texto_(id), yo);
    if (accion === 'ajuste') return pedirAjusteExperiencia_(texto_(id), comentario, yo);
    throw new Error('Acción no válida.');
  });
}
