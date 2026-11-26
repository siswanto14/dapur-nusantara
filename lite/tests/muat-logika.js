// Memuat src/Logika.gs sebagai modul Node.js untuk pengujian.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const file = path.join(__dirname, '..', 'src', 'Logika.gs');
const m = new Module(file, module);
m.filename = file;
m._compile(fs.readFileSync(file, 'utf8'), file);
module.exports = m.exports;
