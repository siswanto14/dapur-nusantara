// Tiruan (mock) minimal layanan Google Apps Script untuk menguji seluruh alur di Node.js.
// Meniru perilaku penting Google Sheets: teks angka/tanggal otomatis dikonversi,
// kecuali diawali tanda kutip ('), dan getLastRow() hanya menghitung baris berisi.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const JAKARTA_MS = 7 * 3600 * 1000;

/** Seperti Google Sheets saat menerima nilai dari setValues(). */
function nilaiMasuk(v) {
  if (typeof v !== 'string') return v;
  if (v.startsWith("'")) return v.slice(1);
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?$/.exec(v);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) - JAKARTA_MS);
  m = /^(\d{2}):(\d{2})$/.exec(v);
  if (m) return new Date(Date.UTC(1899, 11, 30, +m[1], +m[2]) - JAKARTA_MS);
  return v;
}

class Range {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr: nr || 1, nc: nc || 1 }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) {
        const v = (this.sheet.data[this.r - 1 + i] || [])[this.c - 1 + j];
        row.push(v === undefined ? '' : v);
      }
      out.push(row);
    }
    return out;
  }
  setValues(vals) {
    if (vals.length !== this.nr || vals[0].length !== this.nc) throw new Error('Ukuran setValues tidak cocok');
    vals.forEach((row, i) => row.forEach((v, j) => this.sheet.set(this.r + i, this.c + j, nilaiMasuk(v))));
    return this;
  }
  setValue(v) { this.sheet.set(this.r, this.c, nilaiMasuk(v)); return this; }
  clearContent() {
    for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet.set(this.r + i, this.c + j, '');
    return this;
  }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setNumberFormat() { return this; }
  setDataValidation() { return this; }
}

class Sheet {
  constructor(ss, name) { this.ss = ss; this.name = name; this.data = []; this.protections = []; }
  getName() { return this.name; }
  set(r, c, v) {
    while (this.data.length < r) this.data.push([]);
    this.data[r - 1][c - 1] = v;
  }
  getLastRow() {
    for (let i = this.data.length - 1; i >= 0; i--) {
      if ((this.data[i] || []).some((v) => v !== '' && v !== undefined)) return i + 1;
    }
    return 0;
  }
  getLastColumn() { return Math.max(0, ...this.data.map((r) => r.length)); }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr, nc); }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  deleteRow(r) { this.data.splice(r - 1, 1); }
  setFrozenRows() {}
  autoResizeColumns() {}
  getMaxRows() { return Math.max(1000, this.data.length); }
  getMaxColumns() { return 26; }
  getProtections() { return this.protections; }
  protect() {
    const p = { setDescription() { return p; }, setWarningOnly(w) { p.warning = w; return p; } };
    this.protections.push(p);
    return p;
  }
}

class Spreadsheet {
  constructor(name, owner) { this.name = name; this.owner = owner; this.sheets = [new Sheet(this, 'Sheet1')]; this.id = 'ss-' + Math.random().toString(36).slice(2); }
  getName() { return this.name; }
  getId() { return this.id; }
  getOwner() { const e = this.owner; return { getEmail: () => e }; }
  setSpreadsheetTimeZone() {}
  getSheets() { return this.sheets.slice(); }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(this, n); this.sheets.push(s); return s; }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
}

function formatDate(d, tz, fmt) {
  const x = new Date(d.getTime() + JAKARTA_MS);
  const p = (n) => String(n).padStart(2, '0');
  return fmt.replace('yyyy', x.getUTCFullYear()).replace('MM', p(x.getUTCMonth() + 1)).replace('dd', p(x.getUTCDate()))
    .replace('HH', p(x.getUTCHours())).replace('mm', p(x.getUTCMinutes()));
}

/**
 * Buat lingkungan Apps Script tiruan dan muat semua file .gs.
 * opsi.email: email pengguna aktif (bisa diganti lewat env.setEmail).
 */
function buatLingkungan(opsi = {}) {
  const pemilik = opsi.pemilik || 'pemilik@contoh.id';
  const ss = new Spreadsheet('Dapur Nusantara Lite', pemilik);
  const semuaSs = { [ss.id]: ss };
  let email = opsi.email === undefined ? pemilik : opsi.email;
  let waktuSekarang = opsi.sekarang || new Date('2026-11-27T02:00:00Z'); // 09.00 WIB
  const cache = {};
  const triggers = [];
  const RealDate = Date;

  class FakeDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(waktuSekarang.getTime()); }
    static now() { return waktuSekarang.getTime(); }
    static [Symbol.hasInstance](x) { return x instanceof RealDate; }
  }

  const ctx = {
    console,
    Date: FakeDate,
    JSON, Math, Number, String, Object, Array, Error, RegExp, isFinite, parseInt, parseFloat, encodeURIComponent,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      openById: (id) => { if (!semuaSs[id]) throw new Error('tidak ada'); return semuaSs[id]; },
      create: (name) => { const s = new Spreadsheet(name, pemilik); semuaSs[s.id] = s; return s; },
      flush() {},
      getUi() { throw new Error('UI tidak tersedia di pengujian'); },
      newDataValidation() {
        const b = { requireValueInList: () => b, setAllowInvalid: () => b, requireNumberGreaterThanOrEqualTo: () => b, build: () => ({}) };
        return b;
      },
      ProtectionType: { SHEET: 'SHEET' },
    },
    Session: {
      getActiveUser: () => ({ getEmail: () => email }),
      getEffectiveUser: () => ({ getEmail: () => pemilik }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (k in cache ? cache[k] : null),
        put: (k, v) => { cache[k] = v; },
        remove: (k) => { delete cache[k]; },
        removeAll: (ks) => ks.forEach((k) => delete cache[k]),
      }),
    },
    Utilities: { formatDate },
    Logger: { log() {} },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: (t) => triggers.splice(triggers.indexOf(t), 1),
      newTrigger: (fn) => {
        const b = { timeBased: () => b, everyDays: () => b, atHour: () => b, inTimezone: () => b,
          create: () => { const t = { getHandlerFunction: () => fn }; triggers.push(t); return t; } };
        return b;
      },
      getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/TIRUAN/exec' }),
    },
  };
  vm.createContext(ctx);
  const dir = path.join(__dirname, '..', 'src');
  fs.readdirSync(dir).filter((f) => f.endsWith('.gs')).sort().forEach((f) => {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
  });

  return {
    ctx,
    ss,
    semuaSs,
    triggers,
    setEmail: (e) => { email = e; },
    setSekarang: (d) => { waktuSekarang = new RealDate(d); },
    /** Panggil fungsi server seperti google.script.run: hasil harus bisa di-JSON-kan. */
    panggil(nama, ...args) {
      const hasil = ctx[nama](...JSON.parse(JSON.stringify(args)));
      const json = JSON.stringify(hasil === undefined ? null : hasil);
      if (/"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z"/.test(json)) {
        throw new Error('Hasil ' + nama + ' berisi objek Date (google.script.run akan gagal)');
      }
      return JSON.parse(json);
    },
    sheet: (n) => ss.getSheetByName(n),
  };
}

module.exports = { buatLingkungan };
