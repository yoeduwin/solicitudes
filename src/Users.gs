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
    throw new Error('Tu cuenta' + (correo ? ' (' + correo + ')' : '') +
      ' no está registrada en el directorio. Pide a Administración que te dé de alta con ese correo.');
  }
  return u;
}

/** Corta la operación si la sesión actual no tiene permisos de Administración. */
function exigirAdmin_() {
  var u = exigirUsuarioActual_();
  if (!u.admin) throw new Error('Esta acción es solo para Administración.');
  return u;
}
