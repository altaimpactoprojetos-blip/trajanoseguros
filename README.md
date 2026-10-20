# Trajano Seguros

Site de uma página da Trajano Seguros (Ronay Trajano, corretor de seguros licenciado SUSEP).

## Estrutura

```
index.html              página do site (seções marcadas com comentários)
assets/
  css/style.css         estilos
  js/main.js            WhatsApp/Instagram, menu do celular e formulário de cotação
  img/
    logo.webp           brasão pequeno (menu, rodapé, ícone da aba)
    brasao.webp         brasão grande (selo no topo)
    ronay-trajano.webp  retrato usado no site
    originais/          fotos originais em alta resolução
```

## Seções da página

1. Início — apresentação, botões de cotação e WhatsApp
2. Valores — transparência, cuidado e proteção
3. Seguros — auto, residencial, vida, empresarial, saúde e viagem
4. Sobre — Ronay Trajano e registro SUSEP
5. Como funciona — 4 etapas
6. Cotação — formulário que monta a mensagem pronta para o WhatsApp
7. Dúvidas frequentes

## Antes de publicar

Troque os dados de contato no início de `assets/js/main.js`:

```js
const CONFIG = {
  whatsapp: "5585900000000",          // DDI + DDD + número, só dígitos
  whatsappExibicao: "(85) 9 0000-0000",
  instagram: "trajanoseguros"
};
```

## Publicar no GitHub Pages

Settings → Pages → *Deploy from a branch*, escolha a branch e a pasta `/ (root)`.
