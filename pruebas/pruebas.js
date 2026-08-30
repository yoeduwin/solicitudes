/**
 * pruebas.js — Aserciones sobre la lógica del backend.
 * Se ejecuta con: node pruebas/correr.js
 */

function assert(c,m){ if(!c) throw new Error('FALLO: '+m); console.log('  ok · '+m); }
console.log('0. asignar hoja a un proyecto independiente');
try { configurarHoja(''); throw new Error('x'); }
catch (e) { assert(/ID o la URL/.test(e.message), 'exige el ID de la hoja'); }
try { configurarHoja('1noExiste'); throw new Error('x'); }
catch (e) { assert(/No such spreadsheet/.test(e.message), 'rechaza un ID inválido'); }
assert(/hoja-buena/.test(configurarHoja('https://docs.google.com/spreadsheets/d/hoja-buena/edit#gid=0')),
  'extrae el ID desde la URL completa');

console.log('1. instalar()'); instalar();
assert(listarUsuarios_(false).length===5,'directorio con 5 personas');
guardarUsuario_({nombre:'Jimmy Ayala',correo:'jimmy@ea.mx',area:'Atención a Clientes',id:listarUsuarios_(true).filter(u=>u.nombre==='Jimmy Ayala')[0].id});
guardarUsuario_({nombre:'Eduwin',correo:'eduwin@ea.mx',area:'Dirección',id:listarUsuarios_(true).filter(u=>u.nombre==='Eduwin')[0].id});
const jimmy=buscarUsuario_(null,'Jimmy Ayala'), eduwin=buscarUsuario_(null,'Eduwin');
assert(jimmy.correo==='jimmy@ea.mx','correo guardado');

console.log('2. crearSolicitud_()');
const r=crearSolicitud_({solicitante_id:eduwin.id,responsable_id:jimmy.id,categoria:'Compra',
  prioridad:'Alta',titulo:'Comprar EPP',descripcion:'Cascos y guantes',fecha_limite:'2020-01-01',
  archivos:[{nombre:'coti.pdf',tipo:'application/pdf',datos:Buffer.from('x'.repeat(100)).toString('base64')}]});
assert(/^SI-\d{6}-001$/.test(r.solicitud.folio),'folio '+r.solicitud.folio);
assert(r.correo_enviado===true,'correo al responsable enviado');
assert(r.adjuntos.length===1,'adjunto guardado');
assert(r.solicitud.vencida===true,'fecha pasada => vencida');
assert(r.solicitud.estado==='Pendiente','nace Pendiente');

const r2=crearSolicitud_({solicitante_id:jimmy.id,responsable_id:eduwin.id,categoria:'Otro',
  prioridad:'Normal',titulo:'Revisar contrato',descripcion:'x',fecha_limite:hoyISO_()});
assert(r2.solicitud.folio.endsWith('-002'),'folio consecutivo '+r2.solicitud.folio);
assert(r2.solicitud.vence_hoy===true,'vence hoy');
assert(r2.solicitud.vencida===false,'vence hoy no es vencida');

console.log('3. validaciones');
try{crearSolicitud_({solicitante_id:eduwin.id,responsable_id:jimmy.id,categoria:'Compra',titulo:'',descripcion:'y',fecha_limite:'2030-01-01'});throw new Error('x');}
catch(e){assert(/título/i.test(e.message),'exige título');}
try{crearSolicitud_({solicitante_id:eduwin.id,responsable_id:jimmy.id,categoria:'Inventada',titulo:'a',descripcion:'y',fecha_limite:'2030-01-01'});throw new Error('x');}
catch(e){assert(/categoría/i.test(e.message),'rechaza categoría inválida');}
try{validarArchivos_([{nombre:'a.exe',tipo:'application/x-msdownload',datos:'AAA'}]);throw new Error('x');}
catch(e){assert(/formato permitido/.test(e.message),'rechaza tipo no permitido');}

console.log('4. estados');
const id=r.solicitud.id;
try{cambiarEstado_(id,'Cerrada','Jimmy Ayala',false);throw new Error('x');}
catch(e){assert(/Administración/.test(e.message),'General no puede cerrar');}
let e1=cambiarEstado_(id,'En proceso','Jimmy Ayala',false);
assert(e1.solicitud.estado==='En proceso' && e1.solicitud.vencida===true,'En proceso · VENCIDA');
MAILS.length=0;
let e2=cambiarEstado_(id,'Atendida','Jimmy Ayala',false);
assert(e2.solicitud.vencida===false,'Atendida ya no es vencida');
assert(e2.correo_enviado===true && MAILS[0].to==='eduwin@ea.mx','avisa al solicitante');
let e3=cambiarEstado_(id,'Cerrada','Eduwin',true);
assert(!!e3.solicitud.fecha_cierre,'guarda fecha_cierre');

console.log('5. reasignar / comentar / historial');
MAILS.length=0;
const re=reasignar_(r2.solicitud.id,jimmy.id,'Eduwin');
assert(re.solicitud.responsable_nombre==='Jimmy Ayala' && re.correo_enviado,'reasignada y notificada');
const c1=agregarComentario_(r2.solicitud.id,{autor_id:eduwin.id,comentario:'Sin prisa',notificar:false});
assert(c1.correo_enviado===false,'sin notificar => sin correo');
MAILS.length=0;
const c2=agregarComentario_(r2.solicitud.id,{autor_id:eduwin.id,comentario:'Ya urge',notificar:true});
assert(c2.correo_enviado===true && MAILS[0].to==='jimmy@ea.mx','notificar => correo al responsable');
const det=detalleSolicitud_(r2.solicitud.id);
assert(det.comentarios.length===2,'2 comentarios');
const acciones=det.historial.map(h=>h.accion);
assert(acciones.indexOf('Creación')>=0 && acciones.indexOf('Reasignación')>=0 && acciones.indexOf('Comentario')>=0,
  'historial: '+acciones.join(', '));

console.log('6. edición admin');
const ed=actualizarSolicitud_(r2.solicitud.id,{prioridad:'Urgente',cliente_proyecto:'Planta Norte'},'Eduwin');
assert(ed.solicitud.prioridad==='Urgente' && ed.solicitud.cliente_proyecto==='Planta Norte','edición aplicada');

console.log('7. recordatorio diario');
MAILS.length=0;
crearSolicitud_({solicitante_id:eduwin.id,responsable_id:jimmy.id,categoria:'Revisión',prioridad:'Normal',
  titulo:'Atrasada',descripcion:'z',fecha_limite:'2019-05-05'});
MAILS.length=0;
enviarRecordatoriosDiarios();
assert(MAILS.length===1 && MAILS[0].to==='jimmy@ea.mx','un solo correo consolidado por responsable');

console.log('8. fallo de correo no pierde la solicitud');
const original=MailApp.sendEmail;
MailApp.sendEmail=()=>{throw new Error('cuota agotada');};
const rf=crearSolicitud_({solicitante_id:eduwin.id,responsable_id:jimmy.id,categoria:'Otro',prioridad:'Normal',
  titulo:'Con correo roto',descripcion:'w',fecha_limite:'2030-01-01'});
MailApp.sendEmail=original;
assert(rf.correo_enviado===false && !!rf.solicitud.folio,'solicitud guardada pese al fallo');
assert(historialDe_(rf.solicitud.id).some(h=>h.accion==='Notificación fallida'),'fallo registrado en historial');

console.log('9. API');
const ini=apiInicio();
assert(ini.ok && ini.datos.solicitudes.length===4,'apiInicio: '+ini.datos.solicitudes.length+' solicitudes');
assert(apiDetalle('inexistente').ok===false,'error controlado, no excepción');
console.log('\nTODAS LAS PRUEBAS PASARON');
