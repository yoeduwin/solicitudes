/**
 * Notifications.gs — Correos transaccionales y recordatorio diario consolidado.
 * Todas las funciones devuelven true si el correo salió; lanzan si MailApp falla.
 */

/** URL pública de la Web App, para incluir enlaces en los correos. */
function urlApp_() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (e) {
    return '';
  }
}

function copiaAdmin_() {
  var c = texto_(leerConfig_().correo_copia_admin);
  return esCorreo_(c) ? c : '';
}

/** Envoltura HTML común de los correos. */
function plantilla_(titulo, cuerpoHtml) {
  var url = urlApp_();
  var pie = url
    ? '<p style="margin:24px 0 0"><a href="' + url + '" style="background:#065f46;color:#fff;padding:10px 18px;' +
      'border-radius:6px;text-decoration:none;font-size:14px;display:inline-block">Abrir el sistema</a></p>'
    : '';
  return '' +
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:640px;margin:0 auto">' +
      '<div style="background:#065f46;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">' +
        '<div style="font-size:12px;letter-spacing:1px;opacity:.85">EJECUTIVA AMBIENTAL</div>' +
        '<div style="font-size:18px;font-weight:bold;margin-top:2px">' + escaparHtml_(titulo) + '</div>' +
      '</div>' +
      '<div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:20px">' +
        cuerpoHtml + pie +
        '<p style="margin:24px 0 0;font-size:11px;color:#9ca3af">' +
          'Mensaje automático del Sistema de Solicitudes Internas. No responda a este correo.' +
        '</p>' +
      '</div>' +
    '</div>';
}

/** Tabla de datos clave de una solicitud. */
function tablaSolicitud_(s) {
  var filas = [
    ['Folio', s.folio],
    ['Título', s.titulo],
    ['Solicitante', s.solicitante_nombre],
    ['Responsable', s.responsable_nombre],
    ['Categoría', s.categoria],
    ['Prioridad', s.prioridad],
    ['Fecha límite', fechaLegible_(s.fecha_limite)],
    ['Estado', s.estado]
  ];
  if (s.cliente_proyecto) filas.splice(4, 0, ['Cliente / proyecto', s.cliente_proyecto]);

  var html = '<table style="width:100%;border-collapse:collapse;font-size:14px">';
  filas.forEach(function (f) {
    html += '<tr>' +
      '<td style="padding:6px 10px 6px 0;color:#6b7280;white-space:nowrap;vertical-align:top">' + escaparHtml_(f[0]) + '</td>' +
      '<td style="padding:6px 0;font-weight:bold">' + escaparHtml_(f[1] || '—') + '</td></tr>';
  });
  return html + '</table>';
}

function bloqueDescripcion_(texto) {
  return '<div style="margin-top:16px">' +
    '<div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Descripción</div>' +
    '<div style="margin-top:6px;padding:12px;background:#f9fafb;border-left:3px solid #065f46;' +
    'border-radius:4px;font-size:14px;white-space:pre-wrap">' + escaparHtml_(texto) + '</div></div>';
}

function enviar_(para, asunto, html) {
  var opciones = { htmlBody: html, name: 'Solicitudes Internas · Ejecutiva Ambiental' };
  var cc = copiaAdmin_();
  if (cc && cc !== para) opciones.cc = cc;
  MailApp.sendEmail(para, asunto, html.replace(/<[^>]+>/g, ' '), opciones);
  return true;
}

/* ------------------------------------------------------------------ */
/* Correos transaccionales                                             */
/* ------------------------------------------------------------------ */

function notificarNuevaSolicitud_(s, adjuntos) {
  if (!s.responsable_email) return false;
  var cuerpo = '<p style="margin:0 0 16px;font-size:14px">' +
    escaparHtml_(s.responsable_nombre) + ', se te asignó una nueva solicitud interna.</p>' +
    tablaSolicitud_(s) + bloqueDescripcion_(s.descripcion);
  if (adjuntos && adjuntos.length) {
    cuerpo += '<p style="margin-top:16px;font-size:13px;color:#6b7280">Adjuntos: ' +
      escaparHtml_(adjuntos.map(function (a) { return a.nombre; }).join(', ')) + '</p>';
  }
  return enviar_(s.responsable_email,
    '[' + s.folio + '] Nueva solicitud: ' + s.titulo, plantilla_('Nueva solicitud asignada', cuerpo));
}

function notificarReasignacion_(s, responsableAnterior, actor) {
  if (!s.responsable_email) return false;
  var cuerpo = '<p style="margin:0 0 16px;font-size:14px">' +
    escaparHtml_(s.responsable_nombre) + ', ' + escaparHtml_(actor) +
    ' te reasignó esta solicitud' +
    (responsableAnterior ? ' (antes a cargo de ' + escaparHtml_(responsableAnterior) + ')' : '') + '.</p>' +
    tablaSolicitud_(s) + bloqueDescripcion_(s.descripcion);
  return enviar_(s.responsable_email,
    '[' + s.folio + '] Solicitud reasignada: ' + s.titulo, plantilla_('Solicitud reasignada', cuerpo));
}

function notificarAtendida_(s, actor) {
  if (!s.solicitante_email) return false;
  var cuerpo = '<p style="margin:0 0 16px;font-size:14px">' +
    escaparHtml_(s.solicitante_nombre) + ', tu solicitud fue marcada como <strong>Atendida</strong> por ' +
    escaparHtml_(actor) + '.</p>' + tablaSolicitud_(s);
  return enviar_(s.solicitante_email,
    '[' + s.folio + '] Atendida: ' + s.titulo, plantilla_('Solicitud atendida', cuerpo));
}

function notificarComentario_(s, comentario, destinos) {
  if (!destinos || !destinos.length) return false;
  var cuerpo = '<p style="margin:0 0 16px;font-size:14px">' +
    escaparHtml_(comentario.autor_nombre) + ' agregó un comentario:</p>' +
    '<div style="padding:12px;background:#f9fafb;border-left:3px solid #065f46;border-radius:4px;' +
    'font-size:14px;white-space:pre-wrap">' + escaparHtml_(comentario.comentario) + '</div>' +
    '<div style="margin-top:16px">' + tablaSolicitud_(s) + '</div>';
  return enviar_(destinos.join(','),
    '[' + s.folio + '] Nuevo comentario: ' + s.titulo, plantilla_('Nuevo comentario', cuerpo));
}

/* ------------------------------------------------------------------ */
/* Recordatorio diario consolidado                                     */
/* ------------------------------------------------------------------ */

/**
 * Función para el Trigger diario.
 * Envía UN correo por responsable con sus solicitudes vencidas,
 * las que vencen hoy y las próximas a vencer.
 */
function enviarRecordatoriosDiarios() {
  if (!notificacionesActivas_()) {
    console.log('Recordatorios omitidos: notificaciones desactivadas.');
    return 'Notificaciones desactivadas.';
  }
  var cfg = leerConfig_();
  var ventana = parseInt(cfg.dias_proximos_vencer, 10);
  if (isNaN(ventana) || ventana < 0) ventana = 3;

  var abiertas = listarSolicitudes_().filter(function (s) {
    return ESTADOS_NO_VENCIBLES.indexOf(s.estado) === -1 && s.fecha_limite;
  });

  // Agrupa por correo de responsable.
  var porResponsable = {};
  abiertas.forEach(function (s) {
    var d = s.dias_restantes;
    var grupo = d < 0 ? 'vencidas' : (d === 0 ? 'hoy' : (d <= ventana ? 'proximas' : null));
    if (!grupo) return;
    if (!s.responsable_email) return;
    var clave = s.responsable_email;
    if (!porResponsable[clave]) {
      porResponsable[clave] = { nombre: s.responsable_nombre, vencidas: [], hoy: [], proximas: [] };
    }
    porResponsable[clave][grupo].push(s);
  });

  var enviados = 0, fallidos = 0;
  Object.keys(porResponsable).forEach(function (correo) {
    var g = porResponsable[correo];
    var total = g.vencidas.length + g.hoy.length + g.proximas.length;
    if (!total) return;
    try {
      enviar_(correo,
        'Resumen de solicitudes · ' + total + ' pendiente(s)',
        plantilla_('Tus solicitudes pendientes', cuerpoRecordatorio_(g, ventana)));
      enviados++;
    } catch (e) {
      console.error('Recordatorio a ' + correo + ' falló: ' + e);
      fallidos++;
    }
  });

  var resumen = 'Recordatorios: ' + enviados + ' enviado(s), ' + fallidos + ' fallido(s).';
  console.log(resumen);
  return resumen;
}

function cuerpoRecordatorio_(g, ventana) {
  var html = '<p style="margin:0 0 16px;font-size:14px">' + escaparHtml_(g.nombre) +
    ', este es el resumen de las solicitudes a tu cargo.</p>';
  html += seccionRecordatorio_('Vencidas', g.vencidas, '#b91c1c');
  html += seccionRecordatorio_('Vencen hoy', g.hoy, '#b45309');
  html += seccionRecordatorio_('Próximas a vencer (' + ventana + ' días)', g.proximas, '#1d4ed8');
  return html;
}

function seccionRecordatorio_(titulo, lista, color) {
  if (!lista.length) return '';
  var html = '<div style="margin-top:20px">' +
    '<div style="font-size:13px;font-weight:bold;color:' + color + ';text-transform:uppercase;' +
    'letter-spacing:.5px">' + escaparHtml_(titulo) + ' (' + lista.length + ')</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px">';
  lista.sort(function (a, b) { return (a.fecha_limite || '').localeCompare(b.fecha_limite || ''); });
  lista.forEach(function (s) {
    html += '<tr>' +
      '<td style="padding:8px 8px 8px 0;border-bottom:1px solid #f3f4f6;white-space:nowrap;color:#6b7280">' +
        escaparHtml_(s.folio) + '</td>' +
      '<td style="padding:8px 8px 8px 0;border-bottom:1px solid #f3f4f6">' +
        escaparHtml_(s.titulo) +
        '<div style="color:#9ca3af;font-size:11px">Solicita: ' + escaparHtml_(s.solicitante_nombre) +
        ' · ' + escaparHtml_(s.estado) + ' · ' + escaparHtml_(s.prioridad) +
        (s.cliente_proyecto ? ' · ' + escaparHtml_(s.cliente_proyecto) : '') + '</div></td>' +
      '<td style="padding:8px 0;border-bottom:1px solid #f3f4f6;white-space:nowrap;text-align:right;color:' +
        color + ';font-weight:bold">' + escaparHtml_(fechaLegible_(s.fecha_limite)) + '</td>' +
      '</tr>';
  });
  return html + '</table></div>';
}
