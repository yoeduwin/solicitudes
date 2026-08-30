/**
 * Config.gs — Lectura/escritura de la hoja CONFIG y creación inicial del modelo de datos.
 */

/** Devuelve la configuración como objeto {clave: valor}. Cacheada por ejecución. */
function leerConfig_() {
  return cacheLeer_('config', function () {
    var filas = leerTodo_(HOJAS.CONFIG);
    var cfg = {};
    CONFIG_DEFAULT.forEach(function (d) { cfg[d[0]] = d[1]; });
    filas.forEach(function (f) {
      var k = texto_(f.clave);
      if (k) cfg[k] = texto_(f.valor);
    });
    return cfg;
  });
}

/** Escribe (o crea) una clave de configuración. */
function guardarConfig_(clave, valor) {
  clave = texto_(clave);
  if (!clave) return;
  var filas = leerTodo_(HOJAS.CONFIG);
  for (var i = 0; i < filas.length; i++) {
    if (texto_(filas[i].clave) === clave) {
      actualizarFila_(HOJAS.CONFIG, filas[i]._fila, { valor: valor });
      return;
    }
  }
  agregarFila_(HOJAS.CONFIG, { clave: clave, valor: valor, descripcion: '' });
}

/** Categorías configuradas; si la lista está vacía se usan las de fábrica. */
function categorias_() {
  var cfg = leerConfig_();
  var lista = texto_(cfg.categorias).split('|').map(function (s) { return s.trim(); })
    .filter(function (s) { return !!s; });
  return lista.length ? lista : CATEGORIAS_DEFAULT.slice();
}

function notificacionesActivas_() {
  return String(leerConfig_().notificaciones_activas || 'SI').toUpperCase() !== 'NO';
}

function limiteArchivos_() {
  var n = parseInt(leerConfig_().max_archivos, 10);
  return (isNaN(n) || n <= 0) ? 5 : Math.min(n, 10);
}

function limiteBytesArchivo_() {
  var n = parseFloat(leerConfig_().max_mb_archivo);
  if (isNaN(n) || n <= 0) n = 5;
  return Math.min(n, 10) * 1024 * 1024;
}

/* ------------------------------------------------------------------ */
/* Instalación                                                         */
/* ------------------------------------------------------------------ */

/**
 * EJECUTAR UNA VEZ desde el editor de Apps Script.
 * Crea todas las hojas con sus encabezados, la configuración por defecto,
 * la carpeta de Drive para adjuntos y un directorio de personas de ejemplo.
 */
function instalar() {
  return conLock_(function () {
    Object.keys(HOJAS).forEach(function (k) { hoja_(HOJAS[k]); });

    // Configuración por defecto (no sobrescribe valores existentes).
    var existentes = {};
    leerTodo_(HOJAS.CONFIG).forEach(function (f) { existentes[texto_(f.clave)] = true; });
    CONFIG_DEFAULT.forEach(function (d) {
      if (!existentes[d[0]]) {
        agregarFila_(HOJAS.CONFIG, { clave: d[0], valor: d[1], descripcion: d[2] });
      }
    });

    // Carpeta de Drive para adjuntos.
    var carpetaId = asegurarCarpeta_();

    // Directorio de personas de ejemplo, solo si la hoja está vacía.
    if (leerTodo_(HOJAS.USUARIOS).length === 0) {
      [
        ['Jimmy Ayala', '', 'Atención a Clientes'],
        ['Martín Luna', '', 'Operaciones'],
        ['Eduardo Campos', '', 'Operaciones'],
        ['Danae', '', 'Asistente Administración'],
        ['Eduwin', '', 'Dirección / Administración']
      ].forEach(function (u) {
        agregarFila_(HOJAS.USUARIOS, {
          id: uuid_(), nombre: u[0], correo: u[1], area: u[2], activo: 'SI'
        });
      });
    }

    formatearHojas_();

    var msg = 'Instalación completa.\n' +
      'Hojas creadas: ' + Object.keys(HOJAS).map(function (k) { return HOJAS[k]; }).join(', ') + '\n' +
      'Carpeta de adjuntos (Drive): ' + carpetaId + '\n' +
      'Siguiente paso: capture los correos en la hoja USUARIOS y publique la Web App.';
    console.log(msg);
    return msg;
  });
}

/** Ajustes cosméticos de las hojas: anchos, congelado y formato de encabezado. */
function formatearHojas_() {
  Object.keys(ENCABEZADOS).forEach(function (nombre) {
    var sh = hoja_(nombre);
    var enc = ENCABEZADOS[nombre];
    // Reescribe encabezados por si el usuario los alteró.
    sh.getRange(1, 1, 1, enc.length).setValues([enc])
      .setFontWeight('bold').setBackground('#f1f5f9');
    sh.setFrozenRows(1);
    for (var c = 1; c <= enc.length; c++) {
      var ancho = 140;
      var nom = enc[c - 1];
      if (nom === 'id' || nom === 'solicitud_id') ancho = 90;
      if (nom === 'descripcion' || nom === 'comentario' || nom === 'detalle') ancho = 320;
      if (nom === 'titulo') ancho = 240;
      sh.setColumnWidth(c, ancho);
    }
  });
}

/** Crea el trigger diario de recordatorios (evita duplicarlo). */
function crearTriggerDiario() {
  var existentes = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existentes.length; i++) {
    if (existentes[i].getHandlerFunction() === 'enviarRecordatoriosDiarios') {
      return 'El trigger diario ya existe.';
    }
  }
  ScriptApp.newTrigger('enviarRecordatoriosDiarios')
    .timeBased().atHour(8).everyDays(1).create();
  return 'Trigger diario creado (aprox. 8:00 AM, zona ' + zonaHoraria_() + ').';
}
