/**
 * Utils.gs — Utilidades compartidas.
 * Sistema de Solicitudes Internas · Ejecutiva Ambiental
 */

/** Nombres de las hojas usadas como base de datos. */
var HOJAS = {
  SOLICITUDES: 'SOLICITUDES',
  COMENTARIOS: 'COMENTARIOS',
  HISTORIAL: 'HISTORIAL',
  ADJUNTOS: 'ADJUNTOS',
  USUARIOS: 'USUARIOS',
  CONFIG: 'CONFIG'
};

/** Encabezados de cada hoja. El orden define el orden de columnas. */
var ENCABEZADOS = {
  SOLICITUDES: [
    'id', 'folio', 'created_at', 'solicitante_nombre', 'solicitante_email',
    'responsable_nombre', 'responsable_email', 'categoria', 'prioridad',
    'titulo', 'descripcion', 'cliente_proyecto', 'fecha_limite', 'estado',
    'updated_at', 'fecha_atendida', 'fecha_cierre'
  ],
  COMENTARIOS: ['id', 'solicitud_id', 'fecha', 'autor_nombre', 'autor_email', 'comentario', 'notificar'],
  HISTORIAL: ['id', 'solicitud_id', 'fecha', 'actor', 'accion', 'detalle'],
  ADJUNTOS: ['id', 'solicitud_id', 'fecha', 'drive_id', 'nombre', 'tipo', 'tamano', 'url'],
  USUARIOS: ['id', 'nombre', 'correo', 'area', 'activo'],
  CONFIG: ['clave', 'valor', 'descripcion']
};

var ESTADOS = ['Pendiente', 'En proceso', 'Atendida', 'Cerrada', 'Cancelada'];
/** Estados que ya no se consideran "abiertos" para efectos de vencimiento. */
var ESTADOS_NO_VENCIBLES = ['Atendida', 'Cerrada', 'Cancelada'];
/** Estados que solo Administración puede aplicar. */
var ESTADOS_ADMIN = ['Cerrada', 'Cancelada'];
var PRIORIDADES = ['Normal', 'Alta', 'Urgente'];

var CATEGORIAS_DEFAULT = [
  'Información / seguimiento',
  'Compra',
  'Facturación',
  'Evidencia',
  'Revisión',
  'Autorización',
  'Otro'
];

var CONFIG_DEFAULT = [
  ['nombre_sistema', 'Solicitudes Internas · Ejecutiva Ambiental', 'Título mostrado en la aplicación'],
  ['categorias', CATEGORIAS_DEFAULT.join(' | '), 'Categorías disponibles, separadas por |'],
  ['carpeta_drive_id', '', 'ID de la carpeta de Drive donde se guardan los adjuntos (vacío = se crea automáticamente)'],
  ['prefijo_folio', 'SI', 'Prefijo del folio, ej. SI-260829-001'],
  ['dias_proximos_vencer', '3', 'Días de anticipación para el aviso de "próximas a vencer"'],
  ['notificaciones_activas', 'SI', 'SI / NO — interruptor general de envío de correo'],
  ['correo_copia_admin', '', 'Correo opcional que recibe copia de las notificaciones'],
  ['max_archivos', '5', 'Máximo de adjuntos por solicitud'],
  ['max_mb_archivo', '5', 'Tamaño máximo por archivo en MB']
];

/* ------------------------------------------------------------------ */
/* Acceso al Spreadsheet                                               */
/* ------------------------------------------------------------------ */

/** Clave donde se guarda el ID del Sheet cuando el proyecto es independiente. */
var CLAVE_HOJA = 'SPREADSHEET_ID';

/** Memoria del libro dentro de una misma ejecución, para no reabrirlo en cada lectura. */
var LIBRO_ = null;

/**
 * Devuelve el Spreadsheet que sirve de base de datos.
 *
 * Funciona en los dos escenarios:
 *  a) Proyecto vinculado al Sheet (Extensiones → Apps Script): se usa el libro activo.
 *  b) Proyecto independiente (script.google.com): se abre por ID, guardado previamente
 *     con configurarHoja('<ID o URL>').
 */
function libro_() {
  if (LIBRO_) return LIBRO_;

  var id = PropertiesService.getScriptProperties().getProperty(CLAVE_HOJA);
  if (id) {
    try {
      LIBRO_ = SpreadsheetApp.openById(id);
      return LIBRO_;
    } catch (e) {
      throw new Error('No se pudo abrir la hoja con ID "' + id +
        '". Verifique el ID y sus permisos, o vuelva a ejecutar configurarHoja().');
    }
  }

  LIBRO_ = SpreadsheetApp.getActiveSpreadsheet();
  if (!LIBRO_) {
    throw new Error('El script no tiene una hoja asignada. Ejecute una vez la función ' +
      'configurarHoja("<ID o URL del Google Sheet>"), o copie el proyecto dentro del ' +
      'Sheet desde Extensiones → Apps Script.');
  }
  return LIBRO_;
}

/**
 * EJECUTAR UNA VEZ si el proyecto es independiente (no nació dentro del Sheet).
 * Acepta el ID o la URL completa de la hoja y lo guarda en las propiedades del script.
 *
 *   configurarHoja('https://docs.google.com/spreadsheets/d/1AbC.../edit')
 *   configurarHoja('1AbC...')
 *
 * Después ejecute instalar().
 */
function configurarHoja(idOUrl) {
  var valor = texto_(idOUrl);
  if (!valor) {
    throw new Error('Indique el ID o la URL del Google Sheet: configurarHoja("1AbC...").');
  }
  var m = valor.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  var id = m ? m[1] : valor;

  var ss = SpreadsheetApp.openById(id); // falla aquí si el ID o los permisos no sirven
  PropertiesService.getScriptProperties().setProperty(CLAVE_HOJA, id);
  LIBRO_ = ss;

  var msg = 'Hoja asignada: "' + ss.getName() + '" (' + id + ').\n' +
    'Siguiente paso: ejecute la función instalar().';
  console.log(msg);
  return msg;
}

/**
 * Devuelve la hoja solicitada, creándola con sus encabezados si no existe.
 */
function hoja_(nombre) {
  var ss = libro_();
  var sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    var enc = ENCABEZADOS[nombre];
    if (enc) {
      sh.getRange(1, 1, 1, enc.length).setValues([enc]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, enc.length).setFontWeight('bold');
    }
  }
  return sh;
}

/** Mapa {encabezado: índice base 0} leído de la fila 1. */
function indices_(sh) {
  var ultima = sh.getLastColumn();
  if (ultima < 1) return {};
  var fila = sh.getRange(1, 1, 1, ultima).getValues()[0];
  var mapa = {};
  for (var i = 0; i < fila.length; i++) {
    var k = String(fila[i]).trim();
    if (k) mapa[k] = i;
  }
  return mapa;
}

/**
 * Lee todas las filas de una hoja como objetos planos.
 * Agrega _fila (número de fila real en el Sheet) para escrituras posteriores.
 */
function leerTodo_(nombre) {
  var sh = hoja_(nombre);
  var filas = sh.getLastRow();
  var cols = sh.getLastColumn();
  if (filas < 2 || cols < 1) return [];
  var datos = sh.getRange(1, 1, filas, cols).getValues();
  var enc = datos[0].map(function (c) { return String(c).trim(); });
  var salida = [];
  for (var r = 1; r < datos.length; r++) {
    var obj = {};
    var vacia = true;
    for (var c = 0; c < enc.length; c++) {
      if (!enc[c]) continue;
      var v = datos[r][c];
      if (v !== '' && v !== null) vacia = false;
      obj[enc[c]] = normalizarCelda_(v);
    }
    if (vacia) continue;
    obj._fila = r + 1;
    salida.push(obj);
  }
  return salida;
}

/** Convierte fechas de celda a texto ISO/yyyy-MM-dd y deja lo demás como string. */
function normalizarCelda_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, zonaHoraria_(), 'yyyy-MM-dd');
  }
  return typeof v === 'string' ? v : String(v);
}

/** Agrega una fila respetando el orden de encabezados de la hoja. */
function agregarFila_(nombre, obj) {
  var sh = hoja_(nombre);
  var enc = ENCABEZADOS[nombre];
  var fila = enc.map(function (k) {
    var v = obj[k];
    return (v === undefined || v === null) ? '' : v;
  });
  sh.appendRow(fila);
  return obj;
}

/** Actualiza campos puntuales de una fila existente. */
function actualizarFila_(nombre, numeroFila, cambios) {
  var sh = hoja_(nombre);
  var idx = indices_(sh);
  Object.keys(cambios).forEach(function (k) {
    if (idx[k] === undefined) return;
    var v = cambios[k];
    sh.getRange(numeroFila, idx[k] + 1).setValue(v === undefined || v === null ? '' : v);
  });
}

/* ------------------------------------------------------------------ */
/* Concurrencia                                                        */
/* ------------------------------------------------------------------ */

/**
 * Ejecuta fn tomando el lock del documento. Toda escritura pasa por aquí.
 */
function conLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    throw new Error('El sistema está ocupado procesando otra operación. Intente de nuevo.');
  }
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Fechas e identificadores                                            */
/* ------------------------------------------------------------------ */

function zonaHoraria_() {
  try {
    return libro_().getSpreadsheetTimeZone() || Session.getScriptTimeZone();
  } catch (e) {
    return Session.getScriptTimeZone();
  }
}

function ahoraISO_() {
  return Utilities.formatDate(new Date(), zonaHoraria_(), "yyyy-MM-dd'T'HH:mm:ss");
}

function hoyISO_() {
  return Utilities.formatDate(new Date(), zonaHoraria_(), 'yyyy-MM-dd');
}

/** Normaliza cualquier entrada de fecha a 'yyyy-MM-dd'. Devuelve '' si no es válida. */
function aFechaISO_(valor) {
  if (!valor) return '';
  if (Object.prototype.toString.call(valor) === '[object Date]') {
    return isNaN(valor.getTime()) ? '' : Utilities.formatDate(valor, zonaHoraria_(), 'yyyy-MM-dd');
  }
  var s = String(valor).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); // dd/MM/yyyy
  if (m) return m[3] + '-' + pad2_(m[2]) + '-' + pad2_(m[1]);
  var d = new Date(s);
  if (!isNaN(d.getTime())) return Utilities.formatDate(d, zonaHoraria_(), 'yyyy-MM-dd');
  return '';
}

function pad2_(n) { return ('0' + n).slice(-2); }
function pad3_(n) { return ('00' + n).slice(-3); }

/** Diferencia en días entre dos fechas 'yyyy-MM-dd' (b - a). */
function diasEntre_(aISO, bISO) {
  if (!aISO || !bISO) return null;
  var a = Date.UTC(+aISO.slice(0, 4), +aISO.slice(5, 7) - 1, +aISO.slice(8, 10));
  var b = Date.UTC(+bISO.slice(0, 4), +bISO.slice(5, 7) - 1, +bISO.slice(8, 10));
  return Math.round((b - a) / 86400000);
}

/** Fecha legible para correos: 29/08/2026. */
function fechaLegible_(iso) {
  if (!iso) return 'Sin fecha límite';
  var p = String(iso).slice(0, 10).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso);
}

function uuid_() {
  return Utilities.getUuid();
}

/* ------------------------------------------------------------------ */
/* Validación y saneamiento                                            */
/* ------------------------------------------------------------------ */

function texto_(v, maxLargo) {
  var s = (v === undefined || v === null) ? '' : String(v).trim();
  if (maxLargo && s.length > maxLargo) s = s.slice(0, maxLargo);
  return s;
}

function esCorreo_(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

function enLista_(valor, lista) {
  return lista.indexOf(valor) !== -1;
}

/** Escapa texto para insertarlo en el HTML de los correos. */
function escaparHtml_(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/* Respuestas hacia el frontend                                        */
/* ------------------------------------------------------------------ */

function ok_(datos) {
  return { ok: true, datos: datos === undefined ? null : datos };
}

function error_(mensaje) {
  return { ok: false, error: String(mensaje || 'Error desconocido') };
}

/**
 * Envuelve un handler de API: captura errores y los devuelve como {ok:false}
 * para que el frontend siempre reciba una respuesta manejable.
 */
function ejecutar_(nombre, fn) {
  try {
    return ok_(fn());
  } catch (e) {
    console.error(nombre + ': ' + (e && e.stack ? e.stack : e));
    return error_(e && e.message ? e.message : e);
  }
}
