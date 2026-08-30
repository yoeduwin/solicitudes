/**
 * Drive.gs — Carpeta de adjuntos y guardado de archivos.
 * No se modifican los permisos de los archivos: heredan los de la carpeta.
 */

var TIPOS_PERMITIDOS = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png'
};

var NOMBRE_CARPETA_RAIZ = 'Solicitudes Internas - Adjuntos';

/**
 * Devuelve el ID de la carpeta de adjuntos, creándola si hace falta y
 * guardando el ID en CONFIG.carpeta_drive_id.
 */
function asegurarCarpeta_() {
  var cfg = leerConfig_();
  var id = texto_(cfg.carpeta_drive_id);
  if (id) {
    try {
      return DriveApp.getFolderById(id).getId();
    } catch (e) {
      console.warn('carpeta_drive_id inválido (' + id + '); se creará una nueva carpeta.');
    }
  }
  var carpeta = DriveApp.createFolder(NOMBRE_CARPETA_RAIZ);
  guardarConfig_('carpeta_drive_id', carpeta.getId());
  return carpeta.getId();
}

/** Subcarpeta por folio, para mantener ordenados los adjuntos. */
function carpetaDeSolicitud_(folio) {
  var raiz = DriveApp.getFolderById(asegurarCarpeta_());
  var it = raiz.getFoldersByName(folio);
  return it.hasNext() ? it.next() : raiz.createFolder(folio);
}

/**
 * Valida la lista de archivos recibida del frontend antes de tocar Drive.
 * archivos: [{nombre, tipo, datos}] donde datos es base64 sin encabezado data:.
 */
function validarArchivos_(archivos) {
  archivos = archivos || [];
  if (!archivos.length) return [];
  var maxN = limiteArchivos_();
  var maxB = limiteBytesArchivo_();
  if (archivos.length > maxN) {
    throw new Error('Máximo ' + maxN + ' archivos por solicitud.');
  }
  return archivos.map(function (a) {
    var nombre = texto_(a && a.nombre, 200) || 'archivo';
    var tipo = texto_(a && a.tipo).toLowerCase();
    var datos = a && a.datos ? String(a.datos) : '';
    if (!datos) throw new Error('El archivo "' + nombre + '" llegó vacío.');
    if (!TIPOS_PERMITIDOS[tipo]) {
      throw new Error('El archivo "' + nombre + '" no es un formato permitido (PDF, JPG o PNG).');
    }
    // Tamaño aproximado del contenido decodificado a partir del base64.
    var bytes = Math.floor(datos.replace(/=+$/, '').length * 3 / 4);
    if (bytes > maxB) {
      throw new Error('El archivo "' + nombre + '" excede el límite de ' +
        Math.round(maxB / 1048576) + ' MB.');
    }
    return { nombre: nombre, tipo: tipo, datos: datos, bytes: bytes };
  });
}

/**
 * Guarda los archivos ya validados en Drive y registra su metadato en ADJUNTOS.
 * Devuelve la lista de adjuntos creados.
 */
function guardarAdjuntos_(solicitudId, folio, archivos) {
  if (!archivos || !archivos.length) return [];
  var carpeta = carpetaDeSolicitud_(folio);
  var creados = [];
  archivos.forEach(function (a) {
    var blob = Utilities.newBlob(Utilities.base64Decode(a.datos), a.tipo, a.nombre);
    var archivo = carpeta.createFile(blob);
    var reg = {
      id: uuid_(),
      solicitud_id: solicitudId,
      fecha: ahoraISO_(),
      drive_id: archivo.getId(),
      nombre: archivo.getName(),
      tipo: a.tipo,
      tamano: a.bytes,
      url: archivo.getUrl()
    };
    agregarFila_(HOJAS.ADJUNTOS, reg);
    creados.push(reg);
  });
  return creados;
}

/** Adjuntos de una solicitud. */
function adjuntosDe_(solicitudId) {
  return leerTodo_(HOJAS.ADJUNTOS)
    .filter(function (a) { return texto_(a.solicitud_id) === String(solicitudId); })
    .map(function (a) {
      return {
        id: texto_(a.id),
        nombre: texto_(a.nombre),
        tipo: texto_(a.tipo),
        tamano: parseInt(a.tamano, 10) || 0,
        url: texto_(a.url) || ('https://drive.google.com/file/d/' + texto_(a.drive_id) + '/view'),
        drive_id: texto_(a.drive_id)
      };
    });
}
