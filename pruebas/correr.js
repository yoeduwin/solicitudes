/**
 * correr.js — Ejecuta las pruebas del backend fuera de Google.
 *
 * Concatena los archivos .gs con un simulador mínimo de los servicios de
 * Apps Script (Sheets, Drive, Mail, Lock, Utilities) y corre pruebas.js.
 * Sirve para validar la lógica antes de subir el código al proyecto real.
 *
 *   node pruebas/correr.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const raiz = path.join(__dirname, '..');
const orden = ['Utils', 'Config', 'Users', 'Drive', 'Notifications', 'Tickets', 'Code'];

let fuente = fs.readFileSync(path.join(__dirname, 'simulador.js'), 'utf8');
orden.forEach(function (n) {
  fuente += '\n' + fs.readFileSync(path.join(raiz, 'src', n + '.gs'), 'utf8');
});
fuente += '\n' + fs.readFileSync(path.join(__dirname, 'pruebas.js'), 'utf8');

try {
  vm.runInThisContext(fuente, { filename: 'sistema.js' });
} catch (e) {
  console.error('\n' + e.message);
  process.exit(1);
}
