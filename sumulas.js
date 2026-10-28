/* Súmulas MTG/SC: Laço Equipe, Trio, Laçada, Individual, Dupla e Gineteada.
   Layout copiado do PDF original. Dados salvos em DB.sumulas (por rodeio, tipo e folha).
   Exporta .xlsx sem biblioteca externa (funciona offline). */
(function () {
  'use strict';
  const ORG = 'MTG/SC MOVIMENTO TRADICIONALISTA GAÚCHO DO ESTADO DE SANTA CATARINA';
  const L = (t, o) => Object.assign({ t }, o);
  const E = (t, o) => Object.assign({ t, e: 1 }, o);
  const BX = () => ({ e: 1, bx: 1 });
  const boxes = n => Array.from({ length: n }, BX);
  const blank = n => Array.from({ length: n }, () => L(''));
  const ord = () => Array.from({ length: 10 }, (_, j) => L((j + 1) + 'ª', { h: 1, al: 'c' }));
  const SP = n => [{ sp: 1, cs: n }];
  const keys = (ri, a, b) => Array.from({ length: b - a }, (_, i) => ri + '.' + (a + i));
  const head = (n, titulo, edit) => [
    [L(ORG, { cs: n - 3, h: 1, al: 'c', nb: 1 }), E('DATA:', { cs: 3 })],
    [edit ? E(titulo, { cs: n, tit: 1 }) : L(titulo, { cs: n, tit: 1 })]
  ];

  const B = {
    equipe() {
      const n = 8, rows = head(n, 'PLANILHA DE LAÇO EQUIPE'), P = r => rows.push(r) - 1;
      for (let b = 0; b < 5; b++) {
        P([E('NOME:', { cs: 5 }), E('INSCRIÇÃO', { cs: 3, rs: 2, al: 'c' })]);
        P([E('LOCALIDADE:', { cs: 5 })]);
        P([L(''), L('Nº CARTEIRINHA', { h: 1, al: 'c' }), L(''), ...blank(5)]);
        const sum = [];
        for (let i = 1; i <= 4; i++) { const ri = P([L('0' + i, { al: 'c' }), E(''), E(''), ...boxes(5)]); sum.push(...keys(ri, 3, 8)); }
        P([L('TOTAL', { cs: 3, al: 'r', h: 1 }), { sum, calc: 1, cs: 5 }]);
      }
      return { n, w: [5, 16, 34, 6, 6, 6, 6, 6], rows };
    },
    trio() {
      const n = 12, rows = head(n, 'LAÇO TRIO');
      for (let b = 0; b < 10; b++) {
        rows.push([E('Nº', { rs: 4 }), L('NOME DO LAÇADOR', { h: 1, al: 'c' }), ...blank(10)]);
        for (let i = 0; i < 3; i++) rows.push([E(''), ...boxes(10)]);
        rows.push(SP(n));
      }
      return { n, w: [8, 36, ...Array(10).fill(6)], rows };
    },
    lacada() {
      const n = 16, rows = head(n, 'LAÇADA', 1);
      for (let i = 0; i < 45; i++) rows.push([E(''), E(''), ...boxes(14)]);
      return { n, w: [7, 32, ...Array(14).fill(5)], rows };
    },
    individual() {
      const n = 12, rows = head(n, 'LAÇO INDIVIDUAL');
      for (let i = 1; i <= 10; i++) {
        rows.push([L('Nº ' + i, { h: 1 }), E('CTG / PIQUETE'), E('CIDADE:', { cs: 10 })]);
        rows.push([E('IT'), E('NOME:'), ...ord()]);
        const ri = rows.push([L(''), L(''), ...boxes(10)]) - 1;
        rows.push([L('', { cs: 7 }), L('TOTAL', { cs: 2, al: 'r', h: 1 }), { sum: keys(ri, 2, 12), calc: 1, cs: 3 }]);
        rows.push(SP(n));
      }
      return { n, w: [9, 30, ...Array(10).fill(6)], rows };
    },
    dupla() {
      const n = 12, rows = head(n, 'LAÇO DUPLA');
      for (let i = 1; i <= 10; i++) {
        rows.push([E('Nº'), E('CTG / PIQUETE'), E('CIDADE:', { cs: 10 })]);
        rows.push([L('IT', { h: 1, al: 'c' }), L('NOME', { h: 1, al: 'c' }), ...ord()]);
        const a = rows.push([E('', { rs: 2 }), E('1º'), ...boxes(10)]) - 1;
        const b = rows.push([E('2º'), ...boxes(10)]) - 1;
        rows.push([L('', { cs: 7 }), L('TOTAL', { cs: 2, al: 'r', h: 1 }), { sum: [...keys(a, 2, 12), ...keys(b, 1, 11)], calc: 1, cs: 3 }]);
        rows.push(SP(n));
      }
      return { n, w: [9, 30, ...Array(10).fill(6)], rows };
    },
    gineteada() {
      const n = 5, rows = head(n, 'PLANILHA GINETEADA');
      for (let i = 0; i < 13; i++) {
        rows.push([E('IT'), E('CTG / PIQUETE', { cs: 3 }), E('RT:')]);
        rows.push([E('PEÃO', { cs: 2 }), E('TEMPO', { rs: 2, v: 1 }), E('PTS. PERDIDOS', { rs: 2, v: 1 }), E('TOTAL PONTOS', { rs: 2, v: 1 })]);
        rows.push([E('CIDADE', { cs: 2 })]);
        rows.push(SP(n));
      }
      return { n, w: [12, 44, 14, 16, 16], rows };
    }
  };
  const TIPOS = [['equipe', 'Laço Equipe'], ['trio', 'Laço Trio'], ['lacada', 'Laçada'], ['individual', 'Laço Individual'], ['dupla', 'Laço Dupla'], ['gineteada', 'Gineteada']];
  const cache = {};
  const sheet = t => cache[t] || (cache[t] = B[t]());

  /* ---------- calculo ---------- */
  const num = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return isNaN(x) ? 0 : x; };
  const soma = (c, d) => c.sum.reduce((s, k) => s + num(d[k]), 0);
  const fmt = n => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)).replace('.', ','));

  /* ---------- estado ---------- */
  let smT = 'equipe', smF = 0, tm = null;
  const fol = () => {
    DB.sumulas = DB.sumulas || {};
    const k = DB.rodeioAtual + '|' + smT;
    return DB.sumulas[k] || (DB.sumulas[k] = [{}]);
  };
  function grava() {
    clearTimeout(tm); tm = null;
    const id = DB.rodeioAtual + '|' + smT, f = DB.fila, u = f[f.length - 1];
    if (u && u.mod === 'sumulas' && u.id === id) u.ts = Date.now();
    else f.push({ ts: Date.now(), op: 'Alteração', mod: 'sumulas', id });
    save();
  }

  /* ---------- html ---------- */
  function tbl(S, d) {
    const larg = S.w.reduce((a, b) => a + b, 0);
    let h = `<table class="sm" style="width:calc(${larg}ch + ${S.n * 10}px)"><colgroup>${S.w.map(w => `<col style="width:${w}ch">`).join('')}</colgroup><tbody>`;
    S.rows.forEach((row, r) => {
      h += row[0].sp ? '<tr class="sp">' : '<tr>';
      row.forEach((c, ci) => {
        const k = r + '.' + ci, a = (c.cs > 1 ? ` colspan="${c.cs}"` : '') + (c.rs > 1 ? ` rowspan="${c.rs}"` : '');
        const cl = [c.h && 'h', c.al && 'a' + c.al, c.tit && 'tit', c.nb && 'nb', c.bx && 'bx', c.sp && 'sp', c.calc && 'cl'].filter(Boolean).join(' ');
        let i;
        if (c.calc) i = `<b data-calc="${k}">${fmt(soma(c, d))}</b>`;
        else if (c.e) i = `<div class="fl${c.v ? ' vt' : ''}">${c.t ? `<span>${esc(c.t)}</span>` : ''}<input data-k="${k}" value="${esc(d[k] || '')}"></div>`;
        else i = esc(c.t || '');
        h += `<td class="${cl}"${a}>${i}</td>`;
      });
      h += '</tr>';
    });
    return h + '</tbody></table>';
  }
  window.sumulasHtml = function () {
    if (!DB.rodeioAtual) return '<h2>Súmulas MTG/SC</h2><div class="vazio">Cadastre e selecione um rodeio para usar as súmulas.</div>';
    const fl = fol(); if (smF >= fl.length) smF = fl.length - 1;
    return `<h2>Súmulas MTG/SC</h2>
    <div class="bar">${TIPOS.map(([k, l]) => `<button class="btn ${k === smT ? '' : 'sec'}" data-sm-t="${k}">${l}</button>`).join('')}</div>
    <div class="bar"><select id="sm-folha">${fl.map((_, i) => `<option value="${i}" ${i === smF ? 'selected' : ''}>Folha ${i + 1}</option>`).join('')}</select>
      <button class="btn sec" id="sm-nova">Nova folha</button><button class="btn" id="sm-xls">Exportar Excel (esta folha)</button>
      <button class="btn sec" id="sm-xlsall">Exportar Excel (todas as folhas)</button><button class="btn sec" id="sm-imp">Imprimir</button>
      <button class="btn red" id="sm-limpa">Limpar folha</button></div>
    <div class="wrap sm-wrap">${tbl(sheet(smT), fl[smF])}</div>
    <div class="pag"><span>Escreva direto nas células. O TOTAL é somado automaticamente. As alterações ficam salvas neste computador.</span></div>`;
  };

  /* ---------- exportacao .xlsx (zip sem compressao) ---------- */
  function crc32(b) {
    const t = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }));
    let r = -1; for (const x of b) r = t[(r ^ x) & 255] ^ (r >>> 8); return (r ^ -1) >>> 0;
  }
  function zip(files) {
    const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
    const u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
    for (const f of files) {
      const nm = enc.encode(f.name), d = enc.encode(f.data), crc = crc32(d);
      const lh = [0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nm.length), ...u16(0)];
      parts.push(new Uint8Array(lh), nm, d);
      cen.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nm.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nm);
      off += lh.length + nm.length + d.length;
    }
    const cs = cen.reduce((s, a) => s + a.length, 0);
    const end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cs), ...u32(off), 0, 0]);
    return new Blob([...parts, ...cen, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  const xe = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const colL = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const styleOf = c => (c.tit ? 5 : c.nb ? 3 : c.al === 'r' ? 4 : c.h ? 2 : (c.al === 'c' || c.bx) ? 6 : 1);

  function sheetXml(S, d) {
    const occ = {}, addr = {}, rx = {}, merges = [];
    S.rows.forEach((row, r) => {
      let c = 0; rx[r] = [];
      row.forEach((cell, ci) => {
        while (occ[r + ',' + c]) c++;
        const cs = cell.cs || 1, rs = cell.rs || 1, key = r + '.' + ci, a = colL(c) + (r + 1), st = cell.sp ? 0 : styleOf(cell);
        addr[key] = a;
        for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) {
          occ[(r + i) + ',' + (c + j)] = 1;
          if (i || j) { rx[r + i] = rx[r + i] || []; rx[r + i].push({ c: c + j, x: `<c r="${colL(c + j)}${r + i + 1}" s="${st}"/>` }); }
        }
        let x;
        if (cell.calc) x = `<c r="${a}" s="${st}"><f>SUM(${cell.sum.map(k => addr[k]).join(',')})</f><v>${soma(cell, d)}</v></c>`;
        else {
          const val = d[key] ?? '';
          if (cell.bx && val !== '' && !isNaN(String(val).replace(',', '.'))) x = `<c r="${a}" s="${st}"><v>${num(val)}</v></c>`;
          else {
            const txt = cell.e ? ((cell.t ? cell.t + ' ' : '') + val).trim() : (cell.t || '');
            x = txt ? `<c r="${a}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${xe(txt)}</t></is></c>` : `<c r="${a}" s="${st}"/>`;
          }
        }
        rx[r].push({ c, x });
        if (!cell.sp && (cs > 1 || rs > 1)) merges.push(`${a}:${colL(c + cs - 1)}${r + rs}`);
        c += cs;
      });
    });
    const rows = S.rows.map((row, r) => {
      const ht = row[0].sp ? 6 : (row[0].tit || (row[1] && row[1].tit)) ? 24 : 18;
      return `<row r="${r + 1}" ht="${ht}" customHeight="1">${rx[r].sort((a, b) => a.c - b.c).map(o => o.x).join('')}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView showGridLines="0" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${S.w.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w + 2}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData>${merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  }
  const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs></styleSheet>';

  function xlsx(S, lista) {
    const n = lista.length, NS = 'xmlns="http://schemas.openxmlformats.org/package/2006/relationships"', H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const files = [
      { name: '[Content_Types].xml', data: H + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + lista.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>' },
      { name: '_rels/.rels', data: H + `<Relationships ${NS}><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: 'xl/workbook.xml', data: H + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + lista.map((_, i) => `<sheet name="Folha ${i + 1}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: H + `<Relationships ${NS}>` + lista.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: STYLES },
      ...lista.map((d, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(S, d) }))
    ];
    return zip(files);
  }
  window.sumulasXlsx = xlsx; window.sumulasSheet = sheet;

  function baixarXlsx(todas) {
    const fl = fol(), lista = todas ? fl : [fl[smF]];
    const rod = (by('rodeios', DB.rodeioAtual)?.nome || 'rodeio').replace(/[^\w\-]+/g, '_');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(xlsx(sheet(smT), lista));
    a.download = `${smT}-${rod}${todas ? '' : '-folha' + (smF + 1)}.xlsx`; a.click(); URL.revokeObjectURL(a.href);
  }

  /* ---------- eventos ---------- */
  const cont = document.getElementById('conteudo');
  if (!cont) return;
  cont.addEventListener('input', e => {
    if (cur !== 'sumulas' || !e.target.dataset.k) return;
    fol()[smF][e.target.dataset.k] = e.target.value;
    const S = sheet(smT), d = fol()[smF];
    cont.querySelectorAll('[data-calc]').forEach(b => { const [r, c] = b.dataset.calc.split('.'); b.textContent = fmt(soma(S.rows[r][c], d)); });
    clearTimeout(tm); tm = setTimeout(grava, 300);
  });
  cont.addEventListener('change', e => { if (cur === 'sumulas' && e.target.id === 'sm-folha') { smF = +e.target.value; render(); } });
  cont.addEventListener('click', e => {
    if (cur !== 'sumulas') return;
    const t = e.target;
    if (t.dataset.smT) { if (tm) grava(); smT = t.dataset.smT; smF = 0; render(); }
    else if (t.id === 'sm-nova') { fol().push({}); smF = fol().length - 1; grava(); render(); }
    else if (t.id === 'sm-imp') window.print();
    else if (t.id === 'sm-xls') baixarXlsx(false);
    else if (t.id === 'sm-xlsall') baixarXlsx(true);
    else if (t.id === 'sm-limpa') confirmar('Limpar todos os dados desta folha? Faça um backup antes se precisar deles.', () => { fol()[smF] = {}; grava(); render(); });
  });
  window.addEventListener('beforeunload', () => { if (tm) grava(); });
})();