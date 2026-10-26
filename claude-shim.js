/*
 * claude-shim.js — substitui o "runtime" do Claude (db, user, downloads e arquivos)
 * por Supabase, para o painel rodar como site estático (Vercel) sem alterar o código do painel.
 *
 *   claude.use('db')        → tabela public.docs (Postgres) + Realtime
 *   claude.use('user')      → Supabase Auth + tabelas public.acessos / public.pessoas
 *   claude.use('downloads') → download direto no navegador
 *   fetch('dados/<arquivo>')→ bucket privado "dados" do Supabase Storage (aceita .csv.gz)
 */
(function () {
  'use strict';
  var CFG = window.FUCAPE_CONFIG || {};
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || /COLE_AQUI/.test(CFG.supabaseUrl + CFG.supabaseAnonKey)) {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.innerHTML = '<div style="font:15px sans-serif;max-width:560px;margin:80px auto;padding:24px;border:1px solid #ddd;border-radius:12px">' +
        '<b>Configuração pendente.</b><br>Preencha <code>public/js/config.js</code> com a URL e a chave <i>anon</i> do seu projeto Supabase (veja o README).</div>';
    });
    window.claude = { use: function () { return new Promise(function () {}); } };
    return;
  }

  // o link de convite/recuperação chega com #...type=invite|recovery: lembrar antes do supabase-js limpar o hash
  var HASH = location.hash || '';
  var PEDIR_SENHA = /type=(invite|recovery|signup)/.test(HASH);

  var sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.__sb = sb;

  var BUCKET = CFG.bucket || 'dados';
  var resolverAuth;
  var authPronto = new Promise(function (r) { resolverAuth = r; });
  var SESSAO = null, ACESSO = null;

  /* ---------------------------------------------------------------- UI de login */
  var CSS = '' +
    '#fx-login{position:fixed;inset:0;z-index:99999;background:#F4F5F7;display:flex;align-items:center;justify-content:center;font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1C2430;padding:16px}' +
    '#fx-login .bx{background:#fff;border-radius:14px;box-shadow:0 10px 40px rgba(20,30,50,.12);width:100%;max-width:380px;padding:28px 26px}' +
    '#fx-login .lg{display:flex;align-items:center;gap:10px;margin-bottom:18px}' +
    '#fx-login .lg i{width:34px;height:34px;border-radius:8px;background:#E52329;display:inline-block}' +
    '#fx-login .lg b{font-size:17px}#fx-login .lg small{display:block;color:#6B7480;font-weight:400}' +
    '#fx-login label{display:block;font-size:12px;color:#5A6370;margin:12px 0 4px}' +
    '#fx-login input{width:100%;box-sizing:border-box;border:1px solid #CDD3DB;border-radius:8px;padding:10px 12px;font:inherit}' +
    '#fx-login input:focus{outline:2px solid #E5232933;border-color:#E52329}' +
    '#fx-login button{margin-top:18px;width:100%;border:0;border-radius:8px;background:#E52329;color:#fff;font:600 14px inherit;padding:11px;cursor:pointer}' +
    '#fx-login button[disabled]{opacity:.6;cursor:default}' +
    '#fx-login .msg{min-height:18px;margin-top:12px;font-size:13px;color:#B3261E}' +
    '#fx-login .ok{color:#2E7D4F}' +
    '#fx-login .nt{margin-top:14px;font-size:12px;color:#6B7480}' +
    '#fx-bar{position:fixed;right:10px;bottom:10px;z-index:9999;display:flex;gap:6px;font:12px -apple-system,BlinkMacSystemFont,sans-serif}' +
    '#fx-bar button{border:1px solid #CDD3DB;background:#fff;color:#1C2430;border-radius:999px;padding:5px 11px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.06)}' +
    '#fx-bar button:hover{border-color:#E52329;color:#E52329}';

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function quandoPronto(fn) {
    if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn);
  }
  quandoPronto(function () { document.head.appendChild(el('style', null, CSS)); });

  function tela(conteudo) {
    quandoPronto(function () {
      var o = document.getElementById('fx-login');
      if (!o) { o = el('div', { id: 'fx-login' }); document.body.appendChild(o); }
      o.innerHTML = '<div class="bx"><div class="lg"><i></i><div><b>Cobrança – Fucape</b><small>Acesso restrito à equipe</small></div></div>' + conteudo + '</div>';
    });
  }
  function fecharTela() { var o = document.getElementById('fx-login'); if (o) o.remove(); }

  function telaLogin(msg) {
    tela('<form id="fx-f"><label>E-mail</label><input id="fx-e" type="email" autocomplete="username" required>' +
      '<label>Senha</label><input id="fx-s" type="password" autocomplete="current-password" required>' +
      '<button id="fx-b">Entrar</button><div class="msg" id="fx-m"></div>' +
      '<div class="nt">Esqueceu a senha? Peça ao administrador do painel para redefini-la.</div></form>');
    quandoPronto(function () {
      var m = document.getElementById('fx-m'); if (msg) m.textContent = msg;
      document.getElementById('fx-f').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var b = document.getElementById('fx-b'); b.disabled = true; m.textContent = '';
        sb.auth.signInWithPassword({ email: document.getElementById('fx-e').value.trim().toLowerCase(), password: document.getElementById('fx-s').value })
          .then(function (r) {
            b.disabled = false;
            if (r.error) { m.textContent = /invalid/i.test(r.error.message) ? 'E-mail ou senha incorretos.' : r.error.message; return; }
            entrar(r.data.session);
          });
      });
    });
  }

  function telaSenha(primeira) {
    tela('<form id="fx-f"><div>' + (primeira ? 'Defina sua senha de acesso.' : 'Escolha uma nova senha.') + '</div>' +
      '<label>Nova senha (mín. 8 caracteres)</label><input id="fx-s1" type="password" autocomplete="new-password" minlength="8" required>' +
      '<label>Repita a senha</label><input id="fx-s2" type="password" autocomplete="new-password" minlength="8" required>' +
      '<button id="fx-b">Salvar senha</button>' + (primeira ? '' : '<button type="button" id="fx-c" style="background:#fff;color:#1C2430;border:1px solid #CDD3DB;margin-top:8px">Cancelar</button>') +
      '<div class="msg" id="fx-m"></div></form>');
    quandoPronto(function () {
      var m = document.getElementById('fx-m');
      var c = document.getElementById('fx-c'); if (c) c.addEventListener('click', fecharTela);
      document.getElementById('fx-f').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var s1 = document.getElementById('fx-s1').value, s2 = document.getElementById('fx-s2').value;
        if (s1 !== s2) { m.textContent = 'As senhas não conferem.'; return; }
        var b = document.getElementById('fx-b'); b.disabled = true;
        sb.auth.updateUser({ password: s1 }).then(function (r) {
          b.disabled = false;
          if (r.error) { m.textContent = r.error.message; return; }
          if (primeira) { PEDIR_SENHA = false; sb.auth.getSession().then(function (x) { entrar(x.data.session); }); }
          else { m.className = 'msg ok'; m.textContent = 'Senha alterada.'; setTimeout(fecharTela, 900); }
        });
      });
    });
  }

  function barra() {
    quandoPronto(function () {
      if (document.getElementById('fx-bar')) return;
      var b = el('div', { id: 'fx-bar' });
      var t = el('button', { type: 'button', title: 'Trocar senha' }, 'Trocar senha');
      var s = el('button', { type: 'button', title: (ACESSO && ACESSO.email) || '' }, 'Sair');
      t.addEventListener('click', function () { telaSenha(false); });
      s.addEventListener('click', function () {
        limparCache().then(function () { return sb.auth.signOut(); }).then(function () { location.reload(); });
      });
      b.appendChild(t); b.appendChild(s); document.body.appendChild(b);
    });
  }

  var entrando = false;
  function entrar(sessao) {
    if (!sessao || entrando || SESSAO) return;
    if (PEDIR_SENHA) { telaSenha(true); return; }
    entrando = true;
    var email = (sessao.user.email || '').toLowerCase();
    sb.from('acessos').select('email,nome,admin,ativo').eq('email', email).maybeSingle().then(function (r) {
      entrando = false;
      if (r.error || !r.data || !r.data.ativo) {
        sb.auth.signOut();
        telaLogin('Seu usuário não tem acesso a este painel. Fale com o administrador.');
        return;
      }
      SESSAO = sessao; ACESSO = r.data;
      fecharTela(); barra(); resolverAuth();
    });
  }

  sb.auth.getSession().then(function (r) {
    if (r.data && r.data.session) entrar(r.data.session); else if (!PEDIR_SENHA) telaLogin();
  });
  sb.auth.onAuthStateChange(function (ev, sessao) {
    if (ev === 'PASSWORD_RECOVERY') { PEDIR_SENHA = true; telaSenha(true); return; }
    if ((ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION') && sessao && !SESSAO) {
      if (PEDIR_SENHA) telaSenha(true); else entrar(sessao);
    }
    if (ev === 'SIGNED_OUT' && SESSAO) location.reload();
  });

  /* ------------------------------------------------- arquivos (bucket privado) */
  var CACHE = 'fucape-dados-v1';
  var versoes = null;
  function listarVersoes() {
    if (!versoes) {
      versoes = sb.storage.from(BUCKET).list('', { limit: 1000 }).then(function (r) {
        var m = {};
        (r.data || []).forEach(function (f) { m[f.name] = f.updated_at || (f.metadata && f.metadata.eTag) || ''; });
        return m;
      }).catch(function () { return {}; });
    }
    return versoes;
  }
  function limparCache() {
    try { return window.caches ? caches.delete(CACHE).catch(function () {}) : Promise.resolve(); }
    catch (e) { return Promise.resolve(); }
  }
  function abrirCache() {
    try { return window.caches ? caches.open(CACHE).catch(function () { return null; }) : Promise.resolve(null); }
    catch (e) { return Promise.resolve(null); }
  }
  function textoDe(blob, gz) {
    if (!gz) return blob.text();
    if (typeof DecompressionStream === 'undefined') throw new Error('Navegador sem suporte a .gz — envie o CSV sem compactar.');
    return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  function baixarArquivo(nome) {
    return authPronto.then(listarVersoes).then(function (vs) {
      var gz = (nome + '.gz') in vs;
      var real = gz ? nome + '.gz' : nome;
      if (!(real in vs)) return Promise.reject(new Error('Arquivo não encontrado no Storage: ' + nome));
      var chave = 'https://cache.local/' + encodeURIComponent(real) + '?v=' + encodeURIComponent(vs[real]);
      return abrirCache().then(function (c) {
        return (c ? c.match(chave) : Promise.resolve(null)).then(function (hit) {
          if (hit) return hit.text();
          return sb.storage.from(BUCKET).download(real).then(function (r) {
            if (r.error) throw r.error;
            return textoDe(r.data, gz);
          }).then(function (txt) {
            if (c) {
              // guarda só a versão atual de cada arquivo
              c.keys().then(function (ks) {
                ks.forEach(function (k) { if (k.url.indexOf('https://cache.local/' + encodeURIComponent(real) + '?') === 0) c.delete(k); });
                c.put(chave, new Response(txt, { headers: { 'content-type': 'text/csv; charset=utf-8' } }));
              }).catch(function () {});
            }
            return txt;
          });
        });
      });
    });
  }
  var fetchOriginal = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var m = /^(?:\.\/)?dados\/(.+)$/.exec(url);
    if (!m) return fetchOriginal(input, init);
    return baixarArquivo(decodeURIComponent(m[1])).then(function (txt) {
      return new Response(txt, { status: 200, headers: { 'content-type': 'text/csv; charset=utf-8' } });
    });
  };

  /* ---------------------------------------------------------------- banco (db) */
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function novoId() { var s = ''; var a = 'abcdefghijklmnopqrstuvwxyz0123456789'; var r = new Uint8Array(20); crypto.getRandomValues(r); for (var i = 0; i < 20; i++) s += a[r[i] % 36]; return s; }

  var COLS = {}; // nome → { docs: Map, ordem: [], carregada: Promise, ouvintes: Set, timer }
  function col(nome) {
    if (!COLS[nome]) COLS[nome] = { docs: new Map(), carregada: null, ouvintes: new Set(), timer: null };
    return COLS[nome];
  }
  function carregar(nome) {
    var c = col(nome);
    if (!c.carregada) c.carregada = recarregar(nome);
    return c.carregada;
  }
  function recarregar(nome) {
    var c = col(nome), PAG = 1000;
    function pagina(i, acc) {
      return sb.from('docs').select('id,data').eq('colecao', nome).order('id').range(i, i + PAG - 1).then(function (r) {
        if (r.error) throw r.error;
        acc = acc.concat(r.data || []);
        return (r.data || []).length === PAG ? pagina(i + PAG, acc) : acc;
      });
    }
    return authPronto.then(function () { return pagina(0, []); }).then(function (linhas) {
      c.docs = new Map(linhas.map(function (l) { return [l.id, l.data]; }));
      avisar(nome, true);
    });
  }
  function avisar(nome, ja) {
    var c = col(nome);
    if (c.timer) return;
    c.timer = setTimeout(function () { c.timer = null; c.ouvintes.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }, ja ? 0 : 40);
  }

  // Realtime: uma única assinatura para a tabela inteira
  var canal = null, conectadoAntes = false;
  function ligarRealtime() {
    if (canal) return;
    canal = sb.channel('docs-' + novoId())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, function (p) {
        var n = p.new && p.new.colecao ? p.new : null, o = p.old || {};
        var nome = (n && n.colecao) || o.colecao; if (!nome || !COLS[nome]) return;
        var c = COLS[nome];
        if (p.eventType === 'DELETE') c.docs.delete(o.id); else c.docs.set(n.id, n.data);
        avisar(nome);
      })
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          // ao reconectar, recarrega o que estava aberto para não perder alterações
          if (conectadoAntes) Object.keys(COLS).forEach(function (k) { if (COLS[k].carregada) COLS[k].carregada = recarregar(k); });
          conectadoAntes = true;
        }
      });
  }

  function gravar(nome, id, dados) {
    var c = col(nome), antes = c.docs.has(id) ? c.docs.get(id) : undefined;
    dados = clone(dados);
    c.docs.set(id, dados); avisar(nome);           // otimista
    return authPronto.then(function () {
      return sb.from('docs').upsert({ colecao: nome, id: id, data: dados }, { onConflict: 'colecao,id' });
    }).then(function (r) {
      if (r.error) {
        if (antes === undefined) c.docs.delete(id); else c.docs.set(id, antes);
        avisar(nome);
        var e = new Error(/row-level security|permission/i.test(r.error.message) ? 'Sem permissão para gravar aqui.' : r.error.message);
        e.code = /row-level security|permission/i.test(r.error.message) ? 'forbidden' : 'error';
        throw e;
      }
    });
  }

  function DocRef(nome, id) { this.colecao = nome; this.id = id; }
  DocRef.prototype.set = function (obj) { return gravar(this.colecao, this.id, obj); };
  DocRef.prototype.update = function (obj) {
    var atual = col(this.colecao).docs.get(this.id) || {};
    return gravar(this.colecao, this.id, Object.assign(clone(atual), obj));
  };
  DocRef.prototype.get = function () {
    var self = this;
    return carregar(self.colecao).then(function () { return snapDoc(self.colecao, self.id); });
  };
  function snapDoc(nome, id) {
    var d = col(nome).docs.get(id);
    return { id: id, exists: d !== undefined, data: function () { return clone(d); } };
  }
  DocRef.prototype.onSnapshot = function (cb, erro) {
    var nome = this.colecao, id = this.id, c = col(nome);
    var f = function () { cb(snapDoc(nome, id)); };
    c.ouvintes.add(f); ligarRealtime();
    carregar(nome).then(function () { f(); }, function (e) { if (erro) erro(e); else console.error(e); });
    return function () { c.ouvintes.delete(f); };
  };

  function Query(nome, campo, dir, lim) { this.colecao = nome; this.campo = campo; this.dir = dir; this.lim = lim; }
  Query.prototype.doc = function (id) { return new DocRef(this.colecao, id == null ? novoId() : String(id)); };
  Query.prototype.add = function (obj) { var id = novoId(); return gravar(this.colecao, id, obj).then(function () { return { id: id }; }); };
  Query.prototype.orderBy = function (campo, dir) { return new Query(this.colecao, campo, dir || 'asc', this.lim); };
  Query.prototype.limit = function (n) { return new Query(this.colecao, this.campo, this.dir, n); };
  Query.prototype._snap = function () {
    var arr = []; col(this.colecao).docs.forEach(function (d, id) { arr.push({ id: id, d: d }); });
    if (this.campo) {
      var k = this.campo, s = this.dir === 'desc' ? -1 : 1;
      arr.sort(function (a, b) { var x = a.d && a.d[k], y = b.d && b.d[k]; return (x === y ? 0 : x == null ? -1 : y == null ? 1 : x < y ? -1 : 1) * s; });
    }
    if (this.lim) arr = arr.slice(0, this.lim);
    var docs = arr.map(function (o) { return { id: o.id, exists: true, data: function () { return clone(o.d); } }; });
    return { docs: docs, size: docs.length, empty: !docs.length, forEach: function (f) { docs.forEach(f); } };
  };
  Query.prototype.get = function () { var q = this; return carregar(q.colecao).then(function () { return q._snap(); }); };
  Query.prototype.onSnapshot = function (cb, erro) {
    var q = this, c = col(q.colecao);
    var f = function () { cb(q._snap()); };
    c.ouvintes.add(f); ligarRealtime();
    carregar(q.colecao).then(function () { f(); }, function (e) { if (erro) erro(e); else console.error(e); });
    return function () { c.ouvintes.delete(f); };
  };

  function caminho(p) {
    var s = String(p).split('/').filter(Boolean);
    return { colecao: s.slice(0, -1).join('/'), id: s[s.length - 1] };
  }
  var DB = {
    collection: function (nome) { return new Query(String(nome)); },
    doc: function (p) { var c = caminho(p); return new DocRef(c.colecao, c.id); }
  };

  /* ---------------------------------------------------------------- usuário */
  var CORES = ['#E52329', '#1F4E79', '#2E7D4F', '#C9821A', '#6A4C93', '#00838F', '#AD1457', '#5D4037'];
  function avatar(nome) {
    nome = (nome || '?').trim();
    var p = nome.split(/\s+/), ini = ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
    var h = 0; for (var i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="32" fill="' + CORES[h % CORES.length] +
      '"/><text x="32" y="41" font-family="Arial,sans-serif" font-size="25" font-weight="700" fill="#fff" text-anchor="middle">' + ini.replace(/[<&>]/g, '') + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function pessoa(l) { return { id: l.id, name: l.nome || l.email, avatarUrl: avatar(l.nome || l.email) }; }
  var USER = {
    id: function () { return authPronto.then(function () { return SESSAO.user.id; }); },
    isOwner: function () { return authPronto.then(function () { return !!ACESSO.admin; }); },
    can: function () { return authPronto.then(function () { return !!ACESSO.ativo; }); },
    me: function () { return authPronto.then(function () { var n = ACESSO.nome || ACESSO.email; return { id: SESSAO.user.id, name: n, avatarUrl: avatar(n) }; }); },
    profiles: function (ids) {
      return authPronto.then(function () {
        return sb.from('pessoas').select('id,nome,email').in('id', ids);
      }).then(function (r) {
        var m = {}; (r.data || []).forEach(function (l) { m[l.id] = pessoa(l); }); return m;
      });
    },
    search: function (q) {
      q = String(q || '').replace(/[%,()]/g, ' ').trim();
      return authPronto.then(function () {
        var s = sb.from('pessoas').select('id,nome,email').eq('ativo', true).order('nome').limit(10);
        if (q) s = s.or('nome.ilike.%' + q + '%,email.ilike.%' + q + '%');
        return s;
      }).then(function (r) { return (r.data || []).map(pessoa); });
    }
  };

  /* ---------------------------------------------------------------- downloads */
  var DOWNLOADS = {
    save: function (o) {
      var data = o && o.data;
      var blob = data instanceof Blob ? data : new Blob([data], { type: (o && o.mimeType) || 'application/octet-stream' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = (o && o.filename) || 'arquivo';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      return Promise.resolve({ ok: true });
    }
  };

  window.claude = {
    use: function (nome) {
      if (nome === 'db') return authPronto.then(function () { return DB; });
      if (nome === 'user') return authPronto.then(function () { return USER; });
      if (nome === 'downloads') return Promise.resolve(DOWNLOADS);
      return Promise.reject(Object.assign(new Error('Recurso indisponível: ' + nome), { code: 'unavailable' }));
    }
  };
})();
