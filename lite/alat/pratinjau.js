#!/usr/bin/env node
// Pratinjau lokal halaman web app tanpa akun Google.
// Memakai tiruan Apps Script (tests/tiruan-apps-script.js) berisi data contoh.
//
//   node alat/pratinjau.js            -> http://localhost:8080/        (form publik)
//                                        http://localhost:8080/?halaman=admin
//   PORT=3000 node alat/pratinjau.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { buatLingkungan } = require('../tests/tiruan-apps-script');

const SRC = path.join(__dirname, '..', 'src');
const env = buatLingkungan();
env.ctx.siapkanSheet();
env.ctx.isiDataContoh();
env.ctx.simpanPengaturan_('no_wa', "'081200001111");

/** Penilai template HtmlService sederhana: <?= ?>, <?!= ?>, <? ?>. */
function render(file, scope) {
  const src = fs.readFileSync(path.join(SRC, file + '.html'), 'utf8');
  let code = 'let __o = "";\n';
  const re = /<\?(!=|=)?([\s\S]*?)\?>/g;
  let last = 0, m;
  while ((m = re.exec(src))) {
    code += '__o += ' + JSON.stringify(src.slice(last, m.index)) + ';\n';
    if (m[1] === '!=') code += '__o += String(' + m[2] + ');\n';
    else if (m[1] === '=') code += '__o += __esc(' + m[2] + ');\n';
    else code += m[2] + '\n';
    last = re.lastIndex;
  }
  code += '__o += ' + JSON.stringify(src.slice(last)) + ';\nreturn __o;';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const names = Object.keys(scope);
  // eslint-disable-next-line no-new-func
  return new Function(...names, '__esc', code)(...names.map((n) => scope[n]), esc);
}

const SHIM = `<script>
window.google = { script: { run: (function buat(ok, gagal) {
  return new Proxy({}, { get: function (_, nama) {
    if (nama === 'withSuccessHandler') return function (f) { return buat(f, gagal); };
    if (nama === 'withFailureHandler') return function (f) { return buat(ok, f); };
    return function () {
      var args = Array.prototype.slice.call(arguments);
      fetch('/api/' + nama, { method: 'POST', body: JSON.stringify(args) }).then(function (r) { return r.json(); })
        .then(function (j) { setTimeout(function () { j.galat ? gagal && gagal(new Error(j.galat)) : ok && ok(j.hasil); }, 150); });
    };
  } });
})() } };
</script>`;

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const nama = url.pathname.slice(5);
      res.setHeader('Content-Type', 'application/json');
      try {
        if (nama.endsWith('_') || typeof env.ctx[nama] !== 'function') throw new Error('Fungsi tidak ada: ' + nama);
        res.end(JSON.stringify({ hasil: env.panggil(nama, ...JSON.parse(body || '[]')) }));
      } catch (e) {
        res.end(JSON.stringify({ galat: e.message }));
      }
    });
    return;
  }
  if (url.pathname !== '/') { res.statusCode = 404; res.end(); return; }
  const halaman = url.searchParams.get('halaman') === 'admin' ? 'Admin' : 'Publik';
  if (url.searchParams.has('email')) env.setEmail(url.searchParams.get('email'));
  const html = render(halaman, { include: (n) => render(n, {}), branding: env.ctx.branding_() });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(html.replace('<head>', '<head><meta name="viewport" content="width=device-width, initial-scale=1">' + SHIM));
}).listen(process.env.PORT || 8080, () => {
  console.log('Pratinjau: http://localhost:' + (process.env.PORT || 8080) + '/  dan  /?halaman=admin');
});
