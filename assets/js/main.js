/* ===== Configuração: troque pelos dados reais (WhatsApp e Instagram) ===== */
const CONFIG = {
  whatsapp: "5585900000000",          // DDI + DDD + número, só dígitos
  whatsappExibicao: "(85) 9 0000-0000",
  instagram: "trajanoseguros"
};

const waBase = "https://wa.me/" + CONFIG.whatsapp;
const waHello = waBase + "?text=" + encodeURIComponent("Olá, Ronay! Vim pelo site da Trajano Seguros e gostaria de falar sobre seguros.");
document.querySelectorAll(".wa-link").forEach(a => a.href = waHello);
document.querySelectorAll(".wa-num").forEach(a => a.textContent = CONFIG.whatsappExibicao);
document.querySelectorAll(".ig-link").forEach(a => a.href = "https://instagram.com/" + CONFIG.instagram);
document.getElementById("ano").textContent = new Date().getFullYear();

/* ===== Menu no celular ===== */
const menuBtn = document.querySelector(".menu-btn"), menu = document.getElementById("menu");
function toggleMenu(open){
  menu.classList.toggle("open", open);
  menuBtn.setAttribute("aria-expanded", open);
  menuBtn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
}
menuBtn.addEventListener("click", () => toggleMenu(!menu.classList.contains("open")));
menu.querySelectorAll("a").forEach(a => a.addEventListener("click", () => toggleMenu(false)));
document.addEventListener("keydown", e => { if (e.key === "Escape") toggleMenu(false); });

/* ===== Formulário de cotação ===== */
const detalhes = {
  "Auto": ["Veículo (marca, modelo e ano)", "Ex.: Onix LT 2023"],
  "Residencial": ["Imóvel (casa ou apto, próprio ou alugado)", "Ex.: apartamento próprio, 70 m²"],
  "Vida": ["Idade e profissão", "Ex.: 38 anos, engenheiro"],
  "Empresarial": ["Ramo da empresa", "Ex.: loja de roupas, 2 funcionários"],
  "Saúde": ["Quantas vidas e idades", "Ex.: casal 35 e 33 anos + filho 4 anos"],
  "Viagem": ["Destino e datas", "Ex.: Lisboa, 10 a 24 de janeiro"]
};
const lDet = document.getElementById("l-det"), fDet = document.getElementById("f-det");
function setTipo(t){ const d = detalhes[t]; lDet.textContent = d[0]; fDet.placeholder = d[1]; }
document.querySelectorAll('input[name="tipo"]').forEach(r => r.addEventListener("change", () => setTipo(r.value)));
document.querySelectorAll(".svc a[data-tipo]").forEach(a => a.addEventListener("click", () => {
  const r = [...document.querySelectorAll('input[name="tipo"]')].find(x => x.value === a.dataset.tipo);
  if (r){ r.checked = true; setTipo(r.value); }
}));

const form = document.getElementById("quote-form"), res = document.getElementById("quote-result");
const err = document.getElementById("f-err"), qText = document.getElementById("q-text");
form.addEventListener("submit", e => {
  e.preventDefault();
  const f = new FormData(form);
  const nome = (f.get("nome")||"").trim(), tel = (f.get("tel")||"").trim();
  if (!nome){ err.textContent = "Informe seu nome para eu saber com quem estou falando."; document.getElementById("f-nome").focus(); return; }
  if (tel.replace(/\D/g,"").length < 10){ err.textContent = "Informe um WhatsApp com DDD, por exemplo (85) 9 0000-0000."; document.getElementById("f-tel").focus(); return; }
  err.textContent = "";
  const tipo = f.get("tipo"), det = (f.get("detalhe")||"").trim(), msg = (f.get("msg")||"").trim();
  let txt = `Olá, Ronay! Quero uma cotação de *Seguro ${tipo}*.\n\nNome: ${nome}\nWhatsApp: ${tel}`;
  if (det) txt += `\n${lDet.textContent}: ${det}`;
  if (msg) txt += `\nObservações: ${msg}`;
  qText.textContent = txt;
  document.getElementById("q-send").href = waBase + "?text=" + encodeURIComponent(txt);
  form.hidden = true; res.hidden = false;
});
document.getElementById("q-back").addEventListener("click", () => { res.hidden = true; form.hidden = false; });
document.getElementById("q-copy").addEventListener("click", e => {
  const b = e.currentTarget;
  navigator.clipboard.writeText(qText.textContent).then(() => { b.textContent = "Copiado"; setTimeout(()=>b.textContent="Copiar texto",1800); })
  .catch(() => { const s = getSelection(), r = document.createRange(); r.selectNodeContents(qText); s.removeAllRanges(); s.addRange(r); b.textContent = "Texto selecionado"; });
});
