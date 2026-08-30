/**
 * Tickets.gs — Núcleo del sistema: solicitudes, estados, comentarios e historial.
 */

/* ------------------------------------------------------------------ */
/* Folio                                                               */
/* ------------------------------------------------------------------ */

/**
 * Genera el siguiente folio del día: SI-260829-001.
 * Debe invocarse SIEMPRE dentro de conLock_.
 */
function siguienteFolio_() {
  var cfg = leerConfig_();
  var prefijo = texto_(cfg.prefijo_folio) || 'SI';
  var hoy = hoyISO_();
  var ymd = hoy.slice(2, 4) + hoy.slice(5, 7) + hoy.slice(8, 10);
  var base = prefijo + '-' + ymd + '-';

  var maximo = 0;
  leerTodo_(HOJAS.SOLICITUDES).forEach(function (s) {
    var folio = texto_(s.folio);
    if (folio.indexOf(base) === 0) {
      var n = parseInt(folio.slice(base.length), 10);
      if (!isNaN(n) && n > maximo) maximo = n;
    }
  });
  return base + pad3_(maximo + 1);
}

/* ------------------------------------------------------------------ */
/* Historial                                                           */
/* ------------------------------------------------------------------ */

/** Registra un movimiento. No bloquea: se usa dentro de operaciones ya bloqueadas. */
function agregarHistorial_(solicitudId, actor, accion, detalle) {
  agregarFila_(HOJAS.HISTORIAL, {
    id: uuid_(),
    solicitud_id: solicitudId,
    fecha: ahoraISO_(),
    actor: texto_(actor, 120) || 'Sistema',
    accion: texto_(accion, 60),
    detalle: texto_(detalle, 900)
  });
}

/**
 * Ejecuta un envío de correo sin que una falla pierda la solicitud:
 * si truena, se registra en el historial y la operación continúa.
 * Devuelve true si el correo salió.
 */
function notificarSeguro_(solicitudId, actor, descripcion, fn) {
  try {
    var enviado = fn();
    if (enviado) agregarHistorial_(solicitudId, 'Sistema', 'Notificación', descripcion + ' — correo enviado.');
    return !!enviado;
  } catch (e) {
    console.error('Notificación fallida: ' + (e && e.stack ? e.stack : e));
    agregarHistorial_(solicitudId, 'Sistema', 'Notificación fallida',
      descripcion + ' — ' + texto_(e && e.message ? e.message : e, 400));
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Lectura                                                             */
/* ------------------------------------------------------------------ */

/** Convierte una fila de SOLICITUDES en el objeto que consume el frontend. */
function mapearSolicitud_(s, hoy) {
  var estado = texto_(s.estado) || 'Pendiente';
  var fechaLimite = aFechaISO_(s.fecha_limite);
  var dias = fechaLimite ? diasEntre_(hoy, fechaLimite) : null; // negativo = ya venció
  var vencida = !!fechaLimite && dias < 0 && ESTADOS_NO_VENCIBLES.indexOf(estado) === -1;
  return {
    id: texto_(s.id),
    folio: texto_(s.folio),
    created_at: texto_(s.created_at),
    solicitante_nombre: texto_(s.solicitante_nombre),
    solicitante_email: texto_(s.solicitante_email),
    responsable_nombre: texto_(s.responsable_nombre),
    responsable_email: texto_(s.responsable_email),
    categoria: texto_(s.categoria),
    prioridad: texto_(s.prioridad) || 'Normal',
    titulo: texto_(s.titulo),
    descripcion: texto_(s.descripcion),
    cliente_proyecto: texto_(s.cliente_proyecto),
    fecha_limite: fechaLimite,
    estado: estado,
    updated_at: texto_(s.updated_at),
    fecha_atendida: texto_(s.fecha_atendida),
    fecha_cierre: texto_(s.fecha_cierre),
    // Campos derivados (no se guardan en el Sheet):
    vencida: vencida,
    dias_restantes: dias,
    vence_hoy: !!fechaLimite && dias === 0 && ESTADOS_NO_VENCIBLES.indexOf(estado) === -1
  };
}

/** Todas las solicitudes, más recientes primero. */
function listarSolicitudes_() {
  var hoy = hoyISO_();
  return leerTodo_(HOJAS.SOLICITUDES)
    .filter(function (s) { return texto_(s.id); })
    .map(function (s) { return mapearSolicitud_(s, hoy); })
    .sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
}

/** Copia una fila cruda aplicándole los cambios, sin volver a leer el Sheet. */
function fusionar_(fila, cambios) {
  var copia = {};
  Object.keys(fila).forEach(function (k) { copia[k] = fila[k]; });
  Object.keys(cambios).forEach(function (k) { copia[k] = cambios[k]; });
  return copia;
}

/** Fila cruda de una solicitud (incluye _fila). Lanza si no existe. */
function filaSolicitud_(id) {
  var filas = leerTodo_(HOJAS.SOLICITUDES);
  for (var i = 0; i < filas.length; i++) {
    if (texto_(filas[i].id) === String(id)) return filas[i];
  }
  throw new Error('No se encontró la solicitud solicitada.');
}

function comentariosDe_(solicitudId) {
  return leerTodo_(HOJAS.COMENTARIOS)
    .filter(function (c) { return texto_(c.solicitud_id) === String(solicitudId); })
    .map(function (c) {
      return {
        id: texto_(c.id),
        fecha: texto_(c.fecha),
        autor_nombre: texto_(c.autor_nombre),
        autor_email: texto_(c.autor_email),
        comentario: texto_(c.comentario),
        notificar: esVerdadero_(c.notificar)
      };
    })
    .sort(function (a, b) { return (a.fecha || '').localeCompare(b.fecha || ''); });
}

function historialDe_(solicitudId) {
  return leerTodo_(HOJAS.HISTORIAL)
    .filter(function (h) { return texto_(h.solicitud_id) === String(solicitudId); })
    .map(function (h) {
      return {
        id: texto_(h.id), fecha: texto_(h.fecha), actor: texto_(h.actor),
        accion: texto_(h.accion), detalle: texto_(h.detalle)
      };
    })
    .sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || ''); });
}

/** Detalle completo para la pantalla de la solicitud. */
function detalleSolicitud_(id) {
  var s = filaSolicitud_(id);
  return {
    solicitud: mapearSolicitud_(s, hoyISO_()),
    comentarios: comentariosDe_(id),
    historial: historialDe_(id),
    adjuntos: adjuntosDe_(id)
  };
}

/* ------------------------------------------------------------------ */
/* Alta                                                                */
/* ------------------------------------------------------------------ */

/**
 * Crea una solicitud. payload:
 * {solicitante_id, responsable_id, categoria, prioridad, titulo, descripcion,
 *  cliente_proyecto, fecha_limite, archivos:[{nombre,tipo,datos}]}
 *
 * creador: persona de la sesión actual (ya resuelta por correo, ver usuarioActual_).
 * "Solicitante" puede ser otra persona (p.ej. alguien pidió por WhatsApp y otro
 * lo registra), pero el historial siempre firma con quien de verdad la creó:
 * de lo contrario cualquiera podría dejar constancia de que la creó otro.
 */
function crearSolicitud_(payload, creador) {
  payload = payload || {};

  var solicitante = buscarUsuario_(payload.solicitante_id, payload.solicitante_nombre);
  var responsable = buscarUsuario_(payload.responsable_id, payload.responsable_nombre);
  if (!solicitante) throw new Error('Seleccione quién solicita.');
  if (!responsable) throw new Error('Seleccione a quién se asigna la solicitud.');

  var actor = (creador && creador.nombre) || solicitante.nombre;
  var porCuentaDeOtro = actor !== solicitante.nombre;

  var titulo = texto_(payload.titulo, 200);
  var descripcion = texto_(payload.descripcion, 5000);
  var categoria = texto_(payload.categoria, 80);
  var prioridad = texto_(payload.prioridad, 20) || 'Normal';
  var cliente = texto_(payload.cliente_proyecto, 200); // opcional
  var fechaLimite = aFechaISO_(payload.fecha_limite);

  if (!titulo) throw new Error('El título es obligatorio.');
  if (!descripcion) throw new Error('La descripción es obligatoria.');
  if (!fechaLimite) throw new Error('Indique la fecha límite.');
  if (!enLista_(prioridad, PRIORIDADES)) throw new Error('Prioridad no válida.');
  if (!categoria || !enLista_(categoria, categorias_())) throw new Error('Seleccione una categoría válida.');

  var archivos = validarArchivos_(payload.archivos);

  var resultado = conLock_(function () {
    var id = uuid_();
    var folio = siguienteFolio_();
    var ahora = ahoraISO_();

    var registro = {
      id: id,
      folio: folio,
      created_at: ahora,
      solicitante_nombre: solicitante.nombre,
      solicitante_email: solicitante.correo,
      responsable_nombre: responsable.nombre,
      responsable_email: responsable.correo,
      categoria: categoria,
      prioridad: prioridad,
      titulo: titulo,
      descripcion: descripcion,
      cliente_proyecto: cliente,
      fecha_limite: fechaLimite,
      estado: 'Pendiente',
      updated_at: ahora,
      fecha_atendida: '',
      fecha_cierre: ''
    };
    agregarFila_(HOJAS.SOLICITUDES, registro);
    agregarHistorial_(id, actor, 'Creación',
      'Solicitud creada' + (porCuentaDeOtro ? ' a nombre de ' + solicitante.nombre : '') +
      ' y asignada a ' + responsable.nombre + '. Fecha límite: ' + fechaLegible_(fechaLimite) + '.');

    var adjuntos = [];
    try {
      adjuntos = guardarAdjuntos_(id, folio, archivos);
      if (adjuntos.length) {
        agregarHistorial_(id, actor, 'Adjuntos',
          adjuntos.length + ' archivo(s): ' + adjuntos.map(function (a) { return a.nombre; }).join(', '));
      }
    } catch (e) {
      // La solicitud ya quedó guardada: se registra el fallo y se continúa.
      console.error('Adjuntos: ' + e);
      agregarHistorial_(id, 'Sistema', 'Adjuntos fallidos', texto_(e && e.message ? e.message : e, 400));
    }

    return { registro: registro, adjuntos: adjuntos };
  });

  var s = mapearSolicitud_(resultado.registro, hoyISO_());
  var aviso = '';
  var correoEnviado = false;

  if (!responsable.correo) {
    aviso = 'Responsable sin correo registrado: no se envió notificación.';
    agregarHistorial_(s.id, 'Sistema', 'Notificación omitida', aviso);
  } else if (!notificacionesActivas_()) {
    aviso = 'Notificaciones desactivadas en configuración.';
  } else {
    correoEnviado = notificarSeguro_(s.id, actor, 'Nueva solicitud a ' + responsable.nombre, function () {
      return notificarNuevaSolicitud_(s, resultado.adjuntos);
    });
    if (!correoEnviado) aviso = 'La solicitud se guardó, pero el correo no pudo enviarse.';
  }

  return { solicitud: s, adjuntos: resultado.adjuntos, correo_enviado: correoEnviado, aviso: aviso };
}

/* ------------------------------------------------------------------ */
/* Cambio de estado                                                    */
/* ------------------------------------------------------------------ */

/**
 * Cambia el estado de una solicitud.
 * Cerrada y Cancelada requieren modo Administración.
 */
function cambiarEstado_(id, nuevoEstado, actor, esAdmin, motivo) {
  nuevoEstado = texto_(nuevoEstado);
  actor = texto_(actor, 120) || 'Sin identificar';
  if (!enLista_(nuevoEstado, ESTADOS)) throw new Error('Estado no válido.');
  if (!esAdmin && enLista_(nuevoEstado, ESTADOS_ADMIN)) {
    throw new Error('Solo Administración puede marcar la solicitud como ' + nuevoEstado + '.');
  }

  var salida = conLock_(function () {
    var fila = filaSolicitud_(id);
    var anterior = texto_(fila.estado) || 'Pendiente';
    if (anterior === nuevoEstado) {
      return { solicitud: mapearSolicitud_(fila, hoyISO_()), sinCambio: true };
    }
    var ahora = ahoraISO_();
    var cambios = { estado: nuevoEstado, updated_at: ahora };

    if (nuevoEstado === 'Atendida') cambios.fecha_atendida = ahora;
    if (nuevoEstado === 'Cerrada') {
      cambios.fecha_cierre = ahora;
      if (!texto_(fila.fecha_atendida)) cambios.fecha_atendida = ahora;
    }
    if (nuevoEstado === 'Cancelada') cambios.fecha_cierre = ahora;
    // Reabrir limpia las marcas de conclusión.
    if (nuevoEstado === 'Pendiente' || nuevoEstado === 'En proceso') {
      cambios.fecha_atendida = '';
      cambios.fecha_cierre = '';
    }

    actualizarFila_(HOJAS.SOLICITUDES, fila._fila, cambios);

    var accion = nuevoEstado === 'Cerrada' ? 'Cierre'
      : (nuevoEstado === 'Cancelada' ? 'Cancelación' : 'Cambio de estado');
    var detalle = anterior + ' → ' + nuevoEstado + (motivo ? '. Motivo: ' + texto_(motivo, 500) : '');
    agregarHistorial_(id, actor, accion, detalle);

    // Se arma el resultado con los datos ya en memoria en vez de releer la hoja.
    return { solicitud: mapearSolicitud_(fusionar_(fila, cambios), hoyISO_()), anterior: anterior };
  });

  if (salida.sinCambio) return { solicitud: salida.solicitud, correo_enviado: false, aviso: '' };

  var s = salida.solicitud;
  var aviso = '';
  var enviado = false;

  // Solo se notifica al solicitante cuando la solicitud pasa a Atendida.
  if (nuevoEstado === 'Atendida' && notificacionesActivas_()) {
    if (!s.solicitante_email) {
      aviso = 'Solicitante sin correo registrado: no se envió notificación.';
      agregarHistorial_(id, 'Sistema', 'Notificación omitida', aviso);
    } else {
      enviado = notificarSeguro_(id, actor, 'Solicitud atendida', function () {
        return notificarAtendida_(s, actor);
      });
      if (!enviado) aviso = 'El estado se guardó, pero el correo no pudo enviarse.';
    }
  }
  return { solicitud: s, correo_enviado: enviado, aviso: aviso };
}

/* ------------------------------------------------------------------ */
/* Reasignación y edición (Administración)                             */
/* ------------------------------------------------------------------ */

function reasignar_(id, responsableId, actor) {
  actor = texto_(actor, 120) || 'Administración';
  var nuevo = buscarUsuario_(responsableId, null);
  if (!nuevo) throw new Error('Seleccione al nuevo responsable.');

  var salida = conLock_(function () {
    var fila = filaSolicitud_(id);
    var anterior = texto_(fila.responsable_nombre);
    if (anterior === nuevo.nombre) {
      return { solicitud: mapearSolicitud_(fila, hoyISO_()), sinCambio: true };
    }
    var cambios = {
      responsable_nombre: nuevo.nombre,
      responsable_email: nuevo.correo,
      updated_at: ahoraISO_()
    };
    actualizarFila_(HOJAS.SOLICITUDES, fila._fila, cambios);
    agregarHistorial_(id, actor, 'Reasignación',
      (anterior || 'Sin responsable') + ' → ' + nuevo.nombre);
    return { solicitud: mapearSolicitud_(fusionar_(fila, cambios), hoyISO_()), anterior: anterior };
  });

  if (salida.sinCambio) return { solicitud: salida.solicitud, correo_enviado: false, aviso: 'La solicitud ya estaba asignada a esa persona.' };

  var s = salida.solicitud;
  var aviso = '';
  var enviado = false;
  if (!notificacionesActivas_()) {
    aviso = 'Notificaciones desactivadas en configuración.';
  } else if (!nuevo.correo) {
    aviso = 'Responsable sin correo registrado: no se envió notificación.';
    agregarHistorial_(id, 'Sistema', 'Notificación omitida', aviso);
  } else {
    enviado = notificarSeguro_(id, actor, 'Reasignación a ' + nuevo.nombre, function () {
      return notificarReasignacion_(s, salida.anterior, actor);
    });
    if (!enviado) aviso = 'La reasignación se guardó, pero el correo no pudo enviarse.';
  }
  return { solicitud: s, correo_enviado: enviado, aviso: aviso };
}

/**
 * Edición de datos de la solicitud (solo Administración).
 * Campos permitidos: titulo, descripcion, categoria, prioridad,
 * cliente_proyecto, fecha_limite, solicitante_id.
 */
function actualizarSolicitud_(id, cambios, actor) {
  cambios = cambios || {};
  actor = texto_(actor, 120) || 'Administración';

  return conLock_(function () {
    var fila = filaSolicitud_(id);
    var aplicar = {};
    var descripcionCambios = [];

    function set(campo, valorNuevo, etiqueta) {
      var anterior = texto_(fila[campo]);
      if (String(valorNuevo) === anterior) return;
      aplicar[campo] = valorNuevo;
      descripcionCambios.push(etiqueta + ': "' + (anterior || '—') + '" → "' + (valorNuevo || '—') + '"');
    }

    if (cambios.titulo !== undefined) {
      var t = texto_(cambios.titulo, 200);
      if (!t) throw new Error('El título no puede quedar vacío.');
      set('titulo', t, 'Título');
    }
    if (cambios.descripcion !== undefined) {
      var d = texto_(cambios.descripcion, 5000);
      if (!d) throw new Error('La descripción no puede quedar vacía.');
      set('descripcion', d, 'Descripción');
    }
    if (cambios.categoria !== undefined) {
      var c = texto_(cambios.categoria, 80);
      if (!enLista_(c, categorias_())) throw new Error('Categoría no válida.');
      set('categoria', c, 'Categoría');
    }
    if (cambios.prioridad !== undefined) {
      var p = texto_(cambios.prioridad, 20);
      if (!enLista_(p, PRIORIDADES)) throw new Error('Prioridad no válida.');
      set('prioridad', p, 'Prioridad');
    }
    if (cambios.cliente_proyecto !== undefined) {
      set('cliente_proyecto', texto_(cambios.cliente_proyecto, 200), 'Cliente / proyecto');
    }
    if (cambios.fecha_limite !== undefined) {
      var f = aFechaISO_(cambios.fecha_limite);
      if (!f) throw new Error('Fecha límite no válida.');
      set('fecha_limite', f, 'Fecha límite');
    }
    if (cambios.solicitante_id !== undefined && texto_(cambios.solicitante_id)) {
      var u = buscarUsuario_(cambios.solicitante_id, null);
      if (!u) throw new Error('Solicitante no encontrado en el directorio.');
      if (u.nombre !== texto_(fila.solicitante_nombre)) {
        aplicar.solicitante_nombre = u.nombre;
        aplicar.solicitante_email = u.correo;
        descripcionCambios.push('Solicitante: "' + texto_(fila.solicitante_nombre) + '" → "' + u.nombre + '"');
      }
    }

    if (!descripcionCambios.length) {
      return { solicitud: mapearSolicitud_(fila, hoyISO_()), aviso: 'No hubo cambios que guardar.' };
    }

    aplicar.updated_at = ahoraISO_();
    actualizarFila_(HOJAS.SOLICITUDES, fila._fila, aplicar);
    agregarHistorial_(id, actor, 'Edición', descripcionCambios.join(' · '));

    return { solicitud: mapearSolicitud_(fusionar_(fila, aplicar), hoyISO_()), aviso: '' };
  });
}

/* ------------------------------------------------------------------ */
/* Comentarios                                                         */
/* ------------------------------------------------------------------ */

/**
 * Agrega un comentario. Solo envía correo si notificar === true.
 * autor: persona de la sesión actual (ya resuelta por correo, ver usuarioActual_).
 */
function agregarComentario_(id, autor, payload) {
  payload = payload || {};
  var cuerpo = texto_(payload.comentario, 4000);
  var notificar = payload.notificar === true || payload.notificar === 'true';

  if (!cuerpo) throw new Error('El comentario no puede estar vacío.');

  var salida = conLock_(function () {
    var fila = filaSolicitud_(id);
    var comentario = {
      id: uuid_(),
      solicitud_id: id,
      fecha: ahoraISO_(),
      autor_nombre: autor.nombre,
      autor_email: autor.correo,
      comentario: cuerpo,
      notificar: notificar ? 'SI' : 'NO'
    };
    agregarFila_(HOJAS.COMENTARIOS, comentario);
    actualizarFila_(HOJAS.SOLICITUDES, fila._fila, { updated_at: comentario.fecha });
    agregarHistorial_(id, autor.nombre, 'Comentario', cuerpo.slice(0, 200));
    return {
      comentario: {
        id: comentario.id, fecha: comentario.fecha, autor_nombre: autor.nombre,
        autor_email: autor.correo, comentario: cuerpo, notificar: notificar
      },
      solicitud: mapearSolicitud_(fusionar_(fila, { updated_at: comentario.fecha }), hoyISO_())
    };
  });

  var aviso = '';
  var enviado = false;
  if (notificar && notificacionesActivas_()) {
    // Se avisa a la contraparte: responsable y solicitante, menos quien comentó.
    var s = salida.solicitud;
    var destinos = [s.responsable_email, s.solicitante_email]
      .filter(function (c) { return c && c !== autor.correo; });
    destinos = destinos.filter(function (c, i) { return destinos.indexOf(c) === i; });
    if (!destinos.length) {
      aviso = 'No hay destinatarios con correo registrado para notificar.';
      agregarHistorial_(id, 'Sistema', 'Notificación omitida', aviso);
    } else {
      enviado = notificarSeguro_(id, autor.nombre, 'Comentario notificado', function () {
        return notificarComentario_(s, salida.comentario, destinos);
      });
      if (!enviado) aviso = 'El comentario se guardó, pero el correo no pudo enviarse.';
    }
  }
  return { comentario: salida.comentario, solicitud: salida.solicitud, correo_enviado: enviado, aviso: aviso };
}
