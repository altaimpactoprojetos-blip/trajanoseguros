/* Trajano Seguros — painel de cotações (login Supabase Auth).
   O acesso é garantido no banco: só e-mails em trajano_cotacoes_admins leem e alteram as cotações. */
(function () {
  "use strict";

  var C = window.TRAJANO || {};
  var sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey);
  var $ = function (id) { return document.getElementById(id); };

  var STATUS = { nova: "Nova", em_atendimento: "Em atendimento", proposta_enviada: "Proposta enviada", fechada: "Fechada", arquivada: "Arquivada" };
  var ROTULOS = { veiculo: "Veículo", ano: "Ano", uso: "Uso", cep: "CEP", imovel: "Imóvel", ocupacao: "Ocupação", cidade: "Cidade", idade: "Idade", profissao: "Profissão", atividade: "Atividade" };
  var cotacoes = [];

  Object.keys(STATUS).forEach(function (k) { $("filtro-status").add(new Option(STATUS[k], k)); });

  function tela(nome) {
    ["tela-login", "tela-lista", "tela-sem-acesso"].forEach(function (id) { $(id).hidden = id !== nome; });
    $("sair").hidden = nome === "tela-login";
  }
  function formatarTelefone(t) {
    return t.length === 11 ? "(" + t.slice(0, 2) + ") " + t.slice(2, 7) + "-" + t.slice(7)
         : "(" + t.slice(0, 2) + ") " + t.slice(2, 6) + "-" + t.slice(6);
  }
  function formatarData(iso) {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  async function iniciar() {
    var sessao = (await sb.auth.getSession()).data.session;
    if (!sessao) { tela("tela-login"); return; }
    var adm = await sb.rpc("trajano_eh_admin");
    if (adm.error || !adm.data) { tela("tela-sem-acesso"); return; }
    tela("tela-lista");
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
  $("sair").addEventListener("click", async function () { await sb.auth.signOut(); cotacoes = []; $("lista").textContent = ""; tela("tela-login"); });

  async function carregar() {
    $("lista-erro").textContent = "";
    var r = await sb.from("trajano_cotacoes")
      .select("id, protocolo, tipo, nome, telefone, cpf, email, detalhes, observacoes, status, notas_internas, criado_em")
      .order("criado_em", { ascending: false }).limit(1000);
    if (r.error) { $("lista-erro").textContent = "Não foi possível carregar: " + r.error.message; return; }
    cotacoes = r.data || [];
    renderizar();
  }

  function filtradas() {
    var busca = $("busca").value.trim().toLowerCase(), buscaDig = busca.replace(/\D/g, "");
    var st = $("filtro-status").value, tp = $("filtro-tipo").value;
    return cotacoes.filter(function (c) {
      if (st && c.status !== st) return false;
      if (tp && c.tipo !== tp) return false;
      if (!busca) return true;
      return c.nome.toLowerCase().indexOf(busca) >= 0 || (buscaDig && (c.telefone.indexOf(buscaDig) >= 0 || String(c.protocolo) === buscaDig));
    });
  }

  function renderizar() {
    var lista = $("lista"), tpl = $("tpl-cotacao"), itens = filtradas();
    lista.textContent = "";
    var novas = cotacoes.filter(function (c) { return c.status === "nova"; }).length;
    $("resumo").textContent = cotacoes.length + " solicitações · " + novas + " novas" + (itens.length !== cotacoes.length ? " · " + itens.length + " no filtro" : "");
    itens.forEach(function (c) {
      var li = tpl.content.firstElementChild.cloneNode(true);
      li.dataset.status = c.status;
      li.querySelector(".cot-proto").textContent = "Nº " + c.protocolo;
      li.querySelector(".cot-tipo").textContent = c.tipo;
      var t = li.querySelector(".cot-data"); t.dateTime = c.criado_em; t.textContent = formatarData(c.criado_em);
      li.querySelector(".cot-nome").textContent = c.nome;
      var tel = li.querySelector(".cot-tel");
      tel.textContent = formatarTelefone(c.telefone);
      tel.href = "https://wa.me/55" + c.telefone + "?text=" + encodeURIComponent("Olá, " + c.nome.split(" ")[0] + "! Aqui é o Ronay, da Trajano Seguros. Recebi sua solicitação de cotação de Seguro " + c.tipo + " (protocolo nº " + c.protocolo + ").");
      var cpf = li.querySelector(".cot-cpf");
      if (c.cpf) cpf.textContent = "CPF " + c.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"); else cpf.remove();
      var em = li.querySelector(".cot-email");
      if (c.email) { em.textContent = c.email; em.href = "mailto:" + c.email; } else em.remove();
      var dl = li.querySelector(".cot-detalhes");
      Object.keys(c.detalhes || {}).forEach(function (k) {
        var d = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
        dt.textContent = ROTULOS[k] || k; dd.textContent = c.detalhes[k];
        d.append(dt, dd); dl.appendChild(d);
      });
      li.querySelector(".cot-obs").textContent = c.observacoes || "";
      var sel = li.querySelector(".cot-status");
      Object.keys(STATUS).forEach(function (k) { sel.add(new Option(STATUS[k], k, false, k === c.status)); });
      var notas = li.querySelector(".cot-notas"); notas.value = c.notas_internas || "";
      var salvar = li.querySelector(".cot-salvar");
      salvar.addEventListener("click", async function () {
        salvar.disabled = true; salvar.textContent = "Salvando…";
        var r = await sb.from("trajano_cotacoes").update({ status: sel.value, notas_internas: notas.value.trim() || null }).eq("id", c.id).select("status, notas_internas");
        salvar.disabled = false;
        if (r.error || !r.data || !r.data.length) { salvar.textContent = "Erro ao salvar"; return; }
        c.status = r.data[0].status; c.notas_internas = r.data[0].notas_internas; li.dataset.status = c.status;
        salvar.textContent = "Salvo";
        setTimeout(function () { salvar.textContent = "Salvar"; }, 1600);
      });
      lista.appendChild(li);
    });
  }

  ["busca", "filtro-status", "filtro-tipo"].forEach(function (id) { $(id).addEventListener("input", renderizar); });
  $("atualizar").addEventListener("click", carregar);

  $("csv").addEventListener("click", function () {
    var cols = ["protocolo", "criado_em", "tipo", "status", "nome", "telefone", "cpf", "email", "detalhes", "observacoes", "notas_internas"];
    var esc = function (v) {
      var s = v == null ? "" : (typeof v === "object" ? Object.keys(v).map(function (k) { return (ROTULOS[k] || k) + ": " + v[k]; }).join(" | ") : String(v));
      if (/^[=+\-@]/.test(s)) s = "'" + s; // evita fórmulas ao abrir no Excel
      return '"' + s.replace(/"/g, '""') + '"';
    };
    var linhas = [cols.join(";")].concat(filtradas().map(function (c) { return cols.map(function (k) { return esc(c[k]); }).join(";"); }));
    var blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cotacoes-trajano-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  iniciar();
})();
