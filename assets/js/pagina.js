/* Trajano Seguros — páginas internas (privacidade, 404): preenche os dados oficiais de config.js */
(function () {
  "use strict";
  var C = window.TRAJANO || {};
  var qs = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  qs("[data-show]").forEach(function (el) { el.hidden = !C[el.dataset.show]; });
  qs("[data-info]").forEach(function (el) { if (C[el.dataset.info]) el.textContent = C[el.dataset.info]; });
  qs("[data-mailto]").forEach(function (a) { if (C.email) a.href = "mailto:" + C.email; });
  qs(".sem-contato").forEach(function (el) { el.hidden = !!(C.email || C.whatsapp); });
  var ano = document.getElementById("ano");
  if (ano) ano.textContent = new Date().getFullYear();
})();
