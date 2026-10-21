/* Trajano Seguros — painel de cotações (login Supabase Auth).
   O acesso é garantido no banco: só e-mails em trajano_cotacoes_admins leem, alteram e excluem as cotações. */
(function () {
  "use strict";

  var C = window.TRAJANO || {};
  var sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);
  var $ = function (id) { return document.getElementById(id); };

  var STATUS = { nova: "Nova", em_atendimento: "Em andamento", proposta_enviada: "Proposta enviada", fechada: "Fechada", perdida: "Perdida", arquivada: "Arquivada" };
  // Campos de cada tipo de seguro, na ordem em que aparecem no card ("—" quando não preenchidos)
  var CAMPOS = {
    Auto: [["veiculo", "Veículo"], ["ano", "Ano"], ["uso", "Uso"], ["cep", "CEP de pernoite"], ["tem_seguro", "Já tem seguro"]],
    Residencial: [["imovel", "Tipo de imóvel"], ["ocupacao", "O imóvel é"], ["cidade", "Cidade"]],
    Vida: [["idade", "Idade"], ["profissao", "Profissão"]],
    Empresarial: [["atividade", "Ramo de atividade"], ["cidade", "Cidade"]]
  };
  var ROTULOS = {};
  Object.keys(CAMPOS).forEach(function (t) { CAMPOS[t].forEach(function (c) { ROTULOS[c[0]] = c[1]; }); });

  var cotacoes = [];
  var SESSAO_MAX = 30 * 60 * 1000; // encerra após 30 min sem atividade
  var timerSessao = null, toastTimer = null, aguardandoExclusao = null;

  /* ===== Utilidades ===== */
  function tela(nome) {
    ["tela-login", "tela-lista", "tela-sem-acesso"].forEach(function (id) { $(id).hidden = id !== nome; });
    $("sair").hidden = nome === "tela-login";
  }
  function formatarTelefone(t) {
    return t.length === 11 ? "(" + t.slice(0, 2) + ") " + t.slice(2, 7) + "-" + t.slice(7)
         : "(" + t.slice(0, 2) + ") " + t.slice(2, 6) + "-" + t.slice(6);
  }
  function formatarCpf(c) { return c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"); }
  function cpfMascarado(c) { return "•••.•••.•••-" + c.slice(-2); }
  function dataCompleta(iso) {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function dataRelativa(iso) {
    var d = new Date(iso), agora = new Date(), s = Math.round((agora - d) / 1000);
    if (s < 60) return "agora há pouco";
    var m = Math.round(s / 60); if (m < 60) return "há " + m + (m === 1 ? " minuto" : " minutos");
    var h = Math.floor(m / 60); if (h < 24) return "há " + h + (h === 1 ? " hora" : " horas");
    var ontem = new Date(agora); ontem.setDate(agora.getDate() - 1);
    if (d.toDateString() === ontem.toDateString()) return "ontem";
    var dias = Math.round((new Date(agora).setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    if (dias < 30) return "há " + dias + " dias";
    var meses = Math.round(dias / 30); if (meses < 12) return "há " + meses + (meses === 1 ? " mês" : " meses");
    var anos = Math.round(meses / 12); return "há " + anos + (anos === 1 ? " ano" : " anos");
  }
  function toast(msg, erro) {
    var t = $("toast");
    t.textContent = msg; t.classList.toggle("erro", !!erro); t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, erro ? 4000 : 2000);
  }
  function copiar(texto, rotulo) {
    navigator.clipboard.writeText(texto).then(function () { toast(rotulo + " copiado"); })
      .catch(function () { toast("Não foi possível copiar", true); });
  }
  function mensagemWhatsApp(c) {
    return "Olá, " + c.nome.split(" ")[0] + "! Aqui é o Ronay, da Trajano Seguros. Recebi sua solicitação de cotação de seguro " + c.tipo + " (protocolo nº " + c.protocolo + "). Podemos conversar?";
  }

  /* ===== Sessão: expira após 30 min sem atividade ===== */
  function renovarSessao() {
    clearTimeout(timerSessao);
    timerSessao = setTimeout(async function () {
      await sb.auth.signOut();
      cotacoes = []; $("lista").textContent = ""; tela("tela-login");
      $("l-erro").textContent = "Sessão encerrada por inatividade. Entre novamente.";
    }, SESSAO_MAX);
  }
  ["click", "keydown", "scroll", "touchstart", "mousemove"].forEach(function (ev) {
    document.addEventListener(ev, function () { if (!$("tela-lista").hidden) renovarSessao(); }, { passive: true });
  });

  /* ===== Login ===== */
  async function iniciar() {
    var sessao = (await sb.auth.getSession()).data.session;
    if (!sessao) { tela("tela-login"); return; }
    var adm = await sb.rpc("trajano_eh_admin");
    if (adm.error || !adm.data) { tela("tela-sem-acesso"); return; }
    tela("tela-lista");
    renovarSessao();
    carregar();
  }
  $("form-login").addEventListener("submit", async function (e) {
    e.preventDefault();
    var botao = $("l-botao");
    botao.disabled = true; botao.textContent = "Entrando…"; $("l-erro").textContent = "";
    var r = await sb.auth.signInWithPassword({ email: $("l-email").value.trim(), password: $("l-senha").value });
    botao.disabled = false; botao.textContent = "Entrar";
    if (r.error) { $("l-erro").textContent = "E-mail ou senha incorretos."; return; }
    $("l-senha").value = "";
    iniciar();
  });
  $("sair").addEventListener("click", async function () {
    clearTimeout(timerSessao);
    await sb.auth.signOut(); cotacoes = []; $("lista").textContent = ""; tela("tela-login");
  });

  /* ===== Dados ===== */
  async function carregar() {
    $("lista-erro").textContent = "";
    var r = await sb.from("trajano_cotacoes")
      .select("id, protocolo, tipo, nome, telefone, cpf, email, detalhes, observacoes, status, notas_internas, criado_em")
      .order("criado_em", { ascending: false }).limit(1000);
    if (r.error) { $("lista-erro").textContent = "Não foi possível carregar: " + r.error.message; return; }
    cotacoes = r.data || [];
    renderizar();
  }
  async function salvar(c, campos, li) {
    var r = await sb.from("trajano_cotacoes").update(campos).eq("id", c.id).select("status, notas_internas");
    if (r.error || !r.data || !r.data.length) { toast("Erro ao salvar", true); return false; }
    c.status = r.data[0].status; c.notas_internas = r.data[0].notas_internas;
    if (li) {
      li.dataset.status = c.status;
      var b = li.querySelector(".cot-status-badge"); b.textContent = STATUS[c.status]; b.className = "badge cot-status-badge badge-" + c.status;
      li.querySelector(".cot-status").value = c.status;
    }
    atualizarChips();
    toast("Salvo");
    return true;
  }
  async function excluir(c) {
    var r = await sb.from("trajano_cotacoes").delete().eq("id", c.id).select("id");
    if (r.error || !r.data || !r.data.length) { toast("Erro ao excluir", true); return; }
    cotacoes = cotacoes.filter(function (x) { return x.id !== c.id; });
    renderizar();
    toast("Solicitação excluída");
  }

  /* ===== Filtros ===== */
  function filtradas() {
    var busca = $("busca").value.trim().toLowerCase(), buscaDig = busca.replace(/\D/g, "");
    var st = $("filtro-status").value, tp = $("filtro-tipo").value;
    var lista = cotacoes.filter(function (c) {
      if (st && c.status !== st) return false;
      if (tp && c.tipo !== tp) return false;
      if (!busca) return true;
      return c.nome.toLowerCase().indexOf(busca) >= 0 || (buscaDig && (c.telefone.indexOf(buscaDig) >= 0 || String(c.protocolo) === buscaDig));
    });
    if ($("ordem").value === "antigas") lista = lista.slice().reverse();
    return lista;
  }
  function atualizarChips() {
    var chips = $("chips"), atual = $("filtro-status").value;
    chips.textContent = "";
    [["", "Todas"]].concat(Object.keys(STATUS).map(function (k) { return [k, STATUS[k]]; })).forEach(function (par) {
      var k = par[0], n = k ? cotacoes.filter(function (c) { return c.status === k; }).length : cotacoes.length;
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.setAttribute("aria-pressed", String(atual === k));
      b.append(par[1] + " "); var cnt = document.createElement("b"); cnt.textContent = n; b.appendChild(cnt);
      b.addEventListener("click", function () { $("filtro-status").value = k; renderizar(); });
      chips.appendChild(b);
    });
  }

  /* ===== Cards ===== */
  function dd(texto) {
    var el = document.createElement("dd");
    if (texto) el.textContent = texto; else { el.textContent = "—"; el.className = "vazio"; }
    return el;
  }
  function renderizar() {
    var lista = $("lista"), tpl = $("tpl-cotacao"), itens = filtradas();
    atualizarChips();
    lista.textContent = "";
    $("vazio").hidden = itens.length > 0;
    itens.forEach(function (c) {
      var li = tpl.content.firstElementChild.cloneNode(true);
      li.dataset.status = c.status;
      li.querySelector(".cot-proto").textContent = "Nº " + c.protocolo;
      li.querySelector(".cot-tipo").textContent = c.tipo;
      var badge = li.querySelector(".cot-status-badge"); badge.textContent = STATUS[c.status]; badge.classList.add("badge-" + c.status);
      var t = li.querySelector(".cot-data"); t.dateTime = c.criado_em; t.textContent = dataRelativa(c.criado_em); t.title = dataCompleta(c.criado_em);
      li.querySelector(".cot-nome").textContent = c.nome;
      var telFmt = formatarTelefone(c.telefone);
      var tel = li.querySelector(".cot-tel"); tel.textContent = telFmt; tel.href = "tel:+55" + c.telefone;

      // WhatsApp: abre a conversa e, se for "Nova", passa para "Em andamento"
      var wa = li.querySelector(".cot-wa");
      wa.href = "https://wa.me/55" + c.telefone + "?text=" + encodeURIComponent(mensagemWhatsApp(c));
      wa.addEventListener("click", function () { if (c.status === "nova") salvar(c, { status: "em_atendimento" }, li); });

      // Expandir / recolher
      var area = li.querySelector(".cot-detalhes-area"), toggle = li.querySelector(".cot-toggle");
      toggle.addEventListener("click", function () {
        var abrir = area.hidden; area.hidden = !abrir;
        toggle.setAttribute("aria-expanded", String(abrir));
        toggle.firstChild.textContent = abrir ? "Ocultar detalhes " : "Ver detalhes ";
      });

      // Dados do seguro (todos os campos do tipo, "—" quando vazio)
      var dl = li.querySelector(".cot-detalhes"), det = c.detalhes || {};
      (CAMPOS[c.tipo] || Object.keys(det).map(function (k) { return [k, ROTULOS[k] || k]; })).forEach(function (par) {
        var d = document.createElement("div"), dt = document.createElement("dt");
        dt.textContent = par[1]; d.append(dt, dd(det[par[0]])); dl.appendChild(d);
      });

      // Contato
      li.querySelector(".cot-tel-txt").textContent = telFmt;
      li.querySelector(".cot-copiar-tel").addEventListener("click", function () { copiar(telFmt, "Telefone"); });
      var em = li.querySelector(".cot-email"), copEm = li.querySelector(".cot-copiar-email");
      if (c.email) { em.textContent = c.email; em.href = "mailto:" + c.email; copEm.hidden = false; copEm.addEventListener("click", function () { copiar(c.email, "E-mail"); }); }
      else { em.replaceWith(dd("")); }
      var cpfEl = li.querySelector(".cot-cpf"), rev = li.querySelector(".cot-revelar"), copCpf = li.querySelector(".cot-copiar-cpf");
      if (c.cpf) {
        cpfEl.textContent = cpfMascarado(c.cpf); rev.hidden = false; copCpf.hidden = false;
        rev.addEventListener("click", function () {
          var mostrando = rev.textContent === "Ocultar";
          cpfEl.textContent = mostrando ? cpfMascarado(c.cpf) : formatarCpf(c.cpf); rev.textContent = mostrando ? "Revelar" : "Ocultar";
        });
        copCpf.addEventListener("click", function () { copiar(formatarCpf(c.cpf), "CPF"); });
      } else { cpfEl.replaceWith(dd("")); }

      // Mensagem
      var obs = li.querySelector(".cot-obs");
      if (c.observacoes) obs.textContent = c.observacoes; else { obs.textContent = "—"; obs.classList.add("vazio"); }

      // Status (salva ao mudar), notas (salvam ao sair do campo) e exclusão
      var sel = li.querySelector(".cot-status");
      Object.keys(STATUS).forEach(function (k) { sel.add(new Option(STATUS[k], k, false, k === c.status)); });
      sel.addEventListener("change", function () { salvar(c, { status: sel.value }, li); });
      var notas = li.querySelector(".cot-notas"); notas.value = c.notas_internas || "";
      notas.addEventListener("blur", function () {
        var v = notas.value.trim() || null;
        if (v !== (c.notas_internas || null)) salvar(c, { notas_internas: v }, li);
      });
      li.querySelector(".cot-salvar").addEventListener("click", function () {
        salvar(c, { status: sel.value, notas_internas: notas.value.trim() || null }, li);
      });
      li.querySelector(".cot-excluir").addEventListener("click", function () { aguardandoExclusao = c; $("modal").hidden = false; $("modal-cancelar").focus(); });

      lista.appendChild(li);
    });
  }

  /* ===== Modal de exclusão ===== */
  function fecharModal() { $("modal").hidden = true; aguardandoExclusao = null; }
  $("modal-cancelar").addEventListener("click", fecharModal);
  $("modal").addEventListener("click", function (e) { if (e.target === $("modal")) fecharModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("modal").hidden) fecharModal(); });
  $("modal-excluir").addEventListener("click", async function () {
    var c = aguardandoExclusao; fecharModal();
    if (c) await excluir(c);
  });

  /* ===== Filtros, ordenação, atualizar, CSV ===== */
  ["busca", "filtro-status", "filtro-tipo", "ordem"].forEach(function (id) { $(id).addEventListener("input", renderizar); });
  Object.keys(STATUS).forEach(function (k) { $("filtro-status").add(new Option(STATUS[k], k)); });
  $("atualizar").addEventListener("click", carregar);

  $("csv").addEventListener("click", function () {
    var cols = ["protocolo", "criado_em", "tipo", "status", "nome", "telefone", "cpf", "email", "detalhes", "observacoes", "notas_internas"];
    var esc = function (v, k) {
      var s;
      if (k === "status") s = STATUS[v] || v;
      else if (k === "detalhes") s = Object.keys(v || {}).map(function (x) { return (ROTULOS[x] || x) + ": " + v[x]; }).join(" | ");
      else if (k === "criado_em") s = dataCompleta(v);
      else s = v == null ? "" : String(v);
      if (/^[=+\-@]/.test(s)) s = "'" + s; // evita fórmulas ao abrir no Excel
      return '"' + s.replace(/"/g, '""') + '"';
    };
    var linhas = [cols.join(";")].concat(filtradas().map(function (c) { return cols.map(function (k) { return esc(c[k], k); }).join(";"); }));
    var blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cotacoes-trajano-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  iniciar();
})();
