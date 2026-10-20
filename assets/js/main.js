/* Trajano Seguros — comportamento do site
   Dados oficiais (WhatsApp, e-mail, CNPJ…) ficam em assets/js/config.js */
(function () {
  "use strict";

  var C = window.TRAJANO || {};
  var digitos = function (s) { return String(s || "").replace(/\D/g, ""); };
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

  /* ===== Erros inesperados: registra no console (ponto único para plugar um monitor) ===== */
  function reportarErro(origem, erro) {
    console.error("[Trajano Seguros]", origem, erro);
    if (typeof C.onErro === "function") { try { C.onErro(origem, erro); } catch (e) { /* ignora */ } }
  }
  window.addEventListener("error", function (e) { reportarErro("erro", e.error || e.message); });
  window.addEventListener("unhandledrejection", function (e) { reportarErro("promessa", e.reason); });

  /* ===== Dados oficiais: mostra só o que estiver preenchido em config.js ===== */
  $$("[data-show]").forEach(function (el) { el.hidden = !C[el.dataset.show]; });
  $$("[data-info]").forEach(function (el) {
    var v = C[el.dataset.info];
    if (!v) return;
    el.textContent = (el.dataset.prefix || "") + v;
    el.hidden = false;
  });
  $$("[data-mailto]").forEach(function (a) { if (C.email) a.href = "mailto:" + C.email; });
  $$("[data-instagram]").forEach(function (a) {
    if (!C.instagram) return;
    a.href = "https://instagram.com/" + C.instagram;
    a.textContent = "@" + C.instagram;
  });
  var ano = $("#ano");
  if (ano) ano.textContent = new Date().getFullYear();

  /* ===== WhatsApp com mensagem contextual ===== */
  var temWhatsApp = digitos(C.whatsapp).length >= 12;
  var interesse = "";
  function linkWhatsApp(texto) {
    return "https://wa.me/" + digitos(C.whatsapp) + "?text=" + encodeURIComponent(texto);
  }
  function mensagemPadrao() {
    return interesse
      ? "Olá, Ronay! Vim pelo site da Trajano Seguros e gostaria de falar sobre Seguro " + interesse + "."
      : "Olá, Ronay! Vim pelo site da Trajano Seguros e gostaria de falar com um especialista sobre seguros.";
  }
  function atualizarLinksWhatsApp() {
    $$("[data-wa]").forEach(function (a) {
      if (!temWhatsApp) {
        // Sem número oficial configurado: os botões levam ao formulário e os atalhos somem
        if (a.dataset.wa === "produto" || a.dataset.wa === "flutuante") a.hidden = true;
        return;
      }
      var texto = a.dataset.wa === "produto"
        ? "Olá, Ronay! Vim pelo site da Trajano Seguros e quero uma cotação de Seguro " + a.dataset.tipo + "."
        : mensagemPadrao();
      a.href = linkWhatsApp(texto);
      a.target = "_blank";
      a.rel = "noopener";
      if (a.dataset.wa === "flutuante") a.hidden = false;
    });
  }
  atualizarLinksWhatsApp();

  /* ===== Cabeçalho: compacto ao rolar e menu do celular ===== */
  var header = $(".header"), menu = $("#menu"), menuBtn = $(".menu-btn");
  function aoRolar() { header.classList.toggle("is-scrolled", window.scrollY > 12); }
  aoRolar();
  window.addEventListener("scroll", aoRolar, { passive: true });

  function abrirMenu(abrir) {
    menu.classList.toggle("is-open", abrir);
    menuBtn.setAttribute("aria-expanded", String(abrir));
    menuBtn.setAttribute("aria-label", abrir ? "Fechar menu" : "Abrir menu");
  }
  menuBtn.addEventListener("click", function () { abrirMenu(!menu.classList.contains("is-open")); });
  $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { abrirMenu(false); }); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && menu.classList.contains("is-open")) { abrirMenu(false); menuBtn.focus(); }
  });
  document.addEventListener("click", function (e) {
    if (menu.classList.contains("is-open") && !header.contains(e.target)) abrirMenu(false);
  });
  window.matchMedia("(min-width: 961px)").addEventListener("change", function (m) { if (m.matches) abrirMenu(false); });

  // Destaca no menu a seção visível
  if ("IntersectionObserver" in window) {
    var linksMenu = $$('a[href^="#"]', menu).filter(function (a) { return !a.classList.contains("btn"); });
    var secoes = linksMenu.map(function (a) { return $(a.getAttribute("href")); }).filter(Boolean);
    var obsSecao = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (!en.isIntersecting) return;
        linksMenu.forEach(function (a) {
          if (a.getAttribute("href") === "#" + en.target.id) a.setAttribute("aria-current", "true");
          else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    secoes.forEach(function (s) { obsSecao.observe(s); });
  }

  /* ===== Formulário de cotação ===== */
  var form = $("#quote-form");
  if (!form) return;
  var ok = $("#quote-ok"), erroGeral = $("#f-erro"), botao = $("#f-enviar"), rotulo = $(".btn-label", botao);
  var enviando = false, tentouEnviar = false;

  function tipoAtual() { var r = $('input[name="tipo"]:checked', form); return r ? r.value : "Auto"; }

  function setTipo(tipo) {
    $$("[data-grupo]", form).forEach(function (g) {
      var ativo = g.dataset.grupo === tipo;
      g.hidden = !ativo;
      $$("input, select, textarea", g).forEach(function (c) { c.disabled = !ativo; });
    });
    interesse = tipo;
    atualizarLinksWhatsApp();
  }
  $$('input[name="tipo"]', form).forEach(function (r) {
    r.addEventListener("change", function () { setTipo(r.value); });
  });
  // Botões "Solicitar cotação" dos produtos e do rodapé já escolhem o seguro no formulário
  $$("[data-tipo]").forEach(function (a) {
    a.addEventListener("click", function () {
      var r = $('input[name="tipo"][value="' + a.dataset.tipo + '"]', form);
      if (r) { r.checked = true; setTipo(r.value); }
      if (a.dataset.wa !== "produto" && !ok.hidden) novaSolicitacao();
    });
  });
  setTipo(tipoAtual());

  // Máscaras
  function mascaraTelefone(v) {
    var d = digitos(v);
    if (d.length > 11 && d.indexOf("55") === 0) d = d.slice(2);
    d = d.slice(0, 11);
    if (d.length <= 2) return d.length ? "(" + d : "";
    if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }
  function mascaraCep(v) { var d = digitos(v).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d; }
  function aplicarMascara(el, fn) {
    el.addEventListener("input", function () { el.value = fn(el.value); });
  }
  aplicarMascara($("#f-tel"), mascaraTelefone);
  aplicarMascara($("#f-cep"), mascaraCep);
  aplicarMascara($("#f-ano"), function (v) { return digitos(v).slice(0, 4); });
  aplicarMascara($("#f-idade"), function (v) { return digitos(v).slice(0, 3); });

  // Validação (a mesma regra é conferida de novo no servidor)
  var anoMax = new Date().getFullYear() + 1;
  var regras = {
    nome: function (v) { return v.trim().replace(/\s+/g, " ").length >= 3 ? "" : "Informe seu nome."; },
    telefone: function (v) {
      var d = digitos(v);
      if (!d) return "Informe um telefone para contato.";
      if (!/^[1-9][0-9]\d{8,9}$/.test(d)) return "Informe o telefone com DDD, por exemplo (85) 99999-9999.";
      if (d.length === 11 && d[2] !== "9") return "Confira o número de celular: depois do DDD ele começa com 9.";
      return "";
    },
    email: function (v) { return !v.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) ? "" : "Confira o e-mail informado."; },
    veiculo: function (v) { return v.trim() ? "" : "Informe a marca e o modelo do veículo."; },
    ano: function (v) { var n = +v; return /^\d{4}$/.test(v) && n >= 1950 && n <= anoMax ? "" : "Informe o ano do modelo com 4 dígitos."; },
    cep: function (v) { return !v || digitos(v).length === 8 ? "" : "Confira o CEP (8 dígitos)."; },
    imovel: function (v) { return v ? "" : "Selecione o tipo de imóvel."; },
    ocupacao: function (v) { return v ? "" : "Selecione se o imóvel é próprio, alugado ou de veraneio."; },
    idade: function (v) { var n = +v; return v && n >= 18 && n <= 100 ? "" : "Informe uma idade entre 18 e 100 anos."; },
    atividade: function (v) { return v.trim() ? "" : "Informe o ramo de atividade da empresa."; }
  };

  function campoErro(el, msg) {
    var field = el.closest(".field");
    if (!field) return;
    var id = el.id + "-erro", p = document.getElementById(id);
    field.classList.toggle("is-invalid", !!msg);
    el.setAttribute("aria-invalid", msg ? "true" : "false");
    var descr = (el.getAttribute("aria-describedby") || "").split(" ").filter(function (x) { return x && x !== id; });
    if (msg) {
      if (!p) { p = document.createElement("p"); p.id = id; p.className = "field-error"; field.appendChild(p); }
      p.textContent = msg;
      descr.push(id);
    } else if (p) { p.remove(); }
    if (descr.length) el.setAttribute("aria-describedby", descr.join(" ")); else el.removeAttribute("aria-describedby");
  }
  function validarCampo(el) {
    var regra = regras[el.name];
    if (!regra || el.disabled) return "";
    var msg = regra(el.value);
    campoErro(el, msg);
    return msg;
  }
  function validarCiente() {
    var c = $("#f-ciente"), invalido = !c.checked;
    c.closest(".consent").classList.toggle("is-invalid", invalido);
    c.setAttribute("aria-invalid", String(invalido));
    return invalido ? "Para enviar, confirme que leu o Aviso de Privacidade." : "";
  }
  function validarTudo() {
    var primeiro = null, mensagens = [];
    $$("input, select, textarea", form).forEach(function (el) {
      var msg = validarCampo(el);
      if (msg) { mensagens.push(msg); if (!primeiro) primeiro = el; }
    });
    var msgCiente = validarCiente();
    if (msgCiente) { mensagens.push(msgCiente); if (!primeiro) primeiro = $("#f-ciente"); }
    return { ok: !mensagens.length, primeiro: primeiro, total: mensagens.length };
  }
  $$("input, select, textarea", form).forEach(function (el) {
    el.addEventListener("blur", function () { if (tentouEnviar || el.value) validarCampo(el); });
    el.addEventListener("input", function () { if (el.getAttribute("aria-invalid") === "true") validarCampo(el); });
  });
  $("#f-ciente").addEventListener("change", function () { if (tentouEnviar) validarCiente(); });

  function mostrarErroGeral(html) {
    erroGeral.innerHTML = html;
    if (html) erroGeral.focus();
  }
  function estadoEnvio(ativo) {
    enviando = ativo;
    botao.disabled = ativo;
    botao.classList.toggle("is-loading", ativo);
    form.setAttribute("aria-busy", String(ativo));
    rotulo.textContent = ativo ? "Enviando…" : "Enviar solicitação";
  }

  var rotulosDetalhes = {
    veiculo: "Veículo", ano: "Ano", uso: "Uso", cep: "CEP", imovel: "Imóvel", ocupacao: "Ocupação",
    cidade: "Cidade", idade: "Idade", profissao: "Profissão", atividade: "Atividade"
  };
  function coletarDados() {
    var tipo = tipoAtual(), detalhes = {};
    var grupo = $('[data-grupo="' + tipo + '"]', form);
    $$("input, select", grupo).forEach(function (c) { if (c.value.trim()) detalhes[c.name] = c.value.trim(); });
    return {
      tipo: tipo,
      nome: form.nome.value.trim().replace(/\s+/g, " "),
      telefone: digitos(form.telefone.value),
      email: form.email.value.trim(),
      observacoes: form.observacoes.value.trim(),
      detalhes: detalhes
    };
  }
  function mensagemWhatsApp(d, protocolo) {
    var linhas = ["Olá, Ronay! Enviei pelo site uma solicitação de cotação de *Seguro " + d.tipo + "*" + (protocolo ? " (protocolo nº " + protocolo + ")" : "") + ".", "", "Nome: " + d.nome];
    Object.keys(d.detalhes).forEach(function (k) { linhas.push((rotulosDetalhes[k] || k) + ": " + d.detalhes[k]); });
    return linhas.join("\n");
  }

  function mostrarSucesso(d, protocolo) {
    $("#ok-protocolo").textContent = protocolo ? "nº " + protocolo : "registrado";
    var wa = $("#ok-wa");
    wa.hidden = !temWhatsApp;
    if (temWhatsApp) wa.href = linkWhatsApp(mensagemWhatsApp(d, protocolo));
    form.hidden = true;
    ok.hidden = false;
    ok.focus();
  }
  function novaSolicitacao() {
    form.reset();
    tentouEnviar = false;
    $$(".is-invalid", form).forEach(function (f) { f.classList.remove("is-invalid"); });
    $$(".field-error", form).forEach(function (p) { p.remove(); });
    $$("[aria-invalid]", form).forEach(function (el) { el.removeAttribute("aria-invalid"); });
    mostrarErroGeral("");
    var r = $('input[name="tipo"][value="' + (interesse || "Auto") + '"]', form);
    if (r) r.checked = true;
    setTipo(tipoAtual());
    ok.hidden = true;
    form.hidden = false;
  }
  $("#ok-nova").addEventListener("click", function () { novaSolicitacao(); $("#f-nome").focus(); });

  var camposServidor = { nome: "f-nome", telefone: "f-tel", email: "f-email", observacoes: "f-obs", veiculo: "f-veiculo", ano: "f-ano", cep: "f-cep", imovel: "f-imovel", ocupacao: "f-ocupacao", idade: "f-idade", atividade: "f-atividade", profissao: "f-profissao" };

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (enviando) return;
    tentouEnviar = true;
    mostrarErroGeral("");

    var v = validarTudo();
    if (!v.ok) {
      mostrarErroGeral(v.total === 1 ? "Confira o campo destacado." : "Confira os " + v.total + " campos destacados.");
      if (v.primeiro) v.primeiro.focus();
      return;
    }
    var d = coletarDados();

    // Robôs costumam preencher o campo invisível: não envia nada
    if (form.site.value) { mostrarSucesso(d, ""); return; }

    if (!C.supabaseUrl || !C.supabaseKey) {
      reportarErro("config", "Backend de cotações não configurado");
      mostrarErroGeral("O envio pelo site está indisponível no momento." + (temWhatsApp ? ' <a href="' + linkWhatsApp(mensagemWhatsApp(d)) + '" target="_blank" rel="noopener">Envie sua solicitação pelo WhatsApp</a>.' : ""));
      return;
    }

    estadoEnvio(true);
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var limite = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);

    fetch(C.supabaseUrl.replace(/\/$/, "") + "/rest/v1/rpc/trajano_solicitar_cotacao", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": C.supabaseKey, "Authorization": "Bearer " + C.supabaseKey },
      body: JSON.stringify({
        p_tipo: d.tipo,
        p_nome: d.nome,
        p_telefone: d.telefone,
        p_email: d.email || null,
        p_observacoes: d.observacoes || null,
        p_detalhes: d.detalhes,
        p_ciente_privacidade: $("#f-ciente").checked,
        p_aviso_versao: C.avisoPrivacidadeVersao || "",
        p_pagina: location.pathname.slice(0, 200)
      }),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (corpo) { return { ok: r.ok, corpo: corpo }; });
      })
      .then(function (res) {
        if (res.ok && res.corpo && res.corpo.protocolo) { mostrarSucesso(d, res.corpo.protocolo); return; }
        var codigo = res.corpo && res.corpo.message, dica = res.corpo && res.corpo.hint;
        var idCampo = camposServidor[codigo];
        if (idCampo && document.getElementById(idCampo)) {
          campoErro(document.getElementById(idCampo), dica || "Confira este campo.");
          document.getElementById(idCampo).focus();
          return;
        }
        if (codigo === "privacidade") { validarCiente(); mostrarErroGeral(dica); return; }
        if (codigo === "limite") { mostrarErroGeral(dica || "Muitas solicitações. Tente novamente mais tarde."); return; }
        throw new Error("Resposta inesperada: " + JSON.stringify(res.corpo).slice(0, 300));
      })
      .catch(function (err) {
        reportarErro("envio-cotacao", err);
        mostrarErroGeral("Não foi possível enviar agora. Verifique sua conexão e tente novamente." + (temWhatsApp ? ' Se preferir, <a href="' + linkWhatsApp(mensagemWhatsApp(d)) + '" target="_blank" rel="noopener">envie pelo WhatsApp</a>.' : ""));
      })
      .then(function () { clearTimeout(limite); estadoEnvio(false); });
  });

  /* ===== Botão flutuante: some quando o formulário está na tela ===== */
  var flutuante = $(".wa-float"), secaoCotacao = $("#cotacao");
  if (flutuante && secaoCotacao && "IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      flutuante.classList.toggle("is-away", en[0].isIntersecting);
    }, { threshold: 0.15 }).observe(secaoCotacao);
  }
})();
