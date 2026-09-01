/**
 * Users.gs — Directorio de personas (catálogo, no cuentas de usuario).
 */

/** Devuelve el catálogo completo. incluirInactivos=false por defecto. */
function listarUsuarios_(incluirInactivos) {
  return leerTodo_(HOJAS.USUARIOS).map(function (u) {
    return {
      id: texto_(u.id),
      nombre: texto_(u.nombre),
      correo: texto_(u.correo).toLowerCase(),
      area: texto_(u.area),
      activo: esVerdadero_(u.activo),
      admin: esVerdadero_(u.admin)
    };
  }).filter(function (u) {
    return u.nombre && (incluirInactivos || u.activo);
  }).sort(function (a, b) {
    return a.nombre.localeCompare(b.nombre, 'es');
  });
}

function esVerdadero_(v) {
  var s = String(v === undefined || v === null ? '' : v).trim().toUpperCase();
  return s === 'SI' || s === 'SÍ' || s === 'TRUE' || s === 'VERDADERO' || s === '1' || s === 'X';
}

/** Busca una persona por id; si no hay id, por nombre exacto. */
function buscarUsuario_(id, nombre) {
  // Cacheado: crear una solicitud busca dos personas y antes releía la hoja dos veces.
  var todos = cacheLeer_('usuarios', function () { return listarUsuarios_(true); });
  var i;
  if (id) {
    for (i = 0; i < todos.length; i++) if (todos[i].id === String(id)) return todos[i];
  }
  if (nombre) {
    var n = texto_(nombre).toLowerCase();
    for (i = 0; i < todos.length; i++) if (todos[i].nombre.toLowerCase() === n) return todos[i];
  }
  return null;
}

/**
 * Alta o edición de una persona del directorio (solo Administración).
 * payload: {id?, nombre, correo, area, activo, admin}
 */
function guardarUsuario_(payload) {
  payload = payload || {};
  var nombre = texto_(payload.nombre, 120);
  var correo = texto_(payload.correo, 160).toLowerCase();
  var area = texto_(payload.area, 120);
  var activo = payload.activo === false ? 'NO' : 'SI';
  var admin = payload.admin === true ? 'SI' : 'NO';

  if (!nombre) throw new Error('El nombre es obligatorio.');
  if (correo && !esCorreo_(correo)) throw new Error('El correo "' + correo + '" no es válido.');
  if (admin === 'SI' && !correo) throw new Error('Para dar permisos de Administración la persona necesita correo registrado: la identidad se detecta por correo.');

  return conLock_(function () {
    var filas = leerTodo_(HOJAS.USUARIOS);
    var id = texto_(payload.id);

    // Nombre duplicado (contra otra persona distinta).
    for (var i = 0; i < filas.length; i++) {
      if (texto_(filas[i].nombre).toLowerCase() === nombre.toLowerCase() && texto_(filas[i].id) !== id) {
        throw new Error('Ya existe una persona con el nombre "' + nombre + '".');
      }
    }

    // Un mismo correo no puede identificar a dos personas activas. La comparación
    // es insensible a mayúsculas/minúsculas porque usuarioActual_ también normaliza.
    if (activo === 'SI' && correo) {
      for (var c = 0; c < filas.length; c++) {
        var otroId = texto_(filas[c].id);
        var otroCorreo = texto_(filas[c].correo).toLowerCase();
        var otroActivo = esVerdadero_(filas[c].activo);
        if (otroId !== id && otroActivo && otroCorreo && otroCorreo === correo) {
          throw new Error('El correo "' + correo + '" ya está registrado para otra persona activa.');
        }
      }
    }

    if (id) {
      for (var j = 0; j < filas.length; j++) {
        if (texto_(filas[j].id) === id) {
          actualizarFila_(HOJAS.USUARIOS, filas[j]._fila, {
            nombre: nombre, correo: correo, area: area, activo: activo, admin: admin
          });
          return { id: id, nombre: nombre, correo: correo, area: area, activo: activo === 'SI', admin: admin === 'SI' };
        }
      }
      throw new Error('No se encontró la persona indicada.');
    }

    id = uuid_();
    agregarFila_(HOJAS.USUARIOS, { id: id, nombre: nombre, correo: correo, area: area, activo: activo, admin: admin });
    return { id: id, nombre: nombre, correo: correo, area: area, activo: activo === 'SI', admin: admin === 'SI' };
  });
}

/* ------------------------------------------------------------------ */
/* Identidad de sesión                                                 */
/* ------------------------------------------------------------------ */

/**
 * Persona del directorio detrás de la sesión actual, cruzando el correo de la
 * cuenta de Google con la que se entró (la Web App ya restringe el acceso al
 * dominio) contra la columna "correo" del directorio. null si esa cuenta no
 * está registrada o está inactiva: no hay forma de elegir "ser" otra persona.
 */
function usuarioActual_() {
  var correo = texto_(Session.getActiveUser().getEmail()).toLowerCase();
  if (!correo) return null;
  var todos = cacheLeer_('usuarios', function () { return listarUsuarios_(true); });
  for (var i = 0; i < todos.length; i++) {
    if (todos[i].correo === correo && todos[i].activo) return todos[i];
  }
  return null;
}

/** Corta la operación si la cuenta que entró no corresponde a nadie del directorio. */
function exigirUsuarioActual_() {
  var u = usuarioActual_();
  if (!u) {
    var correo = texto_(Session.getActiveUser().getEmail());
    // Sin correo no es que la persona no esté dada de alta: es que el navegador
    // abrió la app sin sesión de Google (link abierto desde WhatsApp, ventana de
    // incógnito o navegador embebido). Distinguirlo evita mandar a Administración
    // a dar de alta una cuenta que ya existe.
    if (!correo) {
      throw new Error('No pudimos identificar tu cuenta de Google. Abre el enlace desde ' +
        'Chrome con tu correo de trabajo ya iniciado (o toca "Cambiar de cuenta" y vuelve a entrar).');
    }
    throw new Error('Tu cuenta (' + correo + ') no está registrada en el directorio. ' +
      'Pide a Administración que te dé de alta con ese correo.');
  }
  return u;
}

/** Corta la operación si la sesión actual no tiene permisos de Administración. */
function exigirAdmin_() {
  var u = exigirUsuarioActual_();
  if (!u.admin) throw new Error('Esta acción es solo para Administración.');
  return u;
}

/* ------------------------------------------------------------------ */
/* Diagnóstico y reparación de acceso                                  */
/* ------------------------------------------------------------------ */

/**
 * Revisa la hoja USUARIOS y reporta, cuenta por cuenta, si esa persona puede
 * o no entrar a la Web App. Detecta los tres motivos reales por los que el
 * sistema responde "tu cuenta no está registrada":
 *   1) la hoja perdió la columna "admin" (nadie puede administrar el directorio),
 *   2) la persona no tiene correo capturado o el correo está mal escrito,
 *   3) la persona está inactiva o su correo lo comparte otra persona activa.
 * EJECUTAR desde el editor de Apps Script; el resultado queda en el log.
 */
function diagnosticoAcceso() {
  var sh = hoja_(HOJAS.USUARIOS);
  var idx = indices_(sh);
  var faltantes = ENCABEZADOS.USUARIOS.filter(function (h) { return idx[h] === undefined; });

  var filas = leerTodo_(HOJAS.USUARIOS);
  var porCorreo = {};
  filas.forEach(function (f) {
    var c = texto_(f.correo).toLowerCase();
    if (c && esVerdadero_(f.activo)) porCorreo[c] = (porCorreo[c] || 0) + 1;
  });

  var lineas = filas.map(function (f) {
    var nombre = texto_(f.nombre);
    var correo = texto_(f.correo).toLowerCase();
    var motivos = [];
    if (!esVerdadero_(f.activo)) motivos.push('marcada como inactiva');
    if (!correo) motivos.push('sin correo capturado');
    else if (!esCorreo_(correo)) motivos.push('el correo "' + correo + '" no es una dirección válida');
    else if (porCorreo[correo] > 1) motivos.push('el correo está repetido en otra persona activa');
    else if (dominioSospechoso_(correo)) motivos.push('el dominio parece un error de captura (¿quiso decir @gmail.com?)');
    var admin = idx.admin === undefined ? 'columna "admin" ausente' : (esVerdadero_(f.admin) ? 'Administración' : 'usuario');
    return (motivos.length ? '✗ SIN ACCESO' : '✓ con acceso') + ' — ' + nombre +
      ' <' + (correo || 'sin correo') + '> — ' + admin +
      (motivos.length ? ' — ' + motivos.join('; ') : '');
  });

  var msg = 'Directorio: ' + filas.length + ' persona(s).\n' +
    (faltantes.length
      ? 'ATENCIÓN: la hoja USUARIOS no tiene la(s) columna(s): ' + faltantes.join(', ') +
        '. Corra repararAcceso_(correo) para agregarla(s).\n'
      : '') +
    lineas.join('\n') +
    '\n\nRecuerde: la identidad se toma de la cuenta de Google con la que se abre la Web App. ' +
    'Si el navegador no tiene sesión de Google iniciada, el correo llega vacío y ninguna cuenta coincide.';
  console.log(msg);
  return msg;
}

/**
 * Repara el acceso: reescribe los encabezados de USUARIOS (agrega columnas que
 * falten, como "admin", sin tocar los datos) y deja al correo indicado como
 * Administración activa. EJECUTAR UNA VEZ desde el editor de Apps Script.
 */
function repararAcceso_(correo, nombre) {
  var sh = hoja_(HOJAS.USUARIOS);
  var enc = ENCABEZADOS.USUARIOS;
  sh.getRange(1, 1, 1, enc.length).setValues([enc]).setFontWeight('bold').setBackground('#f1f5f9');
  sh.setFrozenRows(1);
  cacheOlvidar_();
  var res = 'Encabezados de USUARIOS normalizados (' + enc.join(', ') + ').';
  if (texto_(correo)) res += '\n' + otorgarPrimerAdmin_(correo, nombre);
  console.log(res);
  return res + '\n\n' + diagnosticoAcceso();
}

/** Dominios que casi siempre son un error de dedo al capturar el directorio. */
function dominioSospechoso_(correo) {
  var d = String(correo || '').split('@')[1] || '';
  return ['gmai.com', 'gmial.com', 'gmail.co', 'gamil.com', 'hotmial.com', 'hotmail.co']
    .indexOf(d.toLowerCase()) !== -1;
}
