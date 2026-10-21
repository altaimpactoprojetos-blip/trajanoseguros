# Trajano Seguros — site

Site institucional e de cotação da Trajano Seguros (Ronay Trajano, corretor de seguros licenciado SUSEP).
HTML, CSS e JavaScript puros, sem build — publicado pelo GitHub Pages. As cotações são gravadas no Supabase.

## Estrutura

```
index.html                página principal (seções marcadas com comentários)
privacidade.html          Aviso de Privacidade (LGPD)
admin.html                painel restrito para acompanhar as cotações (login)
404.html                  página de erro
robots.txt, sitemap.xml, site.webmanifest, favicon.ico, favicon-32.png, apple-touch-icon.png
assets/
  css/style.css           estilos do site
  css/admin.css           estilos do painel
  js/config.js            ⚠️ DADOS OFICIAIS (WhatsApp, e-mail, CNPJ, SUSEP…) — preencher aqui
  js/main.js              menu, WhatsApp contextual, formulário de cotação
  js/pagina.js            preenche os dados oficiais nas páginas internas
  js/admin.js             painel de cotações
  img/                    imagens otimizadas (WebP) e ícones
  img/originais/          fotos originais em alta resolução
supabase/migrations/      SQL aplicado no banco
```

## Seções da página

Início · Seguros (Auto, Residencial, Vida, Empresarial) · Como funciona · Sobre · Diferenciais ·
Depoimentos (pronta, escondida até haver depoimentos reais) · Cotação · Dúvidas frequentes · Rodapé.

## Dados oficiais pendentes — `assets/js/config.js`

Nada foi inventado: enquanto um campo estiver vazio, o item correspondente fica escondido.

| Campo | Onde aparece |
|---|---|
| `whatsapp` / `telefoneExibicao` (já preenchido: (85) 98676-8338) | botão flutuante, "Falar com um especialista", atalhos dos cards, "Continuar pelo WhatsApp" após a cotação, rodapé |
| `email` | contato, rodapé, Aviso de Privacidade (canal para pedidos LGPD) |
| `instagram`, `horario`, `endereco` | contato e rodapé |
| `razaoSocial`, `cnpj`, `susep` | rodapé, seção Sobre e Aviso de Privacidade |

Sem número de WhatsApp, os botões de WhatsApp levam ao formulário e os atalhos ficam ocultos.

## Cotações (Supabase)

Projeto **CRM Vitalício** (`lffzxqwgqgsiumunahyt`), arquivo `supabase/migrations/20261020_trajano_cotacoes.sql`.

- O formulário chama a função `trajano_solicitar_cotacao` com a chave **pública** (publishable). Essa chave não lê nem altera a tabela.
- A função valida tudo no servidor (campos obrigatórios por produto, telefone, ano, idade, CEP, e-mail, tamanhos),
  guarda só os campos previstos para cada produto, registra a ciência do Aviso de Privacidade e devolve o número do protocolo.
- Anti-abuso: envio repetido do mesmo telefone/produto em 10 min devolve o mesmo protocolo; no máximo 5 por telefone por dia
  e 30 no site a cada 10 min; campo-armadilha contra robôs no formulário.
- Coluna `cpf` (validada com `trajano_cpf_valido`, dígitos verificadores) — `supabase/migrations/20261021_trajano_cotacoes_cpf.sql`.
- Tabela `trajano_cotacoes` com RLS: só e-mails cadastrados em `trajano_cotacoes_admins` (com login) leem e mudam status/notas.

### Liberar o painel `admin.html` para o corretor

1. Supabase → Authentication → Users → **Add user** (e-mail e senha do corretor).
2. SQL Editor:
   ```sql
   insert into public.trajano_cotacoes_admins (email) values ('email-do-corretor@dominio.com');
   ```
3. Acessar `…/admin.html`, entrar e acompanhar as solicitações (status, notas, WhatsApp do cliente, CSV).

## Publicação (GitHub Pages)

Settings → Pages → *Deploy from a branch* → branch `main`, pasta `/ (root)`. Domínio: `www.trajanoseguros.online` (arquivo `CNAME`; DNS na Hostinger com 4 registros A para o GitHub e CNAME `www`).
Os endereços em `index.html` (canonical, Open Graph, JSON-LD), `sitemap.xml`, `robots.txt` e `404.html`
usam `https://www.trajanoseguros.online/`. Se houver domínio próprio, troque nesses arquivos
e crie o arquivo `CNAME`.

## Depoimentos

Em `index.html`, seção `#depoimentos`: remova `hidden` e repita o bloco `<figure class="testimonial">`.
Publique apenas depoimentos reais e autorizados.
