/* ===== Planilha Digital de Inscrições — front-end (offline, localStorage) =====
   Para ligar ao Supabase depois, troque as funções carregar() e salvar()
   por chamadas ao banco e use realtime para receber inscrições online. */

const KEY = 'planilha-rodeio-v1';
let estado = { armadas: [], peneiras: 0, proxInsc: 1, online: [] };
let fase = 'classificatoria';
let narrador = false;
let naoLidas = 0;

const $ = (id) => document.getElementById(id);

/* ---------- persistência ---------- */
function carregar() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) estado = JSON.parse(raw);
  } catch (e) { console.warn('Falha ao ler dados', e); }
}
function salvar() {
  try {
    localStorage.setItem(KEY, JSON.stringify(estado));
    $('status').textContent = '💾 Salvo localmente · ' + new Date().toLocaleTimeString('pt-BR');
  } catch (e) { $('status').textContent = '⚠ Erro ao salvar'; }
}

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function totais(a) {
  const acertos = a.passadas.filter(p => p === 1).length;
  const total = a.passadas.filter(p => p !== 0).length;
  return { acertos, total };
}
function toast(msg) {
  const t = $('toast');
  t.textContent = '✔ ' + msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 3500);
}

/* ---------- ações ---------- */
function addArmada({ nome1, nome2, entidade = '', forca = 'C', origem = 'manual' }) {
  const insc = estado.proxInsc++;
  estado.armadas.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    insc, nome1: nome1.trim(), nome2: nome2.trim(), entidade: entidade.trim(),
    forca, classif: false, eliminado: false, passadas: [0, 0, 0] // 0 vazio · 1 acerto · 2 erro
  });
  if (origem !== 'manual') {
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    estado.online.unshift({ texto: `${nome1} / ${nome2} (insc. ${insc})`, hora });
    estado.online = estado.online.slice(0, 50);
    naoLidas++;
  }
  salvar(); render();
}
function ciclarPassada(id, i) {
  const a = estado.armadas.find(x => x.id === id);
  a.passadas[i] = (a.passadas[i] + 1) % 3;
  salvar(); render();
}
function toggleClassif(id) {
  const a = estado.armadas.find(x => x.id === id);
  a.classif = !a.classif; salvar(); render();
}
function removerArmada(id) {
  if (!confirm('Remover esta armada?')) return;
  estado.armadas = estado.armadas.filter(x => x.id !== id);
  salvar(); render();
}

/* ---------- render ---------- */
function render() {
  const q = $('busca').value.trim().toLowerCase();
  let lista = estado.armadas;
  if (fase === 'final') lista = lista.filter(a => a.classif);
  if (q) lista = lista.filter(a =>
    `${a.insc} ${a.nome1} ${a.nome2} ${a.entidade}`.toLowerCase().includes(q));

  $('corpo').innerHTML = lista.map(a => {
    const t = totais(a);
    const cels = a.passadas.map((p, i) =>
      `<td><button class="cel ${p === 1 ? 'acerto' : p === 2 ? 'erro' : ''}" data-id="${a.id}" data-i="${i}">${p === 1 ? '✓' : p === 2 ? '✗' : ''}</button></td>`
    ).join('');
    return `<tr class="${a.eliminado ? 'elim' : ''}">
      <td class="num">${a.insc}</td>
      <td><input type="checkbox" data-classif="${a.id}" ${a.classif ? 'checked' : ''}></td>
      <td class="nomes">
        <div class="ent">${esc(a.entidade) || '—'}</div>
        <div class="n">${esc(a.nome1)}</div>
        <div class="n">${esc(a.nome2)}</div>
      </td>
      <td class="forca">${esc(a.forca)}</td>
      ${cels}
      <td class="num">${t.acertos}</td>
      <td class="num">${t.total}</td>
      <td><button class="del" data-del="${a.id}" title="Remover">🗑</button></td>
    </tr>`;
  }).join('');

  $('vazio').classList.toggle('hidden', lista.length > 0);
  $('cntArmadas').textContent = estado.armadas.length;
  $('cntPeneiras').textContent = estado.peneiras;
  $('cntElim').textContent = estado.armadas.filter(a => a.eliminado).length;
  $('totalArmadas').textContent = estado.armadas.length;

  const b = $('badge');
  b.textContent = naoLidas;
  b.classList.toggle('hidden', naoLidas === 0);

  $('listaOnline').innerHTML = estado.online.length
    ? estado.online.map(o => `<li>${esc(o.texto)}<small>DUPLA OFICIAL · ${o.hora} · auto</small></li>`).join('')
    : '<li>Nenhuma atualização ainda.</li>';
}

/* ---------- exportações ---------- */
function baixar(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome; a.click();
  URL.revokeObjectURL(a.href);
}
function exportarCsv() {
  const linhas = [['Inscrição','Classificatória','Entidade/Patrocinador/Cavalo','Competidor 1','Competidor 2','Força','Passada 1','Passada 2','Passada 3','Acertos','Total']];
  const nomeP = ['', 'Acerto', 'Erro'];
  estado.armadas.forEach(a => {
    const t = totais(a);
    linhas.push([a.insc, a.classif ? 'Sim' : 'Não', a.entidade, a.nome1, a.nome2, a.forca, ...a.passadas.map(p => nomeP[p]), t.acertos, t.total]);
  });
  const csv = '\uFEFF' + linhas.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  baixar('inscricoes.csv', csv, 'text/csv;charset=utf-8');
}

/* ---------- dados de exemplo ---------- */
const EXEMPLOS = [
  ['William Bentes','Paulo Costa','Fazenda Boa Vista','B'],
  ['Tiago Mota','Romeu Ferreira','Haras Santa Luzia','D'],
  ['Carlos Morandi','Iuri Quevedo','Agro Sul','C'],
  ['Gilvan Neves','Yuri Freitas','Rancho Bela Vista','C'],
  ['Rafael Medeiros','Helton Carvalho','Selaria Pampa','B'],
  ['Gabriel Lima','Miguel Pereira','Cavalos do Vale','A']
];
const NOMES_SIM = [
  ['Lucas Andrade','Rodrigo Pires'],['Marcos Teixeira','André Souza'],
  ['João Batista','Felipe Duarte'],['Bruno Rocha','Thiago Alves']
];

/* ---------- eventos ---------- */
document.addEventListener('click', (e) => {
  const cel = e.target.closest('.cel');
  if (cel && !narrador) return ciclarPassada(cel.dataset.id, +cel.dataset.i);
  const del = e.target.closest('[data-del]');
  if (del && !narrador) return removerArmada(del.dataset.del);
  if (!e.target.closest('.tools')) $('menu').classList.add('hidden');
});
document.addEventListener('change', (e) => {
  if (e.target.dataset.classif && !narrador) toggleClassif(e.target.dataset.classif);
});

$('formAdd').addEventListener('submit', (e) => {
  e.preventDefault();
  addArmada({ nome1: $('fNome1').value, nome2: $('fNome2').value, entidade: $('fEntidade').value, forca: $('fForca').value });
  e.target.reset(); $('fForca').value = 'C'; $('fNome1').focus();
});

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  t.classList.add('active'); fase = t.dataset.fase; render();
}));

$('busca').addEventListener('input', render);
$('penMais').onclick = () => { estado.peneiras++; salvar(); render(); };
$('penMenos').onclick = () => { estado.peneiras = Math.max(0, estado.peneiras - 1); salvar(); render(); };

$('btnNarrador').onclick = () => {
  narrador = !narrador;
  document.body.classList.toggle('narrador', narrador);
  $('modoLabel').textContent = narrador ? 'MODO NARRADOR — SOMENTE LEITURA' : 'MODO EDIÇÃO';
  $('btnNarrador').classList.toggle('active', narrador);
};
$('btnMenu').onclick = (e) => { e.stopPropagation(); $('menu').classList.toggle('hidden'); };
$('btnExportCsv').onclick = exportarCsv;
$('btnBackup').onclick = () => baixar('backup-rodeio.json', JSON.stringify(estado, null, 2), 'application/json');
$('fileRestore').onchange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { estado = JSON.parse(r.result); salvar(); render(); toast('Backup restaurado'); }
    catch { alert('Arquivo de backup inválido.'); }
  };
  r.readAsText(f);
};
$('btnDemo').onclick = () => {
  EXEMPLOS.forEach(([a, b, c, d]) => addArmada({ nome1: a, nome2: b, entidade: c, forca: d }));
  toast('Dados de exemplo carregados');
};
$('btnLimpar').onclick = () => {
  if (!confirm('Apagar TODAS as inscrições deste computador?')) return;
  estado = { armadas: [], peneiras: 0, proxInsc: 1, online: [] }; naoLidas = 0; salvar(); render();
};
$('btnSimular').onclick = () => {
  const [a, b] = NOMES_SIM[Math.floor(Math.random() * NOMES_SIM.length)];
  addArmada({ nome1: a, nome2: b, entidade: 'Inscrição online', forca: 'C', origem: 'online' });
  toast('Atualização automática: 1 novo competidor adicionado(s).');
};
$('btnOnline').onclick = () => { $('painelOnline').classList.toggle('hidden'); naoLidas = 0; render(); };
$('fecharPainel').onclick = () => $('painelOnline').classList.add('hidden');

/* ---------- início ---------- */
carregar();
render();