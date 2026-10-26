/*
 * extras.js — recursos adicionais do Painel de Cobrança (versão Vercel + Supabase)
 *   1. Contatos do responsável financeiro e do(s) aluno(s) dentro do card
 *   2. Área do administrador: usuários, distribuição de cards e atualização das bases
 * Depende de claude-shim.js (window.__sb e window.claude).
 */
(function () {
  'use strict';
  var sb = window.__sb;
  if (!sb || !window.claude) return;

  /* ------------------------------------------------------------ utilidades */
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function slug(s) {
    return String(s || '').normalize('NFD').replace(/[^\x00-\x7F]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 150);
  }
  var BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function dig(s) { return String(s || '').replace(/\D/g, ''); }
  function esperar(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function csv(url) { return fetch(url).then(function (r) { return r.text(); }).then(function (t) { return window.d3.csvParse(t); }); }

  var CSS = '' +
    '.fx-ct{margin:0 0 14px;border:1px solid #E3E6EA;border-radius:10px;background:#FAFBFC}' +
    '.fx-ct>summary{cursor:pointer;padding:10px 12px;font-weight:600;font-size:13px;list-style:none;display:flex;align-items:center;gap:8px}' +
    '.fx-ct>summary::-webkit-details-marker{display:none}.fx-ct>summary:before{content:"▸";color:#E52329;transition:transform .15s}.fx-ct[open]>summary:before{transform:rotate(90deg)}' +
    '.fx-ct .pp{padding:4px 12px 12px;display:grid;gap:10px}' +
    '.fx-ct .ps{background:#fff;border:1px solid #E3E6EA;border-radius:8px;padding:10px 12px}' +
    '.fx-ct .pr{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6B7480;margin-bottom:2px}' +
    '.fx-ct .pn{font-weight:600;margin-bottom:6px}' +
    '.fx-ct dl{display:grid;grid-template-columns:78px 1fr;gap:3px 10px;margin:0;font-size:12.5px}' +
    '.fx-ct dt{color:#6B7480}.fx-ct dd{margin:0;word-break:break-word}' +
    '.fx-ct a{color:#1F4E79}.fx-ct .wa{margin-left:6px;font-size:11px;padding:1px 6px;border:1px solid #2E7D4F;color:#2E7D4F;border-radius:999px;text-decoration:none}' +
    '.fx-ct .ob{font-size:12px;color:#8A5A00;margin-top:6px}' +
    '.fx-ct .cp{border:0;background:none;color:#6B7480;cursor:pointer;font-size:11px;padding:0 4px}' +
    '#fx-adm{position:fixed;inset:0;z-index:99990;background:rgba(20,25,35,.45);display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;overflow:auto;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1C2430}' +
    '#fx-adm .bx{background:#fff;border-radius:14px;width:100%;max-width:980px;box-shadow:0 20px 60px rgba(0,0,0,.25)}' +
    '#fx-adm .hd{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid #E3E6EA}' +
    '#fx-adm .hd h2{margin:0;font-size:18px;flex:1}#fx-adm .hd button{border:0;background:none;font-size:22px;cursor:pointer;color:#6B7480}' +
    '#fx-adm .tb{display:flex;gap:4px;padding:10px 20px 0;border-bottom:1px solid #E3E6EA}' +
    '#fx-adm .tb button{border:0;background:none;padding:8px 12px;font:600 13px inherit;color:#5A6370;cursor:pointer;border-bottom:2px solid transparent}' +
    '#fx-adm .tb button[aria-selected=true]{color:#E52329;border-bottom-color:#E52329}' +
    '#fx-adm .ct{padding:18px 20px 22px}' +
    '#fx-adm table{width:100%;border-collapse:collapse;font-size:13px}#fx-adm th,#fx-adm td{text-align:left;padding:8px 6px;border-bottom:1px solid #EEF0F3;vertical-align:middle}' +
    '#fx-adm th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#6B7480;font-weight:600}' +
    '#fx-adm .in{border:1px solid #CDD3DB;border-radius:8px;padding:8px 10px;font:inherit;width:100%;box-sizing:border-box}' +
    '#fx-adm .bt{border:1px solid #CDD3DB;background:#fff;border-radius:8px;padding:7px 12px;font:600 12.5px inherit;cursor:pointer;color:#1C2430}' +
    '#fx-adm .bt:hover{border-color:#E52329;color:#E52329}#fx-adm .bt.p{background:#E52329;border-color:#E52329;color:#fff}#fx-adm .bt.p:hover{background:#C51D22;color:#fff}' +
    '#fx-adm .bt.d{color:#B3261E}#fx-adm .bt[disabled]{opacity:.5;cursor:default}' +
    '#fx-adm .fm{display:grid;grid-template-columns:1.3fr 1.3fr 1fr auto auto auto;gap:8px;align-items:end;margin:6px 0 18px;padding:14px;background:#F7F8FA;border-radius:10px}' +
    '#fx-adm label.l{display:block;font-size:11px;color:#5A6370;margin-bottom:3px}' +
    '#fx-adm .ms{min-height:20px;font-size:13px;margin:8px 0}#fx-adm .ms.er{color:#B3261E}#fx-adm .ms.ok{color:#2E7D4F}' +
    '#fx-adm .tg{display:inline-block;font-size:11px;padding:1px 7px;border-radius:999px;background:#EEF0F3;color:#5A6370}' +
    '#fx-adm .tg.a{background:#FDECEC;color:#B3261E}#fx-adm .tg.o{background:#E8F4EC;color:#2E7D4F}' +
    '#fx-adm .nt{font-size:12.5px;color:#5A6370}' +
    '#fx-adm .pb{height:6px;background:#EEF0F3;border-radius:6px;overflow:hidden;margin:10px 0}#fx-adm .pb i{display:block;height:100%;background:#E52329;width:0}' +
    '@media (max-width:760px){#fx-adm .fm{grid-template-columns:1fr}}' +
    '.fx-corr{margin:0 0 14px;border:1px solid #F0C9A0;border-left:4px solid #C9821A;border-radius:10px;background:#FFFBF5;padding:12px}' +
    '.fx-corr-h{display:flex;align-items:center;gap:8px;margin-bottom:4px}.fx-tag{font-size:11px;font-weight:600;padding:1px 8px;border-radius:999px}' +
    '.fx-n{font-size:12.5px;color:#5A6370;margin:4px 0}.fx-g{display:grid;gap:8px;margin-top:8px}.fx-g2{display:grid;gap:8px}' +
    '.fx-r{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:13px}.fx-l{font-weight:600;width:100%}' +
    '.fx-in{border:1px solid #CDD3DB;border-radius:8px;padding:8px 10px;font:inherit;font-size:13px;width:100%;box-sizing:border-box;background:#fff}' +
    '.fx-ct .fx-mb{margin-top:8px;border:1px solid #1F4E79;background:#fff;color:#1F4E79;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer}' +
    '#fx-mat{position:fixed;inset:0;z-index:99991;background:rgba(20,25,35,.45);display:flex;align-items:flex-start;justify-content:center;padding:32px 16px;overflow:auto;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1C2430}' +
    '#fx-mat .bx{background:#fff;border-radius:14px;width:100%;max-width:1040px;box-shadow:0 20px 60px rgba(0,0,0,.25)}' +
    '#fx-mat .hd{display:flex;align-items:center;gap:10px;padding:16px 20px;border-bottom:1px solid #E3E6EA}#fx-mat .hd h2{margin:0;font-size:17px;flex:1}' +
    '#fx-mat .hd .x{border:0;background:none;font-size:22px;cursor:pointer;color:#6B7480}#fx-mat .hd .pr{border:1px solid #CDD3DB;background:#fff;border-radius:8px;padding:6px 10px;cursor:pointer;font-weight:600;font-size:12px}' +
    '#fx-mat .ct{padding:16px 20px 22px}#fx-mat .per{margin-top:18px;padding-top:12px;border-top:2px solid #E52329}#fx-mat h3{margin:0 0 6px;font-size:15px}' +
    '#fx-mat .tl{list-style:none;margin:10px 0;padding:0 0 0 16px;border-left:2px solid #E3E6EA}#fx-mat .tl>li{position:relative;margin:0 0 12px;padding-left:10px}' +
    '#fx-mat .tl>li:before{content:"";position:absolute;left:-23px;top:4px;width:12px;height:12px;border-radius:50%;background:#fff;border:3px solid #E52329}' +
    '#fx-mat .tt{display:flex;gap:10px;align-items:baseline}#fx-mat .tt span{color:#6B7480;font-size:12.5px}' +
    '#fx-mat .mv{margin:4px 0;padding-left:16px;font-size:12.5px}#fx-mat .mv .in{color:#2E7D4F}#fx-mat .mv .ex{color:#B3261E}' +
    '#fx-mat .rs{font-size:13px;font-weight:600;background:#F7F8FA;border-radius:6px;padding:5px 8px;display:inline-block}' +
    '#fx-mat .tw{overflow:auto}#fx-mat table.pc{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px}#fx-mat .pc th,#fx-mat .pc td{padding:6px;border-bottom:1px solid #EEF0F3;text-align:left;white-space:nowrap}' +
    '#fx-mat .pc th{font-size:11px;text-transform:uppercase;color:#6B7480}#fx-mat .pc .up{color:#B3261E;font-weight:600}#fx-mat .pc .dn{color:#1F4E79;font-weight:600}#fx-mat .pc .tot td{font-weight:700;border-top:2px solid #E3E6EA}' +
    '#fx-mat .expl{margin-top:10px;background:#FFF8F0;border-left:4px solid #C9821A;border-radius:6px;padding:10px 12px;font-size:13px}' +
    '@media print{body>*:not(#fx-mat){display:none!important}#fx-mat{position:static;background:none;padding:0}#fx-mat .bx{box-shadow:none}#fx-mat .hd button{display:none}}' +
    '.fx-bt{justify-self:start;border:0;background:#E52329;color:#fff;border-radius:8px;padding:8px 14px;font-weight:600;cursor:pointer}.fx-bt[disabled]{opacity:.6}';
  var st = el('style'); st.textContent = CSS; document.head.appendChild(st);

  /* ------------------------------------------------------- 1. contatos */
  var CONTATOS = null, carregando = null;
  function carregarContatos() {
    if (!carregando) {
      carregando = csv('dados/contatos.csv').then(function (rows) {
        var m = new Map();
        rows.forEach(function (r) { if (!m.has(r.key)) m.set(r.key, []); m.get(r.key).push(r); });
        CONTATOS = m; return m;
      }).catch(function () { CONTATOS = new Map(); CONTATOS.falhou = true; return CONTATOS; });
    }
    return carregando;
  }
  function linhaLinks(dd, valor, tipo) {
    var partes = String(valor || '').split(' / ').filter(Boolean);
    partes.forEach(function (p, i) {
      if (i) dd.appendChild(document.createTextNode(' · '));
      if (tipo === 'mail') { var a = el('a', null, p); a.href = 'mailto:' + p; dd.appendChild(a); }
      else if (tipo === 'tel') {
        var d = dig(p); var a2 = el('a', null, p); a2.href = 'tel:+55' + d; dd.appendChild(a2);
        if (d.length === 11) { var w = el('a', 'wa', 'WhatsApp'); w.href = 'https://wa.me/55' + d; w.target = '_blank'; w.rel = 'noopener'; dd.appendChild(w); }
      } else dd.appendChild(document.createTextNode(p));
    });
    if (partes.length && tipo !== 'tel') {
      var cp = el('button', 'cp', 'copiar'); cp.type = 'button'; cp.title = 'Copiar';
      cp.addEventListener('click', function (e) { e.preventDefault(); try { navigator.clipboard.writeText(valor); cp.textContent = 'copiado'; setTimeout(function () { cp.textContent = 'copiar'; }, 1200); } catch (x) {} });
      dd.appendChild(cp);
    }
  }
  function blocoContatos(nome) {
    var det = el('details', 'fx-ct'); det.open = true;
    var sm = el('summary', null, 'Contatos do responsável e do aluno'); det.appendChild(sm);
    var pp = el('div', 'pp'); det.appendChild(pp);
    function preencher() {
      pp.replaceChildren();
      if (!CONTATOS) { pp.appendChild(el('div', 'nt', 'Carregando contatos…')); return; }
      if (CONTATOS.falhou) { pp.appendChild(el('div', 'nt', 'A base de contatos ainda não foi carregada (arquivo contatos.csv no Supabase).')); return; }
      var lista = CONTATOS.get(slug(nome)) || [];
      if (!lista.length) { pp.appendChild(el('div', 'nt', 'Sem contatos na base para este responsável.')); return; }
      lista.forEach(function (r) {
        var ps = el('div', 'ps');
        ps.appendChild(el('div', 'pr', r.papel));
        ps.appendChild(el('div', 'pn', r.nome + (r.ra ? '  ·  RA ' + r.ra : '')));
        var dl = el('dl');
        [['CPF/CNPJ', r.cpf, ''], ['E-mail', r.email, 'mail'], ['Telefone', r.telefone, 'tel'], ['Endereço', r.endereco, '']].forEach(function (x) {
          dl.appendChild(el('dt', null, x[0]));
          var dd = el('dd'); if (x[1]) linhaLinks(dd, x[1], x[2]); else { dd.textContent = '—'; dd.style.color = '#9AA1AA'; }
          dl.appendChild(dd);
        });
        ps.appendChild(dl);
        if (r.obs) ps.appendChild(el('div', 'ob', r.obs));
        if (r.ra) {
          var bm = el('button', 'fx-mb', 'Histórico da matrícula e da mensalidade'); bm.type = 'button';
          bm.addEventListener('click', function () { abrirMatricula(r, nome, lista); });
          ps.appendChild(bm);
        }
        pp.appendChild(ps);
      });
    }
    preencher();
    if (!CONTATOS) carregarContatos().then(preencher);
    return det;
  }
  function injetarContatos() {
    var dr = document.getElementById('drawer'); if (!dr) return;
    var corpo = dr.querySelector('.db'); var h2 = dr.querySelector('.dh h2');
    if (!corpo || !h2 || corpo.querySelector('.fx-ct')) return;
    corpo.insertBefore(blocoContatos(h2.textContent), corpo.firstChild);
  }
  function quandoPronto(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn); }
  var agendado = false;
  function aoMudar() { if (agendado) return; agendado = true; setTimeout(function () { agendado = false; injetarContatos(); injetarCorrecao(); marcarCards(); }, 30); }
  quandoPronto(function () { new MutationObserver(aoMudar).observe(document.body, { childList: true, subtree: true }); });



  /* ------------------------------------------- 1c. histórico da matrícula */
  var MAT = null;
  function carregarMatricula() {
    if (!MAT) {
      MAT = Promise.all([csv('dados/matricula_levas.csv'), csv('dados/matricula_eventos.csv'), csv('dados/kanban_titulos.csv'), csv('dados/planos_alunos.csv').catch(function () { return []; })])
        .then(function (r) { return { levas: r[0], eventos: r[1], titulos: r[2], planos: r[3] }; });
      MAT.catch(function () { MAT = null; });
    }
    return MAT;
  }
  function fmtD(s) { if (!s) return '—'; var p = String(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; }
  function fmtDH(s) { return s ? fmtD(s) + (String(s).length > 10 ? ' ' + String(s).slice(11, 16) : '') : '—'; }
  var BRL2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function pct(s) { var n = parseFloat(String(s || '').replace('%', '').replace(',', '.')); return isFinite(n) ? n / 100 : 0; }
  function abrirMatricula(pessoa, nomeCard, lista) {
    var o = document.getElementById('fx-mat'); if (o) o.remove();
    o = el('div'); o.id = 'fx-mat';
    var bx = el('div', 'bx'); o.appendChild(bx);
    var hd = el('div', 'hd'); var h2 = el('h2', null, 'Matrícula e mensalidade · ' + pessoa.nome); hd.appendChild(h2);
    var bp = el('button', 'pr', 'Imprimir'); bp.type = 'button'; bp.addEventListener('click', function () { window.print(); });
    var x = el('button', 'x', '×'); x.type = 'button'; x.addEventListener('click', function () { o.remove(); }); hd.append(bp, x);
    bx.appendChild(hd);
    var ct = el('div', 'ct'); ct.appendChild(el('div', 'fx-n', 'Carregando histórico…')); bx.appendChild(ct);
    o.addEventListener('click', function (e) { if (e.target === o) o.remove(); });
    document.body.appendChild(o);
    carregarMatricula().then(function (M) { montarMatricula(ct, M, pessoa, nomeCard, lista); }, function () {
      ct.replaceChildren(el('div', 'fx-n', 'A base de histórico de matrícula ainda não foi carregada (arquivos matricula_levas.csv e matricula_eventos.csv).'));
    });
  }
  function montarMatricula(ct, M, pessoa, nomeCard, lista) {
    ct.replaceChildren();
    var ra = pessoa.ra, key = slug(nomeCard);
    var levas = M.levas.filter(function (l) { return l.ra === ra; });
    var evs = M.eventos.filter(function (e) { return e.ra === ra; });
    var alunosCard = lista.filter(function (r) { return /Aluno|próprio aluno/.test(r.papel); });
    var soUm = alunosCard.length <= 1;
    var tits = M.titulos.filter(function (t) {
      return t.key === key && t.categoria === 'Mensalidade/Parcela' && (t.aluno === pessoa.nome || (soUm && !t.aluno));
    });
    var periodos = Array.from(new Set(levas.map(function (l) { return l.periodo; }).concat(tits.map(function (t) { return t.semestre; })))).filter(Boolean).sort();
    if (!periodos.length) { ct.appendChild(el('div', 'fx-n', 'Não há movimentações de matrícula nem parcelas de mensalidade para este aluno em 2026.')); return; }
    ct.appendChild(el('div', 'fx-n', 'RA ' + ra + '. Cada "leva" reúne as movimentações feitas em datas próximas (até 3 dias de intervalo). Valores pelo preço de cada disciplina no semestre; mensalidade = total do semestre ÷ 6, antes de bolsa e descontos.'));
    periodos.reverse().forEach(function (per) {
      var sec = el('section', 'per'); sec.appendChild(el('h3', null, 'Semestre ' + per));
      var plano = M.planos.filter(function (p) { return p.ra === ra && p.periodo === per; })[0];
      var bolsa = plano ? pct(plano.bolsa && plano.valor_bolsa ? plano.valor_bolsa : '') : 0;
      if (plano) sec.appendChild(el('div', 'fx-n', 'Plano: ' + (plano.periodicidade || plano.plano || '—') + (plano.bolsa ? ' · Bolsa: ' + plano.bolsa + (plano.valor_bolsa ? ' (' + plano.valor_bolsa + ')' : '') : '') + (plano.desconto ? ' · Desconto: ' + plano.desconto + (plano.valor_desconto ? ' (' + plano.valor_desconto + ')' : '') : '')));
      var ls = levas.filter(function (l) { return l.periodo === per; }).sort(function (a, b) { return +a.leva - +b.leva; });
      // linha do tempo das levas
      var tl = el('ol', 'tl');
      var antes = null;
      ls.forEach(function (l) {
        var li = el('li');
        var tt = el('div', 'tt'); tt.append(el('b', null, l.leva + 'ª leva'), el('span', null, l.data_log === 'não' ? 'mudança percebida em ' + l.data_ini.slice(5, 7) + '/' + l.data_ini.slice(0, 4) + ' (base mensal, sem registro no log)' : fmtDH(l.data_ini) + (l.data_fim && l.data_fim.slice(0, 10) !== l.data_ini.slice(0, 10) ? ' a ' + fmtD(l.data_fim) : '')));
        li.appendChild(tt);
        var es = evs.filter(function (e) { return e.periodo === per && e.leva === l.leva; });
        var inc = {}, exc = {};
        es.forEach(function (e) { (e.acao === 'Inclusão' ? inc : exc)[e.coddisc] = e; delete (e.acao === 'Inclusão' ? exc : inc)[e.coddisc]; });
        var ul = el('ul', 'mv');
        Object.keys(inc).forEach(function (k) { var e = inc[k]; var i = el('li', 'in'); i.textContent = '+ ' + e.disciplina + ' (turma ' + e.turma + ') · ' + BRL2.format(num(e.valor)) + (e.preco_estimado ? ' (preço estimado — não está na tabela)' : '') + (e.confianca === 'provável' ? ' *' : '') + (e.usuario ? ' · por ' + e.usuario : '') + (e.data && e.data.slice(0, 10) !== l.data_ini.slice(0, 10) ? ' em ' + fmtD(e.data) : ''); ul.appendChild(i); });
        Object.keys(exc).forEach(function (k) { var e = exc[k]; var i = el('li', 'ex'); i.textContent = '− ' + e.disciplina + ' (turma ' + e.turma + ') · ' + BRL2.format(num(e.valor)) + (e.preco_estimado ? ' (preço estimado)' : '') + (e.confianca === 'provável' ? ' *' : '') + (e.usuario ? ' · por ' + e.usuario : '') + (e.status_para ? ' (' + e.status_para.toLowerCase() + ')' : ''); ul.appendChild(i); });
        if (!ul.children.length) ul.appendChild(el('li', null, 'Sem mudança líquida (inclusões e exclusões se anularam).'));
        li.appendChild(ul);
        var tot = num(l.total_semestre), men = num(l.mensalidade);
        var res = el('div', 'rs');
        res.textContent = 'Ficou com ' + l.n_disc + ' disciplina(s): ' + BRL2.format(tot) + ' no semestre → ' + BRL2.format(men) + '/mês' + (bolsa ? ' (' + BRL2.format(men * (1 - bolsa)) + ' com bolsa)' : '') + (+l.sem_preco ? ' · inclui ' + l.sem_preco + ' disciplina(s) com preço estimado' : '');
        if (antes) { var d = men - num(antes.mensalidade); if (Math.abs(d) > 0.5) res.textContent += ' · ' + (d > 0 ? 'aumento de ' : 'redução de ') + BRL2.format(Math.abs(d)) + '/mês'; }
        li.appendChild(res); tl.appendChild(li); antes = l;
      });
      if (ls.length) sec.appendChild(tl); else sec.appendChild(el('div', 'fx-n', 'Sem movimentações de matrícula registradas no log para este semestre.'));
      // parcelas x matrícula vigente
      var ps = tits.filter(function (t) { return t.semestre === per; }).sort(function (a, b) { return a.vencimento < b.vencimento ? -1 : 1; });
      if (ps.length) {
        var tb = el('table', 'pc'); var h = el('tr');
        ['Parcela', 'Vencimento', 'Cobrado', 'Pago', 'Em aberto', 'Mensalidade pela matrícula*', 'Diferença', 'Situação'].forEach(function (c) { h.appendChild(el('th', null, c)); }); tb.appendChild(h);
        var sc = 0, sp = 0, se = 0, sab = 0;
        ps.forEach(function (t) {
          var vig = ls[0] || null; ls.forEach(function (l) { if (l.data_ini.slice(0, 10) <= t.vencimento) vig = l; });
          var esperado = vig ? num(vig.mensalidade) * (1 - bolsa) : null;
          var cob = num(t.valor_original), pg = num(t.valor_baixado), ab = num(t.valor_aberto);
          sc += cob; sp += pg; sab += ab; if (esperado != null) se += esperado;
          var dif = esperado != null ? cob - esperado : null;
          var tr = el('tr');
          tr.append(el('td', null, String(t.parcela || '').replace(/\.0$/, '')), el('td', null, fmtD(t.vencimento)), el('td', null, BRL2.format(cob)), el('td', null, BRL2.format(pg)), el('td', null, BRL2.format(ab)),
            el('td', null, esperado != null ? BRL2.format(esperado) + ' (' + vig.leva + 'ª leva)' : '—'),
            el('td', dif != null && Math.abs(dif) > 1 ? (dif > 0 ? 'up' : 'dn') : null, dif != null ? (Math.abs(dif) <= 1 ? 'ok' : (dif > 0 ? '+' : '−') + BRL2.format(Math.abs(dif))) : '—'),
            el('td', 'fx-n', t.situacao || ''));
          tb.appendChild(tr);
        });
        var tf = el('tr', 'tot'); tf.append(el('td', null, 'Total'), el('td'), el('td', null, BRL2.format(sc)), el('td', null, BRL2.format(sp)), el('td', null, BRL2.format(sab)), el('td', null, se ? BRL2.format(se) : '—'), el('td', null, se ? ((sc - se) >= 0 ? '+' : '−') + BRL2.format(Math.abs(sc - se)) : '—'), el('td')); tb.appendChild(tf);
        var wrap = el('div', 'tw'); wrap.appendChild(tb); sec.appendChild(wrap);
        // explicação
        var ult = ls[ls.length - 1], ultP = ps[ps.length - 1];
        var ex = el('div', 'expl');
        var txt = [];
        if (ult) txt.push('Hoje a matrícula de ' + per + ' (' + ult.leva + 'ª leva, ' + fmtD(ult.data_ini) + ') tem ' + ult.n_disc + ' disciplina(s), somando ' + BRL2.format(num(ult.total_semestre)) + ' no semestre, o que dá ' + BRL2.format(num(ult.mensalidade)) + ' por mês' + (bolsa ? ' e ' + BRL2.format(num(ult.mensalidade) * (1 - bolsa)) + ' com a bolsa' : '') + '.');
        if (ls.length > 1) {
          var pri = ls[0]; var d = num(ult.mensalidade) - num(pri.mensalidade);
          if (Math.abs(d) > 0.5) txt.push('Na 1ª leva (' + fmtD(pri.data_ini) + ') eram ' + pri.n_disc + ' disciplina(s) e ' + BRL2.format(num(pri.mensalidade)) + '/mês; as inclusões e exclusões seguintes ' + (d > 0 ? 'aumentaram' : 'reduziram') + ' a mensalidade em ' + BRL2.format(Math.abs(d)) + '.');
        }
        if (ultP) txt.push('A parcela mais recente (' + fmtD(ultP.vencimento) + ') foi de ' + BRL2.format(num(ultP.valor_original)) + '.');
        txt.push('No semestre foram cobrados ' + BRL2.format(sc) + ', pagos ' + BRL2.format(sp) + (se ? '; pela matrícula vigente em cada vencimento seriam ' + BRL2.format(se) + ' (diferença de ' + ((sc - se) >= 0 ? '+' : '−') + BRL2.format(Math.abs(sc - se)) + ')' : '') + '.');
        if (per === '2026/1') txt.push('Atenção: as parcelas 1 e 2 de 2026/1 que venceram em 2025 não estão na extração.');
        ex.textContent = txt.join(' ');
        sec.appendChild(ex);
      }
      ct.appendChild(sec);
    });
    ct.appendChild(el('div', 'fx-n', '* Mensalidade pela matrícula = disciplinas ativas na data do vencimento × preço do semestre ÷ 6, menos a bolsa do plano. Descontos de pontualidade, acordos e ajustes manuais não entram nessa conta. Disciplinas sem preço na tabela recebem o preço mediano das demais disciplinas do aluno (indicado como estimado). Disciplinas marcadas com * foram identificadas por aproximação (o log do RM não traz o nome da disciplina). Quando a mudança não aparece no log, a data é o mês em que ela surgiu na base mensal de disciplinas.'));
  }

  /* ------------------------------- 1b. correção sistêmica (cobrança indevida) */
  var CORR = new Map(), DB = null;
  window.claude.use('db').then(function (db) {
    DB = db;
    db.collection('correcoes').onSnapshot(function (snap) {
      CORR = new Map(snap.docs.map(function (d) { return [d.id, d.data()]; }));
      document.querySelectorAll('.fx-corr').forEach(function (x) { if (!x.contains(document.activeElement)) x.remove(); });
      document.querySelectorAll('.fx-cb').forEach(function (x) { x.remove(); });
      aoMudar();
    }, function () {});
  }).catch(function () {});
  var ONDE = ['RM – lançamento/parcela', 'RM – contrato/plano de pagamento', 'RM – bolsa ou desconto', 'Banco – remessa/retorno (CNAB)',
    'PIX não conciliado', 'Acordo/renegociação', 'Cadastro do aluno/responsável', 'Outro'];
  function situacaoCorr(c) {
    if (!c) return { k: 'pend', t: 'Correção pendente', cor: '#C9821A', bg: '#FFF4E0' };
    if (c.necessaria === false) return { k: 'nao', t: 'Sem correção necessária', cor: '#5A6370', bg: '#EEF0F3' };
    if (c.status === 'feita') return { k: 'ok', t: 'Corrigido no sistema', cor: '#2E7D4F', bg: '#E8F4EC' };
    return { k: 'pend', t: 'Correção pendente', cor: '#C9821A', bg: '#FFF4E0' };
  }
  function keyDoDrawer(dr) { var h2 = dr.querySelector('.dh h2'); return h2 ? slug(h2.textContent) : null; }
  function etapaDoDrawer(dr) { var s = dr.querySelector('.db select.inp'); return s ? s.value : null; }
  function injetarCorrecao() {
    var dr = document.getElementById('drawer'); if (!dr) return;
    var corpo = dr.querySelector('.db'); if (!corpo) return;
    var ex = corpo.querySelector('.fx-corr');
    if (etapaDoDrawer(dr) !== 'indevida') { if (ex) ex.remove(); return; }
    if (ex) return;
    var key = keyDoDrawer(dr); if (!key) return;
    var ref = corpo.querySelector('.fx-ct'); var bloco = blocoCorrecao(key, dr.querySelector('.dh h2').textContent);
    if (ref && ref.nextSibling) corpo.insertBefore(bloco, ref.nextSibling); else corpo.insertBefore(bloco, corpo.firstChild);
  }
  function blocoCorrecao(key, nome) {
    var c = CORR.get(key), sit = situacaoCorr(c);
    var box = el('div', 'fx-corr');
    var hd = el('div', 'fx-corr-h'); hd.append(el('b', null, 'Correção no sistema'), el('span', 'fx-tag', sit.t));
    hd.lastChild.style.cssText = 'color:' + sit.cor + ';background:' + sit.bg; box.appendChild(hd);
    box.appendChild(el('div', 'fx-n', 'Cobrança indevida por erro de sistema ou de lançamento? Registre o ajuste feito para o erro não voltar a acontecer.'));
    var fm = el('div', 'fx-g');
    var pq = el('div', 'fx-r'); pq.appendChild(el('span', 'fx-l', 'Precisa corrigir algo no sistema ou no lançamento?'));
    var rS = el('label'), iS = el('input'); iS.type = 'radio'; iS.name = 'fx-nec-' + key; rS.append(iS, document.createTextNode(' Sim'));
    var rN = el('label'), iN = el('input'); iN.type = 'radio'; iN.name = 'fx-nec-' + key; rN.append(iN, document.createTextNode(' Não, foi um caso isolado'));
    pq.append(rS, rN); fm.appendChild(pq);
    var det = el('div', 'fx-g2');
    var sO = el('select', 'fx-in'); sO.appendChild(new Option('Onde estava o erro…', '')); ONDE.forEach(function (o) { sO.appendChild(new Option(o, o)); });
    var tD = el('textarea', 'fx-in'); tD.rows = 3; tD.placeholder = 'O que foi ajustado (ex.: parcela 4 cancelada no RM e contrato corrigido para 5 parcelas)';
    var tP = el('input', 'fx-in'); tP.placeholder = 'Quem fez o ajuste (setor/pessoa), se não foi você';
    var cF = el('input'); cF.type = 'checkbox'; var lF = el('label', 'fx-n'); lF.append(cF, document.createTextNode(' A correção já foi feita e conferida no sistema'));
    det.append(sO, tD, tP, lF); fm.appendChild(det);
    var tJ = el('textarea', 'fx-in'); tJ.rows = 2; tJ.placeholder = 'Por que não precisa de correção (opcional)';
    fm.appendChild(tJ);
    var ms = el('div', 'fx-n'); var bt = el('button', 'fx-bt', 'Salvar correção'); bt.type = 'button';
    fm.append(bt, ms); box.appendChild(fm);
    if (c) {
      if (c.necessaria === false) iN.checked = true; else iS.checked = true;
      sO.value = c.onde || ''; tD.value = c.descricao || ''; tP.value = c.executor || ''; cF.checked = c.status === 'feita'; tJ.value = c.justificativa || '';
      if (c.status === 'feita' && c.feitoEm) box.appendChild(el('div', 'fx-n', 'Marcado como corrigido em ' + new Date(c.feitoEm).toLocaleString('pt-BR') + '.'));
    }
    function vis() { det.style.display = iS.checked ? '' : 'none'; tJ.style.display = iN.checked ? '' : 'none'; }
    iS.addEventListener('change', vis); iN.addEventListener('change', vis); vis();
    bt.addEventListener('click', function () {
      if (!iS.checked && !iN.checked) { ms.textContent = 'Responda se precisa de correção.'; return; }
      if (iS.checked && (!sO.value || !tD.value.trim())) { ms.textContent = 'Informe onde estava o erro e o que foi ajustado.'; return; }
      if (!DB) { ms.textContent = 'Sem conexão com o banco.'; return; }
      var agora = new Date().toISOString(), uid = ME ? ME.id : null, ant = CORR.get(key) || {};
      var novo = iS.checked
        ? { card: key, nome: nome, necessaria: true, onde: sO.value, descricao: tD.value.trim(), executor: tP.value.trim(), status: cF.checked ? 'feita' : 'pendente',
            feitoEm: cF.checked ? (ant.status === 'feita' && ant.feitoEm ? ant.feitoEm : agora) : null, feitoPor: cF.checked ? (ant.status === 'feita' && ant.feitoPor ? ant.feitoPor : uid) : null, at: agora, by: uid }
        : { card: key, nome: nome, necessaria: false, justificativa: tJ.value.trim(), status: 'nao_necessaria', at: agora, by: uid };
      bt.disabled = true; ms.textContent = 'Salvando…';
      var texto = novo.necessaria ? ('Correção no sistema ' + (novo.status === 'feita' ? 'FEITA' : 'pendente') + ' · ' + novo.onde + ': ' + novo.descricao + (novo.executor ? ' (ajuste por ' + novo.executor + ')' : ''))
        : ('Cobrança indevida sem necessidade de correção no sistema' + (novo.justificativa ? ': ' + novo.justificativa : ''));
      DB.collection('correcoes').doc(key).set(novo)
        .then(function () { return DB.collection('eventos').add({ card: key, nome: nome, at: agora, by: uid, tipo: 'nota', texto: texto }); })
        .then(function () { ms.textContent = 'Salvo.'; }, function (e) { ms.textContent = 'Não foi possível salvar: ' + e.message; })
        .then(function () { bt.disabled = false; });
    });
    return box;
  }
  function marcarCards() {
    document.querySelectorAll('section[data-col="indevida"] .card[data-key]').forEach(function (c) {
      if (c.querySelector('.fx-cb')) return;
      var sit = situacaoCorr(CORR.get(c.dataset.key));
      var t = el('span', 'fx-cb', sit.t); t.style.cssText = 'display:inline-block;margin-top:6px;font-size:10.5px;font-weight:600;padding:1px 7px;border-radius:999px;color:' + sit.cor + ';background:' + sit.bg;
      c.appendChild(t);
    });
  }

  /* --------------------------------------------- 2. área do administrador */
  var ME = null, ADMIN = false;
  function rpc(fn, args) {
    return sb.rpc(fn, args || {}).then(function (r) {
      if (r.error) throw new Error(r.error.message || 'Erro');
      return r.data;
    });
  }
  sb.auth.getSession().then(function (r) {
    var s = r.data && r.data.session; if (!s) return;
    ME = s.user;
    return sb.from('acessos').select('admin,ativo').eq('email', (s.user.email || '').toLowerCase()).maybeSingle().then(function (x) {
      ADMIN = !!(x.data && x.data.admin && x.data.ativo);
      if (ADMIN) botaoAdmin();
    });
  });
  sb.auth.onAuthStateChange(function (ev, s) {
    if (ev === 'SIGNED_OUT') { ME = null; ADMIN = false; return; }
    if (ev === 'SIGNED_IN' && s && (!ME || ME.id !== s.user.id)) {
      ME = s.user; var meu = s.user.id;
      sb.from('acessos').select('admin,ativo').eq('email', (s.user.email || '').toLowerCase()).maybeSingle().then(function (x) {
        if (!ME || ME.id !== meu) return;
        ADMIN = !!(x.data && x.data.admin && x.data.ativo); if (ADMIN) botaoAdmin();
      });
    }
  });
  function botaoAdmin() {
    function por() {
      var bar = document.getElementById('fx-bar');
      if (!bar) { setTimeout(por, 400); return; }
      if (bar.querySelector('.fx-adm-b')) return;
      var b = el('button', 'fx-adm-b', 'Administração'); b.type = 'button';
      b.style.cssText = 'border-color:#E52329;color:#E52329;font-weight:600';
      b.addEventListener('click', abrirAdmin);
      bar.insertBefore(b, bar.firstChild);
    }
    por();
  }

  function abrirAdmin(aba) {
    var o = document.getElementById('fx-adm'); if (o) o.remove();
    o = el('div'); o.id = 'fx-adm';
    var bx = el('div', 'bx'); o.appendChild(bx);
    var hd = el('div', 'hd'); hd.appendChild(el('h2', null, 'Administração do painel'));
    var x = el('button', null, '×'); x.type = 'button'; x.setAttribute('aria-label', 'Fechar'); x.addEventListener('click', function () { o.remove(); }); hd.appendChild(x);
    bx.appendChild(hd);
    var tb = el('div', 'tb'); bx.appendChild(tb);
    var ct = el('div', 'ct'); bx.appendChild(ct);
    var ABAS = [['usuarios', 'Usuários', abaUsuarios], ['distribuir', 'Distribuir cards', abaDistribuir], ['correcoes', 'Correções no sistema', abaCorrecoes], ['bases', 'Atualizar bases', abaBases]];
    function ir(id) {
      ABAS.forEach(function (a) { a.b.setAttribute('aria-selected', String(a[0] === id)); });
      ct.replaceChildren(); ABAS.filter(function (a) { return a[0] === id; })[0][2](ct);
    }
    ABAS.forEach(function (a) { var b = el('button', null, a[1]); b.type = 'button'; b.setAttribute('role', 'tab'); b.addEventListener('click', function () { ir(a[0]); }); a.b = b; tb.appendChild(b); });
    o.addEventListener('click', function (e) { if (e.target === o) o.remove(); });
    document.body.appendChild(o);
    ir(typeof aba === 'string' ? aba : 'usuarios');
  }

  /* ---- usuários */
  function abaUsuarios(ct) {
    ct.appendChild(el('div', 'nt', 'Crie o acesso, informe a senha provisória à pessoa e peça para ela trocar no botão "Trocar senha" depois de entrar.'));
    var fm = el('form', 'fm');
    function campo(rot, inp) { var d = el('div'); var l = el('label', 'l', rot); d.appendChild(l); d.appendChild(inp); return d; }
    var iN = el('input', 'in'); iN.required = true; iN.placeholder = 'Nome completo';
    var iE = el('input', 'in'); iE.type = 'email'; iE.required = true; iE.placeholder = 'nome@fucape.br';
    var iS = el('input', 'in'); iS.type = 'text'; iS.required = true; iS.minLength = 8; iS.placeholder = 'mín. 8 caracteres'; iS.autocomplete = 'off';
    var gera = el('button', 'bt', 'Gerar senha'); gera.type = 'button';
    gera.addEventListener('click', function () { iS.value = senhaAleatoria(); });
    var dA = el('label', 'nt'); var cA = el('input'); cA.type = 'checkbox'; dA.append(cA, document.createTextNode(' Administrador'));
    var dE = el('label', 'nt'); var cE = el('input'); cE.type = 'checkbox'; cE.checked = true; dE.append(cE, document.createTextNode(' Entra na equipe de cobrança'));
    var ok = el('button', 'bt p', 'Criar acesso'); ok.type = 'submit';
    fm.append(campo('Nome', iN), campo('E-mail', iE), campo('Senha provisória', iS), gera, el('div'), ok);
    var opts = el('div'); opts.style.cssText = 'grid-column:1/-1;display:flex;gap:18px'; opts.append(dA, dE); fm.appendChild(opts);
    ct.appendChild(fm);
    var ms = el('div', 'ms'); ct.appendChild(ms);
    var tab = el('table'); ct.appendChild(tab);
    function msg(t, tipo) { ms.className = 'ms ' + (tipo || ''); ms.textContent = t; }

    fm.addEventListener('submit', function (e) {
      e.preventDefault(); ok.disabled = true; msg('Criando acesso…');
      var email = iE.value.trim().toLowerCase(), nome = iN.value.trim(), senha = iS.value;
      rpc('admin_criar_usuario', { p_email: email, p_nome: nome, p_senha: senha, p_admin: cA.checked })
        .then(function (uid) { return cE.checked ? incluirEquipe(uid).then(function () { return uid; }) : uid; })
        .then(function () {
          msg('Acesso criado para ' + nome + '. Senha provisória: ' + senha + ' (anote antes de fechar).', 'ok');
          iN.value = ''; iE.value = ''; iS.value = ''; cA.checked = false; listar();
        })
        .catch(function (er) { msg(traduz(er.message), 'er'); })
        .then(function () { ok.disabled = false; });
    });

    function listar() {
      tab.replaceChildren();
      var th = el('tr'); ['Nome', 'E-mail', 'Perfil', 'Situação', 'Último acesso', ''].forEach(function (h) { th.appendChild(el('th', null, h)); });
      tab.appendChild(th);
      rpc('admin_listar_usuarios').then(function (us) {
        (us || []).forEach(function (u) {
          var tr = el('tr');
          tr.appendChild(el('td', null, u.nome));
          tr.appendChild(el('td', null, u.email));
          var tp = el('td'); tp.appendChild(el('span', 'tg' + (u.admin ? ' a' : ''), u.admin ? 'Administrador' : 'Cobrança')); tr.appendChild(tp);
          var ts = el('td'); ts.appendChild(el('span', 'tg' + (u.ativo ? ' o' : ''), !u.tem_login ? 'Sem login criado' : (u.ativo ? 'Ativo' : 'Bloqueado'))); tr.appendChild(ts);
          tr.appendChild(el('td', 'nt', u.ultimo_acesso ? new Date(u.ultimo_acesso).toLocaleString('pt-BR') : 'nunca'));
          var ac = el('td'); ac.style.whiteSpace = 'nowrap';
          var proprio = ME && (ME.email || '').toLowerCase() === u.email;
          var bS = el('button', 'bt', 'Nova senha'); bS.type = 'button';
          bS.addEventListener('click', function () {
            var s = window.prompt('Nova senha para ' + u.nome + ' (mín. 8 caracteres):', senhaAleatoria());
            if (!s) return;
            rpc('admin_redefinir_senha', { p_email: u.email, p_senha: s }).then(function () { msg('Senha de ' + u.nome + ' redefinida para: ' + s, 'ok'); listar(); }, function (er) { msg(traduz(er.message), 'er'); });
          });
          var bB = el('button', 'bt', u.ativo ? 'Bloquear' : 'Reativar'); bB.type = 'button'; bB.disabled = proprio;
          bB.addEventListener('click', function () {
            rpc('admin_definir_acesso', { p_email: u.email, p_admin: u.admin, p_ativo: !u.ativo }).then(function () { msg(u.nome + (u.ativo ? ' bloqueado(a).' : ' reativado(a).'), 'ok'); listar(); }, function (er) { msg(traduz(er.message), 'er'); });
          });
          var bP = el('button', 'bt', u.admin ? 'Tirar admin' : 'Tornar admin'); bP.type = 'button'; bP.disabled = proprio;
          bP.addEventListener('click', function () {
            rpc('admin_definir_acesso', { p_email: u.email, p_admin: !u.admin, p_ativo: u.ativo }).then(function () { listar(); }, function (er) { msg(traduz(er.message), 'er'); });
          });
          var bX = el('button', 'bt d', 'Excluir'); bX.type = 'button'; bX.disabled = proprio;
          bX.addEventListener('click', function () {
            if (bX.dataset.conf !== '1') { bX.dataset.conf = '1'; bX.textContent = 'Confirmar exclusão'; setTimeout(function () { bX.dataset.conf = ''; bX.textContent = 'Excluir'; }, 4000); return; }
            rpc('admin_excluir_usuario', { p_email: u.email }).then(function () { msg(u.nome + ' excluído(a). Os cards dele(a) ficaram sem dono.', 'ok'); listar(); }, function (er) { msg(traduz(er.message), 'er'); });
          });
          [bS, bB, bP, bX].forEach(function (b) { b.style.marginLeft = '4px'; ac.appendChild(b); });
          tr.appendChild(ac);
          tab.appendChild(tr);
        });
      }).catch(function (er) { msg(traduz(er.message), 'er'); });
    }
    listar();
  }
  function senhaAleatoria() {
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', r = new Uint8Array(10), s = '';
    crypto.getRandomValues(r); for (var i = 0; i < 10; i++) s += a[r[i] % a.length];
    return 'Fucape-' + s;
  }
  function traduz(m) {
    m = String(m || '');
    if (/Could not find the function|schema cache/i.test(m)) return 'As funções de administração ainda não foram instaladas no Supabase (arquivo admin.sql).';
    return m;
  }
  function incluirEquipe(uid) {
    return window.claude.use('db').then(function (db) {
      return db.doc('config/equipe').get().then(function (s) {
        var m = (s.exists && s.data().membros) || [];
        if (m.indexOf(uid) >= 0) return;
        return db.doc('config/equipe').set({ membros: m.concat(uid) });
      });
    });
  }

  /* ---- distribuir cards */
  function abaDistribuir(ct) {
    ct.appendChild(el('div', 'nt', 'Divide os cards entre as pessoas escolhidas de forma aleatória, equilibrando a quantidade e o valor em aberto. Cada atribuição fica registrada no histórico de alocações.'));
    var box = el('div'); box.style.margin = '14px 0'; ct.appendChild(box);
    var ms = el('div', 'ms'); ct.appendChild(ms);
    var prev = el('div'); ct.appendChild(prev);
    var cS = el('input'); cS.type = 'checkbox'; cS.checked = true;
    var lS = el('label', 'nt'); lS.append(cS, document.createTextNode(' Só cards sem dono (não mexe no que já está com alguém)'));
    var cF = el('input'); cF.type = 'checkbox'; cF.checked = true;
    var lF = el('label', 'nt'); lF.append(cF, document.createTextNode(' Ignorar cards em Êxito e Cobrança indevida'));
    var pessoas = [], marcados = new Set();
    Promise.all([sb.from('pessoas').select('id,nome,email,ativo').eq('ativo', true).order('nome'), window.claude.use('db')]).then(function (r) {
      pessoas = (r[0].data || []);
      box.appendChild(el('div', 'l', 'Distribuir entre:'));
      var g = el('div'); g.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px 18px;margin:6px 0 12px';
      pessoas.forEach(function (p) {
        var l = el('label', 'nt'); var c = el('input'); c.type = 'checkbox'; c.value = p.id;
        if (ME && p.id !== ME.id) { c.checked = true; marcados.add(p.id); }
        c.addEventListener('change', function () { if (c.checked) marcados.add(p.id); else marcados.delete(p.id); });
        l.append(c, document.createTextNode(' ' + p.nome)); g.appendChild(l);
      });
      if (!pessoas.length) g.appendChild(el('div', 'nt', 'Ninguém fez login ainda. A pessoa precisa ter o acesso criado (aba Usuários).'));
      box.appendChild(g);
      var o2 = el('div'); o2.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:12px'; o2.append(lS, lF); box.appendChild(o2);
      var bPrev = el('button', 'bt', 'Simular divisão'); bPrev.type = 'button';
      var bGo = el('button', 'bt p', 'Distribuir agora'); bGo.type = 'button'; bGo.disabled = true; bGo.style.marginLeft = '8px';
      box.append(bPrev, bGo);
      var plano = null;
      bPrev.addEventListener('click', function () {
        ms.className = 'ms'; ms.textContent = 'Calculando…';
        montarPlano(Array.from(marcados), cS.checked, cF.checked).then(function (p) {
          plano = p; mostrarPlano(prev, p, pessoas); ms.textContent = p.itens.length ? '' : 'Nenhum card para distribuir com esses filtros.';
          bGo.disabled = !p.itens.length;
        }).catch(function (er) { ms.className = 'ms er'; ms.textContent = er.message; });
      });
      bGo.addEventListener('click', function () {
        if (!plano) return; bGo.disabled = true; bPrev.disabled = true;
        executarPlano(plano, prev, ms).then(function () { bPrev.disabled = false; plano = null; });
      });
    });
  }
  function embaralhar(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function montarPlano(ids, soSemDono, ignorarFim) {
    if (!ids.length) return Promise.reject(new Error('Escolha pelo menos uma pessoa.'));
    return Promise.all([csv('dados/cards.csv'), window.claude.use('db').then(function (db) { return db.collection('cards').get(); })]).then(function (r) {
      var cards = r[0], docs = new Map();
      r[1].docs.forEach(function (d) { docs.set(d.id, d.data()); });
      var lista = cards.filter(function (c) {
        var d = docs.get(c.key) || {};
        if (soSemDono && d.owner) return false;
        if (ignorarFim && (d.status === 'exito' || d.status === 'indevida')) return false;
        return true;
      });
      lista.sort(function (a, b) { return (num(b.valor_cobrar) + num(b.valor_validar)) - (num(a.valor_cobrar) + num(a.valor_validar)) || num(b.valor_aberto_total) - num(a.valor_aberto_total); });
      var itens = [], n = ids.length;
      for (var i = 0; i < lista.length; i += n) {
        var bloco = lista.slice(i, i + n), quem = embaralhar(ids.slice());
        bloco.forEach(function (c, j) { itens.push({ card: c, doc: docs.get(c.key), para: quem[j] }); });
      }
      return { ids: ids, itens: itens };
    });
  }
  function mostrarPlano(prev, p, pessoas) {
    prev.replaceChildren();
    if (!p.itens.length) return;
    var nome = {}; pessoas.forEach(function (x) { nome[x.id] = x.nome; });
    var t = el('table'); var h = el('tr'); ['Pessoa', 'Cards', 'Valor em aberto', 'A cobrar agora'].forEach(function (x) { h.appendChild(el('th', null, x)); }); t.appendChild(h);
    p.ids.forEach(function (id) {
      var meus = p.itens.filter(function (i) { return i.para === id; });
      var tr = el('tr');
      tr.append(el('td', null, nome[id] || id), el('td', null, String(meus.length)),
        el('td', null, BRL.format(meus.reduce(function (s, i) { return s + num(i.card.valor_aberto_total); }, 0))),
        el('td', null, BRL.format(meus.reduce(function (s, i) { return s + num(i.card.valor_cobrar); }, 0))));
      t.appendChild(tr);
    });
    prev.appendChild(t);
  }
  function executarPlano(p, prev, ms) {
    var lote = 'L' + Date.now().toString(36), feito = 0, falhas = 0, agora = new Date().toISOString();
    var pb = el('div', 'pb'); var bar = el('i'); pb.appendChild(bar); prev.appendChild(pb);
    ms.className = 'ms'; ms.textContent = 'Distribuindo…';
    return window.claude.use('db').then(function (db) {
      var fila = p.itens.slice();
      function trabalhador() {
        var it = fila.shift(); if (!it) return Promise.resolve();
        var c = it.card, d = it.doc || {};
        var statusPadrao = (num(c.valor_acordo_aberto) > 0 && !num(c.valor_cobrar) && !num(c.valor_validar)) ? 'escritorio' : 'validacao';
        var novo = Object.assign({ nome: c.pagador, status: statusPadrao, owner: null, motivosIndevida: [], motivosAtraso: [], proxAcao: null, promessa: null }, d,
          { owner: it.para, atualizadoEm: agora, atualizadoPor: ME ? ME.id : null });
        return db.collection('cards').doc(c.key).set(novo)
          .then(function () { return db.collection('alocacoes').add({ card: c.key, nome: novo.nome, at: new Date().toISOString(), by: ME ? ME.id : null, tipo: 'atribuicao', de: d.owner || null, para: it.para, lote: lote }); })
          .catch(function () { falhas++; })
          .then(function () { feito++; bar.style.width = (100 * feito / p.itens.length) + '%'; ms.textContent = feito + ' de ' + p.itens.length + (falhas ? ' · ' + falhas + ' falha(s)' : ''); })
          .then(trabalhador);
      }
      return Promise.all([trabalhador(), trabalhador(), trabalhador(), trabalhador()]);
    }).then(function () {
      ms.className = 'ms ' + (falhas ? 'er' : 'ok');
      ms.textContent = 'Concluído: ' + (p.itens.length - falhas) + ' card(s) distribuído(s)' + (falhas ? ', ' + falhas + ' falharam (rode de novo só para os sem dono)' : '') + '.';
    });
  }


  /* ---- correções sistêmicas */
  function abaCorrecoes(ct) {
    ct.appendChild(el('div', 'nt', 'Cards em "Cobrança indevida" e a situação da correção no sistema. Use para garantir que todo erro de sistema ou lançamento foi ajustado na origem.'));
    var ms = el('div', 'ms'); ct.appendChild(ms); var t = el('table'); ct.appendChild(t);
    Promise.all([DB ? DB.collection('cards').get() : Promise.reject(new Error('sem banco')), DB.collection('correcoes').get(), sb.from('pessoas').select('id,nome')]).then(function (r) {
      var nomes = {}; (r[2].data || []).forEach(function (p) { nomes[p.id] = p.nome; });
      var corr = new Map(r[1].docs.map(function (d) { return [d.id, d.data()]; }));
      var ind = r[0].docs.map(function (d) { return Object.assign({ key: d.id }, d.data()); }).filter(function (d) { return d.status === 'indevida'; });
      var cont = { pend: 0, ok: 0, nao: 0 };
      var h = el('tr'); ['Responsável financeiro', 'Dono do card', 'Situação', 'Onde', 'O que foi ajustado', 'Atualizado'].forEach(function (x) { h.appendChild(el('th', null, x)); }); t.appendChild(h);
      ind.sort(function (a, b) { return situacaoCorr(corr.get(a.key)).k.localeCompare(situacaoCorr(corr.get(b.key)).k) * -1; });
      ind.forEach(function (d) {
        var c = corr.get(d.key), s = situacaoCorr(c); cont[s.k]++;
        var tr = el('tr'); var tg = el('span', 'tg', s.t); tg.style.cssText = 'color:' + s.cor + ';background:' + s.bg;
        var td = el('td'); td.appendChild(tg);
        tr.append(el('td', null, d.nome || d.key), el('td', null, nomes[d.owner] || '—'), td, el('td', null, (c && c.onde) || '—'),
          el('td', 'nt', c ? (c.descricao || c.justificativa || '') : ''), el('td', 'nt', c && c.at ? new Date(c.at).toLocaleDateString('pt-BR') : ''));
        t.appendChild(tr);
      });
      ms.textContent = ind.length ? (ind.length + ' cobrança(s) indevida(s): ' + cont.pend + ' com correção pendente, ' + cont.ok + ' corrigida(s), ' + cont.nao + ' sem necessidade de correção.') : 'Nenhum card em Cobrança indevida no momento.';
    }).catch(function (e) { ms.className = 'ms er'; ms.textContent = e.message; });
  }

  /* ---- atualizar bases */
  var ARQS = ['cards.csv', 'kanban_titulos.csv', 'pagadores.csv', 'titulos_jan_jun.csv', 'titulos_jul_dez.csv', 'disciplinas.csv', 'planos_alunos.csv', 'contatos.csv', 'matricula_levas.csv', 'matricula_eventos.csv'];
  function abaBases(ct) {
    ct.appendChild(el('div', 'nt', 'Envie os arquivos gerados pelo processamento das extrações do RM (.csv ou .csv.gz). Arquivos com o mesmo nome substituem os atuais. O histórico do quadro não é afetado.'));
    var lst = el('table'); lst.style.margin = '12px 0'; ct.appendChild(lst);
    var inp = el('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.csv,.gz';
    var bx = el('div'); bx.style.margin = '6px 0 10px'; bx.appendChild(inp); ct.appendChild(bx);
    var ms = el('div', 'ms'); ct.appendChild(ms);
    function atual() {
      lst.replaceChildren();
      var h = el('tr'); ['Arquivo esperado', 'No Supabase', 'Atualizado em'].forEach(function (x) { h.appendChild(el('th', null, x)); }); lst.appendChild(h);
      sb.storage.from('dados').list('', { limit: 1000 }).then(function (r) {
        var m = {}; (r.data || []).forEach(function (f) { m[f.name] = f; });
        ARQS.forEach(function (a) {
          var f = m[a + '.gz'] || m[a]; var tr = el('tr');
          tr.append(el('td', null, a), el('td', null, f ? f.name + ' (' + Math.round(((f.metadata && f.metadata.size) || 0) / 1024) + ' KB)' : '— falta —'),
            el('td', 'nt', f && f.updated_at ? new Date(f.updated_at).toLocaleString('pt-BR') : ''));
          lst.appendChild(tr);
        });
      });
    }
    atual();
    inp.addEventListener('change', function () {
      var fs = Array.from(inp.files || []); if (!fs.length) return;
      var ruins = fs.filter(function (f) { return ARQS.indexOf(f.name.replace(/\.gz$/, '')) < 0; });
      if (ruins.length) { ms.className = 'ms er'; ms.textContent = 'Nome inesperado: ' + ruins.map(function (f) { return f.name; }).join(', ') + '. Use exatamente os nomes da lista.'; return; }
      ms.className = 'ms'; ms.textContent = 'Enviando ' + fs.length + ' arquivo(s)…';
      var seq = Promise.resolve(), ok = 0, er = [];
      fs.forEach(function (f) {
        seq = seq.then(function () {
          var gz = /\.gz$/.test(f.name);
          var corpo = gz ? Promise.resolve(f) : new Response(f.stream().pipeThrough(new CompressionStream('gzip'))).blob();
          var nome = gz ? f.name : f.name + '.gz';
          return corpo.then(function (b) {
            return sb.storage.from('dados').upload(nome, b, { upsert: true, contentType: 'application/gzip', cacheControl: '60' });
          }).then(function (r) {
            if (r.error) er.push(f.name + ': ' + r.error.message); else ok++;
            if (!gz) return sb.storage.from('dados').remove([f.name]).catch(function () {});
          });
        });
      });
      seq.then(function () {
        try { if (window.caches) caches.delete('fucape-dados-v1'); } catch (e) {}
        ms.className = 'ms ' + (er.length ? 'er' : 'ok');
        ms.textContent = ok + ' arquivo(s) atualizado(s).' + (er.length ? ' Erros: ' + er.join(' | ') : ' Recarregue a página (Ctrl+F5) para ver os dados novos.');
        inp.value = ''; atual();
      });
    });
  }
})();
