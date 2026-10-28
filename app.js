'use strict';
/* Secretaria de Rodeio - front-end offline-first.
   Dados ficam no navegador e cada alteracao entra na fila DB.fila.
   O envio da fila ao servidor (Supabase) ainda NAO esta implementado: ver sincronizar(). */

const KEY = 'secretaria-rodeio-v2';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const brl = n => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dbr = d => (d ? d.split('-').reverse().join('/') : '');
const hoje = () => new Date().toISOString().slice(0, 10);

const VAZIO = { rodeios: [], competidores: [], categorias: [], inscricoes: [], duplas: [], lancamentos: [], despesas: [], receitas: [], usuarios: [], auditoria: [], fila: [], rodeioAtual: null, cfg: { prefixo: '' } };
let DB;
try { DB = Object.assign(structuredClone(VAZIO), JSON.parse(localStorage.getItem(KEY) || '{}')); }
catch { DB = structuredClone(VAZIO); }

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(DB)); }
  catch { toast('Erro ao salvar no navegador', true); }
  status();
}

/* ---------- consultas ---------- */
const scope = t => DB[t].filter(r => r.rodeioId === DB.rodeioAtual);
const by = (t, id) => DB[t].find(x => x.id === id);
const nomeComp = id => by('competidores', id)?.nome || '-';
const nomeCat = id => { const c = by('categorias', id); return c ? c.modalidade + ' / ' + c.nome : '-'; };
const nomeInsc = id => { const i = by('inscricoes', id); return i ? i.numero + ' - ' + nomeComp(i.competidorId) : '-'; };
const final = i => Math.max(0, (+i.valor || 0) - (+i.desconto || 0));
const pago = i => DB.lancamentos.filter(l => l.inscricaoId === i.id).reduce((s, l) => s + (l.tipo === 'Estorno' ? -l.valor : l.valor), 0);
const saldo = i => (i.status === 'Cancelada' ? 0 : final(i) - pago(i));

const REF = {
  competidores: { rows: () => DB.competidores, label: r => r.nome },
  categorias: { rows: () => scope('categorias'), label: r => r.modalidade + ' / ' + r.nome },
  inscricoes: { rows: () => scope('inscricoes'), label: r => r.numero + ' - ' + nomeComp(r.competidorId) }
};

/* ---------- validacoes ---------- */
function cpfOk(v) {
  const s = String(v).replace(/\D/g, '');
  if (s.length !== 11 || /^(\d)\1+$/.test(s)) return false;
  for (let t = 9; t < 11; t++) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += +s[i] * (t + 1 - i);
    if (((soma * 10) % 11) % 10 !== +s[t]) return false;
  }
  return true;
}
const UFS = ['', 'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const ST_INSC = ['Pré-inscrita', 'Confirmada', 'Pendente', 'Cancelada', 'Lista de espera'];

/* ---------- definicao dos modulos ---------- */
const MOD = {
  rodeios: {
    titulo: 'Rodeios', scoped: false,
    cols: [
      { k: 'nome', l: 'Nome', req: 1 }, { k: 'entidade', l: 'Entidade organizadora' }, { k: 'local', l: 'Local' },
      { k: 'cidade', l: 'Cidade' }, { k: 'uf', l: 'UF', opts: UFS }, { k: 'inicio', l: 'Início', t: 'date' }, { k: 'fim', l: 'Encerramento', t: 'date' },
      { k: 'status', l: 'Status', opts: ['Planejamento', 'Inscrições abertas', 'Em andamento', 'Encerrado', 'Cancelado'] },
      { k: 'obs', l: 'Observações' }
    ],
    check: r => (r.inicio && r.fim && r.fim < r.inicio ? 'A data de encerramento não pode ser anterior ao início.' : '')
  },
  competidores: {
    titulo: 'Competidores', scoped: false,
    cols: [
      { k: 'nome', l: 'Nome completo', req: 1 }, { k: 'cpf', l: 'CPF' }, { k: 'nasc', l: 'Nascimento', t: 'date' }, { k: 'tel', l: 'Telefone' },
      { k: 'cidade', l: 'Cidade' }, { k: 'uf', l: 'UF', opts: UFS }, { k: 'ctg', l: 'CTG / entidade' }, { k: 'equipe', l: 'Equipe' },
      { k: 'status', l: 'Status', opts: ['Ativo', 'Inativo'] }, { k: 'obs', l: 'Observações' }
    ],
    check: r => {
      if (r.cpf) {
        if (!cpfOk(r.cpf)) return 'CPF inválido.';
        const d = DB.competidores.find(x => x.id !== r.id && String(x.cpf).replace(/\D/g, '') === String(r.cpf).replace(/\D/g, ''));
        if (d) return 'Já existe competidor com este CPF: ' + d.nome + '.';
      }
      return '';
    },
    defaults: () => ({ status: 'Ativo' })
  },
  categorias: {
    titulo: 'Categorias e modalidades', scoped: true,
    cols: [
      { k: 'modalidade', l: 'Modalidade', req: 1 }, { k: 'nome', l: 'Categoria', req: 1 }, { k: 'formato', l: 'Formato', opts: ['Individual', 'Dupla', 'Equipe'] },
      { k: 'valor', l: 'Valor', t: 'money' }, { k: 'limite', l: 'Limite (0 = sem limite)', t: 'number' },
      { k: 'abre', l: 'Abertura', t: 'date' }, { k: 'fecha', l: 'Encerramento', t: 'date' },
      { k: 'status', l: 'Status', opts: ['Aberta', 'Encerrada'] }, { k: 'obs', l: 'Regulamento / observações' }
    ],
    check: r => (r.abre && r.fecha && r.fecha < r.abre ? 'O encerramento não pode ser anterior à abertura.' : ''),
    defaults: () => ({ formato: 'Individual', status: 'Aberta', valor: 0, limite: 0 })
  },
  inscricoes: {
    titulo: 'Inscrições e planilhas', scoped: true,
    cols: [
      { k: 'numero', l: 'Nº', ro: 1 },
      { k: 'competidorId', l: 'Competidor', ref: 'competidores', req: 1 },
      { k: 'cpfv', l: 'CPF', calc: r => by('competidores', r.competidorId)?.cpf || '' },
      { k: 'categoriaId', l: 'Categoria', ref: 'categorias', req: 1 },
      { k: 'equipe', l: 'Equipe' },
      { k: 'valor', l: 'Valor', t: 'money' }, { k: 'desconto', l: 'Desconto', t: 'money' },
      { k: 'vfinal', l: 'Valor final', t: 'money', calc: final },
      { k: 'pagov', l: 'Pago', t: 'money', calc: pago },
      { k: 'saldov', l: 'Saldo', t: 'money', calc: saldo, hl: r => saldo(r) > 0 },
      { k: 'status', l: 'Situação', opts: ST_INSC },
      { k: 'forma', l: 'Forma de pagto.', opts: ['', 'Dinheiro', 'Pix', 'Cartão', 'Transferência'] },
      { k: 'obs', l: 'Observações / motivo cancel.' }
    ],
    check: (r, novo) => {
      if (+r.desconto > +r.valor) return 'O desconto não pode ser maior que o valor.';
      if (r.status === 'Cancelada' && !r.obs) return 'Informe o motivo do cancelamento em Observações.';
      const dup = scope('inscricoes').find(x => x.id !== r.id && x.competidorId === r.competidorId && x.categoriaId === r.categoriaId && x.status !== 'Cancelada');
      if (dup && r.status !== 'Cancelada') return 'Este competidor já está inscrito nesta categoria (nº ' + dup.numero + ').';
      return '';
    },
    onNew: r => {
      const c = by('categorias', r.categoriaId);
      if (c && !r.valor) r.valor = c.valor;
      const nums = scope('inscricoes').map(x => parseInt(String(x.numero).replace(/\D/g, ''), 10) || 0);
      r.numero = (DB.cfg.prefixo || '') + String(Math.max(0, ...nums) + 1).padStart(3, '0');
      if (c && +c.limite > 0 && r.status !== 'Cancelada') {
        const n = scope('inscricoes').filter(x => x.categoriaId === c.id && ['Confirmada', 'Pré-inscrita', 'Pendente'].includes(x.status)).length;
        if (n >= +c.limite) r.status = 'Lista de espera';
      }
    },
    defaults: () => ({ status: 'Pendente', valor: 0, desconto: 0 })
  },
  duplas: {
    titulo: 'Duplas e equipes', scoped: true,
    cols: [
      { k: 'nome', l: 'Nome da dupla / equipe', req: 1 }, { k: 'categoriaId', l: 'Categoria', ref: 'categorias', req: 1 },
      { k: 'int1', l: 'Integrante 1 (responsável)', ref: 'competidores', req: 1 }, { k: 'int2', l: 'Integrante 2', ref: 'competidores', req: 1 },
      { k: 'obs', l: 'Substituições / observações' }
    ],
    check: r => {
      if (r.int1 === r.int2) return 'Os integrantes devem ser diferentes.';
      const d = scope('duplas').find(x => x.id !== r.id && x.categoriaId === r.categoriaId && [x.int1, x.int2].sort().join() === [r.int1, r.int2].sort().join());
      return d ? 'Esta combinação já existe nesta categoria.' : '';
    }
  },
  lancamentos: {
    titulo: 'Pagamentos', scoped: true, imutavel: true,
    cols: [
      { k: 'data', l: 'Data', t: 'date', req: 1 }, { k: 'inscricaoId', l: 'Inscrição', ref: 'inscricoes', req: 1 },
      { k: 'tipo', l: 'Tipo', opts: ['Pagamento', 'Estorno'] }, { k: 'valor', l: 'Valor', t: 'money', req: 1 },
      { k: 'forma', l: 'Forma', opts: ['Dinheiro', 'Pix', 'Cartão', 'Transferência'] }, { k: 'resp', l: 'Recebido por' }, { k: 'obs', l: 'Observações' }
    ],
    check: r => {
      if (!(+r.valor > 0)) return 'Informe um valor maior que zero.';
      const i = by('inscricoes', r.inscricaoId); if (!i) return 'Inscrição inválida.';
      if (r.tipo === 'Pagamento' && +r.valor > saldo(i) + 0.001) return 'Valor maior que o saldo pendente (' + brl(saldo(i)) + ').';
      if (r.tipo === 'Estorno' && +r.valor > pago(i) + 0.001) return 'Estorno maior que o valor pago (' + brl(pago(i)) + ').';
      return '';
    },
    defaults: () => ({ data: hoje(), tipo: 'Pagamento', forma: 'Pix' })
  },
  despesas: {
    titulo: 'Despesas do evento', scoped: true,
    cols: [{ k: 'data', l: 'Data', t: 'date', req: 1 }, { k: 'descricao', l: 'Descrição', req: 1 }, { k: 'fornecedor', l: 'Fornecedor' }, { k: 'valor', l: 'Valor', t: 'money', req: 1 }],
    check: r => (+r.valor > 0 ? '' : 'Informe um valor maior que zero.'),
    defaults: () => ({ data: hoje() })
  },
  receitas: {
    titulo: 'Outras receitas (patrocínios etc.)', scoped: true,
    cols: [{ k: 'data', l: 'Data', t: 'date', req: 1 }, { k: 'fonte', l: 'Fonte', opts: ['Patrocínio', 'Outras'] }, { k: 'descricao', l: 'Descrição', req: 1 }, { k: 'valor', l: 'Valor', t: 'money', req: 1 }],
    check: r => (+r.valor > 0 ? '' : 'Informe um valor maior que zero.'),
    defaults: () => ({ data: hoje(), fonte: 'Patrocínio' })
  },
  usuarios: {
    titulo: 'Usuários (cadastro de responsáveis)', scoped: false,
    cols: [{ k: 'nome', l: 'Nome', req: 1 }, { k: 'perfil', l: 'Perfil', opts: ['Administrador', 'Responsável pela secretaria', 'Atendente', 'Financeiro', 'Consulta'] }]
  }
};
const DEPS = {
  competidores: [['inscricoes', 'competidorId'], ['duplas', 'int1'], ['duplas', 'int2']],
  categorias: [['inscricoes', 'categoriaId'], ['duplas', 'categoriaId']],
  inscricoes: [['lancamentos', 'inscricaoId']],
  rodeios: [['categorias', 'rodeioId'], ['inscricoes', 'rodeioId'], ['lancamentos', 'rodeioId'], ['despesas', 'rodeioId'], ['receitas', 'rodeioId'], ['duplas', 'rodeioId']]
};
const NAV = [['painel', 'Painel inicial'], ['rodeios', 'Rodeios'], ['competidores', 'Competidores'], ['categorias', 'Categorias e modalidades'], ['inscricoes', 'Inscrições e planilhas'],
  ['duplas', 'Duplas e equipes'], ['lancamentos', 'Pagamentos'], ['despesas', 'Despesas'], ['receitas', 'Outras receitas'], ['relatorios', 'Relatórios'], ['usuarios', 'Usuários'], ['config', 'Configurações e backup']];

/* ---------- utilitarios de celula ---------- */
function raw(c, r) {
  if (c.calc) return c.calc(r);
  if (c.ref) { const x = by(c.ref, r[c.k]); return x ? REF[c.ref].label(x) : ''; }
  return r[c.k] ?? '';
}
function show(c, r) {
  const v = raw(c, r);
  if (c.t === 'money') return brl(v);
  if (c.t === 'date') return dbr(v);
  return String(v);
}
function campo(c, val) {
  let el;
  if (c.opts || c.ref) {
    el = document.createElement('select');
    const lista = c.opts ? c.opts.map(o => [o, o]) : [['', '(selecione)'], ...REF[c.ref].rows().map(x => [x.id, REF[c.ref].label(x)])];
    el.innerHTML = lista.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  } else {
    el = document.createElement('input');
    el.type = c.t === 'date' ? 'date' : (c.t === 'number' || c.t === 'money') ? 'number' : 'text';
    if (c.t === 'money') el.step = '0.01';
    if (c.t === 'number' || c.t === 'money') el.min = '0';
  }
  el.value = val ?? '';
  return el;
}
const conv = (c, v) => ((c.t === 'number' || c.t === 'money') ? (parseFloat(String(v).replace(',', '.')) || 0) : String(v).trim());

/* ---------- gravacao com auditoria e fila ---------- */
function audit(op, mod, r, antes, depois) {
  const M = MOD[mod];
  DB.auditoria.unshift({ ts: new Date().toISOString(), usuario: 'Local', op, mod: M.titulo, reg: M.cols.slice(0, 2).map(c => show(c, r)).join(' | '), antes, depois });
  DB.auditoria = DB.auditoria.slice(0, 2000);
  DB.fila.push({ ts: Date.now(), op, mod, id: r.id });
}
function validar(mod, r, novo) {
  const M = MOD[mod];
  for (const c of M.cols) if (!c.calc && !c.ro && c.req && !String(r[c.k] ?? '').trim()) return `Preencha o campo "${c.l}".`;
  return M.check ? M.check(r, novo) : '';
}
function inserir(mod, r) {
  const M = MOD[mod];
  if (M.scoped) { if (!DB.rodeioAtual) return 'Cadastre e selecione um rodeio primeiro.'; r.rodeioId = DB.rodeioAtual; }
  r.id = uid(); r.criado = new Date().toISOString();
  if (M.onNew) M.onNew(r);
  const e = validar(mod, r, true); if (e) return e;
  DB[mod].push(r);
  if (mod === 'rodeios' && !DB.rodeioAtual) DB.rodeioAtual = r.id;
  audit('Inclusão', mod, r, null, JSON.stringify(r));
  save(); return '';
}
function atualizar(mod, id, k, v) {
  const r = by(mod, id), antes = r[k];
  const novo = { ...r, [k]: v };
  const e = validar(mod, novo, false);
  if (e) { toast(e, true); return; }
  if (String(antes) === String(v)) return;
  Object.assign(r, novo);
  audit('Alteração', mod, r, k + ': ' + antes, k + ': ' + v);
  save();
}
function emUso(mod, id) { return (DEPS[mod] || []).some(([t, k]) => DB[t].some(x => x[k] === id)); }
function excluir(mod, id) {
  const r = by(mod, id);
  if (emUso(mod, id)) { toast('Registro em uso por outros dados. Para inscrições, use a situação "Cancelada".', true); return; }
  confirmar('Excluir este registro? A exclusão fica registrada no histórico.', () => {
    DB[mod] = DB[mod].filter(x => x.id !== id);
    audit('Exclusão', mod, r, JSON.stringify(r), null);
    if (mod === 'rodeios' && DB.rodeioAtual === id) DB.rodeioAtual = DB.rodeios[0]?.id || null;
    save(); topo(); render();
  });
}

/* ---------- interface ---------- */
let cur = 'painel';
const V = {};
const vs = m => (V[m] = V[m] || { q: '', sort: null, dir: 1, page: 1, f: {}, hid: [] });

function toast(m, err) {
  const t = $('#toast'); t.textContent = m; t.className = 'toast' + (err ? ' err' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add('hidden'), 4000);
}
function modal(html) { $('#box').innerHTML = html; $('#modal').classList.remove('hidden'); }
function fechar() { $('#modal').classList.add('hidden'); }
function confirmar(txt, fn) {
  modal(`<h3>Confirmação</h3><p style="margin:12px 0">${esc(txt)}</p><div class="acoes"><button class="btn sec" id="nao">Cancelar</button><button class="btn" id="sim">Confirmar</button></div>`);
  $('#nao').onclick = fechar; $('#sim').onclick = () => { fechar(); fn(); };
}
function status() {
  const n = DB.fila.length, on = navigator.onLine, s = $('#sync');
  s.textContent = (on ? 'Conectado' : 'Sem internet') + ' - ' + (n ? n + ' alteração(ões) só neste computador' : 'sem pendências');
  s.className = 'sync ' + (on ? 'on' : 'off');
}
function sincronizar() { /* TODO: enviar DB.fila ao Supabase e baixar mudanças; ainda nao implementado */ }
window.addEventListener('online', () => { status(); sincronizar(); });
window.addEventListener('offline', status);

function topo() {
  if (!DB.rodeioAtual && DB.rodeios.length) DB.rodeioAtual = DB.rodeios[0].id;
  $('#selRodeio').innerHTML = DB.rodeios.length ? DB.rodeios.map(r => `<option value="${r.id}" ${r.id === DB.rodeioAtual ? 'selected' : ''}>${esc(r.nome)}</option>`).join('') : '<option>(nenhum rodeio)</option>';
  $('#nav').innerHTML = NAV.map(([k, l]) => `<a href="#${k}" class="${k === cur ? 'on' : ''}">${l}</a>`).join('');
  const av = $('#aviso');
  av.classList.toggle('hidden', !!DB.rodeios.length || cur === 'rodeios');
  av.innerHTML = 'Nenhum rodeio cadastrado. <a href="#rodeios">Cadastre o primeiro rodeio</a> para começar.';
  status();
}
$('#selRodeio').onchange = e => { DB.rodeioAtual = e.target.value; save(); render(); };

function linhas(mod) {
  const M = MOD[mod], v = vs(mod);
  let r = M.scoped ? DB[mod].filter(x => x.rodeioId === DB.rodeioAtual) : DB[mod];
  r = r.filter(x => {
    if (v.q && !M.cols.map(c => show(c, x)).join(' ').toLowerCase().includes(v.q.toLowerCase())) return false;
    for (const k in v.f) if (v.f[k] && !show(M.cols.find(c => c.k === k), x).toLowerCase().includes(v.f[k].toLowerCase())) return false;
    return true;
  });
  if (v.sort) {
    const c = M.cols.find(c => c.k === v.sort);
    r = [...r].sort((a, b) => { const x = raw(c, a), y = raw(c, b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', { numeric: true })) * v.dir; });
  }
  return r;
}

const POR_PAG = 20;
function tabela(mod) {
  const M = MOD[mod], v = vs(mod), todas = linhas(mod);
  const cols = M.cols.filter(c => !v.hid.includes(c.k));
  const pags = Math.max(1, Math.ceil(todas.length / POR_PAG));
  v.page = Math.min(v.page, pags);
  const pg = todas.slice((v.page - 1) * POR_PAG, v.page * POR_PAG);
  const cls = c => (c.t === 'money' || c.t === 'number' ? 'r' : '');
  return `
  <h2>${M.titulo}</h2>
  <div class="bar">
    <input type="search" id="busca" placeholder="Pesquisar..." value="${esc(v.q)}">
    <button class="btn" id="novo">Novo registro</button>
    <button class="btn sec" id="csv">Exportar CSV</button>
    <button class="btn sec" id="imp">Imprimir</button>
    <details class="cols"><summary class="btn sec">Colunas</summary><div class="lista">
      ${M.cols.map(c => `<label><input type="checkbox" data-col="${c.k}" ${v.hid.includes(c.k) ? '' : 'checked'}> ${esc(c.l)}</label>`).join('')}
    </div></details>
    <span style="color:var(--mut)">${todas.length} registro(s)</span>
  </div>
  <div class="wrap"><table>
    <thead>
      <tr>${cols.map(c => `<th data-sort="${c.k}">${esc(c.l)}${v.sort === c.k ? (v.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}<th></th></tr>
      <tr class="flt">${cols.map(c => `<th><input data-f="${c.k}" value="${esc(v.f[c.k] || '')}" placeholder="filtrar"></th>`).join('')}<th></th></tr>
    </thead>
    <tbody>
      ${pg.map(r => `<tr data-id="${r.id}">${cols.map(c => {
        const pend = c.hl && c.hl(r);
        return `<td data-k="${c.k}" class="${cls(c)} ${pend ? 'pend' : ''}">${esc(show(c, r))}</td>`;
      }).join('')}<td>${M.imutavel
        ? (r.tipo === 'Pagamento' ? '<button class="btn red mini" data-estorno="1">Estornar</button>' : '')
        : '<button class="btn red mini" data-del="1">Excluir</button>'}</td></tr>`).join('')}
    </tbody>
  </table>${pg.length ? '' : '<div class="vazio">Nenhum registro encontrado.</div>'}</div>
  <div class="pag"><button class="btn sec mini" id="ant">Anterior</button><span>Página ${v.page} de ${pags}</span><button class="btn sec mini" id="prox">Próxima</button>
  <span>${M.imutavel ? 'Lançamentos financeiros não podem ser editados nem excluídos: use o estorno.' : 'Dê dois cliques em uma célula para editar.'}</span></div>`;
}

function formNovo(mod, base) {
  const M = MOD[mod];
  const def = { ...(M.defaults ? M.defaults() : {}), ...(base || {}) };
  const cs = M.cols.filter(c => !c.calc && !c.ro);
  modal(`<h3>Novo registro - ${M.titulo}</h3><form id="f"><div class="form" id="campos"></div><div class="erro" id="err"></div>
    <div class="acoes"><button type="button" class="btn sec" id="canc">Cancelar</button><button class="btn">Salvar</button></div></form>`);
  const box = $('#campos');
  cs.forEach(c => {
    const l = document.createElement('label'); l.textContent = c.l + (c.req ? ' *' : '');
    const el = campo(c, def[c.k]); el.name = c.k; l.append(el); box.append(l);
  });
  $('#canc').onclick = fechar;
  $('#f').onsubmit = ev => {
    ev.preventDefault();
    const r = {}; cs.forEach(c => { r[c.k] = conv(c, $(`[name="${c.k}"]`).value); });
    const e = inserir(mod, r);
    if (e) { $('#err').textContent = e; return; }
    fechar(); toast('Registro salvo.'); topo(); render();
  };
}

function painel() {
  const ins = scope('inscricoes'), ativas = ins.filter(i => i.status !== 'Cancelada' && i.status !== 'Lista de espera');
  const rec = ins.reduce((s, i) => s + pago(i), 0) + scope('receitas').reduce((s, x) => s + x.valor, 0);
  const des = scope('despesas').reduce((s, x) => s + x.valor, 0);
  const pend = ativas.reduce((s, i) => s + Math.max(0, saldo(i)), 0);
  const inc = DB.competidores.filter(c => !c.cpf || !c.nasc || !c.tel).length;
  const porCat = {}; ins.filter(i => i.status !== 'Cancelada').forEach(i => { const n = nomeCat(i.categoriaId); porCat[n] = (porCat[n] || 0) + 1; });
  const top = Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const card = (t, v, a) => `<div class="card ${a ? 'alerta' : ''}"><small>${t}</small><b>${v}</b></div>`;
  const rod = by('rodeios', DB.rodeioAtual);
  return `<h2>Painel inicial</h2><div class="cards">
    ${card('Rodeios cadastrados', DB.rodeios.length)}${card('Rodeio selecionado', esc(rod?.nome || '-'))}
    ${card('Competidores inscritos', new Set(ativas.map(i => i.competidorId)).size)}${card('Inscrições confirmadas', ins.filter(i => i.status === 'Confirmada').length)}
    ${card('Inscrições pendentes', ins.filter(i => ['Pendente', 'Pré-inscrita'].includes(i.status)).length)}${card('Lista de espera', ins.filter(i => i.status === 'Lista de espera').length)}
    ${card('Recebido', brl(rec))}${card('Valores pendentes', brl(pend), pend > 0)}${card('Despesas', brl(des))}${card('Saldo de caixa', brl(rec - des))}
    ${card('Cadastros incompletos', inc, inc > 0)}</div>
    <h3>Categorias com mais inscritos</h3>${top.length ? `<div class="wrap"><table>${top.map(([n, q]) => `<tr><td>${esc(n)}</td><td class="r">${q}</td></tr>`).join('')}</table></div>` : '<div class="vazio">Sem inscrições neste rodeio.</div>'}
    <h3>Últimas alterações</h3><div class="wrap"><table>${DB.auditoria.slice(0, 8).map(a => `<tr><td>${new Date(a.ts).toLocaleString('pt-BR')}</td><td>${a.op}</td><td>${esc(a.mod)}</td><td>${esc(a.reg)}</td></tr>`).join('') || '<tr><td>Nenhuma alteração.</td></tr>'}</table></div>`;
}

function baixar(nome, txt, tipo) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: tipo })); a.download = nome; a.click(); URL.revokeObjectURL(a.href);
}
function csv(nome, cab, linhas) {
  const q = c => '"' + String(c ?? '').replace(/"/g, '""') + '"';
  baixar(nome + '.csv', '\uFEFF' + [cab, ...linhas].map(l => l.map(q).join(';')).join('\n'), 'text/csv;charset=utf-8');
}
function exportarTabela(mod) {
  const M = MOD[mod], cols = M.cols.filter(c => !vs(mod).hid.includes(c.k));
  csv(mod, cols.map(c => c.l), linhas(mod).map(r => cols.map(c => show(c, r))));
}

function relatorios() {
  const ins = scope('inscricoes'), pagt = ins.reduce((s, i) => s + pago(i), 0), outras = scope('receitas').reduce((s, x) => s + x.valor, 0);
  const des = scope('despesas').reduce((s, x) => s + x.valor, 0), pend = ins.filter(i => !['Cancelada', 'Lista de espera'].includes(i.status)).reduce((s, i) => s + Math.max(0, saldo(i)), 0);
  const botoes = Object.keys(MOD).map(m => `<button class="btn sec" data-exp="${m}">${MOD[m].titulo}</button>`).join('');
  return `<h2>Relatórios e exportação</h2><h3>Exportar listas do rodeio selecionado (CSV)</h3><div class="rel">${botoes}</div>
  <h3>Fechamento financeiro</h3><div class="wrap"><table>
    <tr><td>Receitas de inscrições (pagamentos menos estornos)</td><td class="r">${brl(pagt)}</td></tr>
    <tr><td>Outras receitas / patrocínios</td><td class="r">${brl(outras)}</td></tr>
    <tr><td>Despesas</td><td class="r">${brl(des)}</td></tr>
    <tr><td><b>Saldo de caixa</b></td><td class="r"><b>${brl(pagt + outras - des)}</b></td></tr>
    <tr><td>Valores a receber (inscrições ativas)</td><td class="r">${brl(pend)}</td></tr></table></div>
  <div class="bar" style="margin-top:10px"><button class="btn" id="imp">Imprimir</button></div>
  <h3>Histórico de alterações (últimas 200)</h3><div class="wrap"><table>
    <thead><tr><th>Data</th><th>Usuário</th><th>Operação</th><th>Módulo</th><th>Registro</th><th>Antes</th><th>Depois</th></tr></thead>
    ${DB.auditoria.slice(0, 200).map(a => `<tr><td>${new Date(a.ts).toLocaleString('pt-BR')}</td><td>${a.usuario}</td><td>${a.op}</td><td>${esc(a.mod)}</td><td>${esc(a.reg)}</td><td>${esc((a.antes || '').slice(0, 60))}</td><td>${esc((a.depois || '').slice(0, 60))}</td></tr>`).join('')}</table></div>`;
}

function config() {
  return `<h2>Configurações e backup</h2>
  <h3>Numeração das inscrições</h3>
  <p style="margin-bottom:8px;color:var(--mut)">Cada computador que trabalha offline deve ter um prefixo diferente (ex.: A, B) para não repetir números de inscrição.</p>
  <div class="bar"><input id="pref" placeholder="Prefixo deste computador" value="${esc(DB.cfg.prefixo)}" style="padding:7px;border:1px solid var(--line);border-radius:4px"><button class="btn" id="salvaPref">Salvar prefixo</button></div>
  <h3>Backup</h3><div class="bar"><button class="btn" id="bk">Baixar backup (.json)</button>
    <label class="btn sec">Restaurar backup<input id="rs" type="file" accept=".json" hidden></label></div>
  <h3>Sincronização</h3><p>Alterações aguardando envio: <b>${DB.fila.length}</b>. A conexão com o servidor (Supabase) ainda não foi configurada, então os dados existem somente neste navegador. Faça backup com frequência.</p>
  <h3>Dados</h3><div class="bar"><button class="btn red" id="limpa">Apagar todos os dados deste computador</button></div>`;
}

function render() {
  topo();
  const c = $('#conteudo');
  if (cur === 'painel') c.innerHTML = painel();
  else if (cur === 'relatorios') c.innerHTML = relatorios();
  else if (cur === 'config') c.innerHTML = config();
  else c.innerHTML = tabela(cur);
}

/* ---------- eventos ---------- */
const cont = $('#conteudo');
window.addEventListener('hashchange', () => { cur = location.hash.slice(1) || 'painel'; if (!MOD[cur] && !['painel', 'relatorios', 'config'].includes(cur)) cur = 'painel'; render(); });
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') fechar(); });

cont.addEventListener('click', e => {
  const t = e.target, v = vs(cur);
  if (t.closest('[data-sort]') && MOD[cur]) { const k = t.closest('[data-sort]').dataset.sort; v.dir = v.sort === k ? -v.dir : 1; v.sort = k; render(); }
  else if (t.id === 'novo') formNovo(cur);
  else if (t.id === 'csv') exportarTabela(cur);
  else if (t.id === 'imp') window.print();
  else if (t.id === 'ant') { v.page = Math.max(1, v.page - 1); render(); }
  else if (t.id === 'prox') { v.page++; render(); }
  else if (t.dataset.del) excluir(cur, t.closest('tr').dataset.id);
  else if (t.dataset.estorno) { const l = by('lancamentos', t.closest('tr').dataset.id); formNovo('lancamentos', { tipo: 'Estorno', inscricaoId: l.inscricaoId, valor: l.valor }); }
  else if (t.dataset.exp) { const m = t.dataset.exp, M = MOD[m], r = M.scoped ? scope(m) : DB[m]; csv(m, M.cols.map(c => c.l), r.map(x => M.cols.map(c => show(c, x)))); }
  else if (t.id === 'salvaPref') { DB.cfg.prefixo = $('#pref').value.trim().toUpperCase(); save(); toast('Prefixo salvo.'); }
  else if (t.id === 'bk') baixar('backup-secretaria-' + hoje() + '.json', JSON.stringify(DB, null, 2), 'application/json');
  else if (t.id === 'limpa') confirmar('Apagar TODOS os dados deste computador? Faça um backup antes.', () => { DB = structuredClone(VAZIO); save(); render(); });
});
cont.addEventListener('input', e => {
  const t = e.target, v = vs(cur);
  if (t.id === 'busca') { v.q = t.value; v.page = 1; render(); const b = $('#busca'); b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
  else if (t.dataset.f !== undefined) { v.f[t.dataset.f] = t.value; v.page = 1; const k = t.dataset.f; render(); const i = $(`[data-f="${k}"]`); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
});
cont.addEventListener('change', e => {
  const t = e.target, v = vs(cur);
  if (t.dataset.col) { v.hid = t.checked ? v.hid.filter(k => k !== t.dataset.col) : [...v.hid, t.dataset.col]; render(); $('details.cols').open = true; }
  else if (t.id === 'rs') {
    const f = t.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => confirmar('Restaurar este backup substitui os dados atuais deste computador. Continuar?', () => {
      try { DB = Object.assign(structuredClone(VAZIO), JSON.parse(rd.result)); save(); render(); toast('Backup restaurado.'); } catch { toast('Arquivo de backup inválido.', true); }
    });
    rd.readAsText(f);
  }
});
cont.addEventListener('dblclick', e => {
  const td = e.target.closest('td[data-k]'); const M = MOD[cur];
  if (!td || !M || M.imutavel) return;
  const c = M.cols.find(x => x.k === td.dataset.k);
  if (c.ro || c.calc) return;
  const id = td.parentNode.dataset.id, r = by(cur, id), el = campo(c, r[c.k]);
  td.innerHTML = ''; td.append(el); el.focus();
  el.onblur = () => { atualizar(cur, id, c.k, conv(c, el.value)); render(); };
  el.onkeydown = ev => { if (ev.key === 'Enter') el.blur(); if (ev.key === 'Escape') { el.onblur = null; render(); } };
});

cur = location.hash.slice(1) || 'painel';
if (!MOD[cur] && !['painel', 'relatorios', 'config'].includes(cur)) cur = 'painel';
render();