import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Trajano Seguros — chamada pelo gatilho do banco (pg_net) a cada nova solicitação de cotação.
// Avisa a CORRETORA por e-mail (API da Brevo) com os dados da solicitação.
// Segredos no Vault (RPC trajano_segredo, só service_role): BREVO_API_KEY, NOTIFY_FROM_EMAIL,
// TRAJANO_NOTIFY_EMAIL (destino), TRAJANO_NOTIFY_FROM_NAME (opcional).

type Row = {
  id: string; protocolo: number; tipo: string; nome: string; telefone: string; cpf: string | null;
  email: string | null; detalhes: Record<string, string>; observacoes: string | null; criado_em: string;
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

const ROTULOS: Record<string, string> = {
  veiculo: "Veículo", ano: "Ano", uso: "Uso", cep: "CEP de pernoite", tem_seguro: "Já tem seguro",
  imovel: "Tipo de imóvel", ocupacao: "O imóvel é", cidade: "Cidade", idade: "Idade", profissao: "Profissão", atividade: "Ramo de atividade",
};
const fmtTel = (t: string) => t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;
const fmtCpf = (c: string) => c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  let body: { id?: string; record?: Partial<Row> } = {};
  try { body = await req.json(); } catch { /* corpo vazio */ }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let row: Row | null = body.record && body.record.nome && body.record.telefone ? (body.record as Row) : null;
  const id = body.id ?? body.record?.id;
  if (!row && id) {
    for (let i = 0; i < 3 && !row; i++) {
      if (i) await sleep(1500);
      const { data } = await supabase.from("trajano_cotacoes")
        .select("id, protocolo, tipo, nome, telefone, cpf, email, detalhes, observacoes, criado_em").eq("id", id).maybeSingle();
      row = data as Row | null;
    }
  }
  if (!row) return json({ ok: false, erro: "cotação não encontrada" }, 404);

  async function segredo(nome: string): Promise<string | undefined> {
    const env = Deno.env.get(nome);
    if (env) return env;
    const { data } = await supabase.rpc("trajano_segredo", { nome_segredo: nome });
    return (data as string | null) ?? undefined;
  }
  const apiKey = await segredo("BREVO_API_KEY");
  const para = await segredo("TRAJANO_NOTIFY_EMAIL");
  const fromEmail = await segredo("NOTIFY_FROM_EMAIL");
  const fromName = (await segredo("TRAJANO_NOTIFY_FROM_NAME")) ?? "Site Trajano Seguros";
  if (!apiKey || !para || !fromEmail) return json({ ok: false, erro: "segredos ausentes (BREVO_API_KEY, TRAJANO_NOTIFY_EMAIL, NOTIFY_FROM_EMAIL)" });

  const tel = fmtTel(row.telefone);
  const primeiro = row.nome.trim().split(/\s+/)[0];
  const waMsg = `Olá, ${primeiro}! Aqui é o Ronay, da Trajano Seguros. Recebi sua solicitação de cotação de seguro ${row.tipo} (protocolo nº ${row.protocolo}). Podemos conversar?`;
  const waUrl = `https://wa.me/55${row.telefone}?text=${encodeURIComponent(waMsg)}`;
  const painel = "https://www.trajanoseguros.online/admin.html";
  const quando = new Date(row.criado_em).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const det = row.detalhes || {};
  const linhasDet = Object.keys(det).filter((k) => det[k]).map((k) => [ROTULOS[k] || k, det[k]]);
  const linha = (k: string, v: string) => `
    <tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a6a33;vertical-align:top;width:40%">${esc(k)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;font-size:15px;color:#1a1a1a">${v}</td></tr>`;

  const html = `
  <div style="background:#f4f2ee;padding:24px 12px;font-family:Arial,sans-serif;color:#1a1a1a">
    <div style="max-width:520px;margin:auto;background:#fff;border:1px solid #e6dcc3;border-top:4px solid #d4a24c;padding:26px 22px">
      <p style="letter-spacing:.25em;font-size:11px;color:#8a6a33;margin:0 0 6px">NOVA SOLICITAÇÃO DE COTAÇÃO</p>
      <p style="font-family:Georgia,serif;font-size:26px;margin:0 0 4px">Seguro ${esc(row.tipo)} · protocolo nº ${row.protocolo}</p>
      <p style="color:#666;font-size:13px;margin:0 0 18px">Recebida em ${quando} pelo site.</p>
      <table style="width:100%;border-collapse:collapse">
        ${linha("Nome", esc(row.nome))}
        ${linha("WhatsApp", `<a href="${waUrl}" style="color:#1a1a1a">${esc(tel)}</a>`)}
        ${linha("E-mail", row.email ? `<a href="mailto:${esc(row.email)}" style="color:#1a1a1a">${esc(row.email)}</a>` : "<span style='color:#999'>—</span>")}
        ${linha("CPF", row.cpf ? esc(fmtCpf(row.cpf)) : "<span style='color:#999'>—</span>")}
        ${linhasDet.map(([k, v]) => linha(k, esc(v))).join("")}
        ${linha("Mensagem", row.observacoes ? esc(row.observacoes).replace(/\n/g, "<br>") : "<span style='color:#999'>—</span>")}
      </table>
      <div style="margin:22px 0 6px">
        <a href="${waUrl}" style="display:inline-block;background:#d4a24c;color:#140f05;text-decoration:none;font-weight:bold;padding:12px 18px;border-radius:4px;margin:0 8px 8px 0">Chamar no WhatsApp</a>
        <a href="${painel}" style="display:inline-block;border:1px solid #d4a24c;color:#8a6a33;text-decoration:none;font-weight:bold;padding:11px 18px;border-radius:4px;margin:0 0 8px">Abrir o painel</a>
      </div>
      <p style="color:#999;font-size:11px;margin:16px 0 0">Aviso automático do site trajanoseguros.online. O cliente autorizou o contato e a leitura do Aviso de Privacidade.</p>
    </div>
  </div>`;

  const texto = [
    `Nova solicitação de cotação — Seguro ${row.tipo} (protocolo nº ${row.protocolo})`,
    `Recebida em ${quando} pelo site.`, "",
    `Nome: ${row.nome}`, `WhatsApp: ${tel}`, `E-mail: ${row.email || "—"}`, `CPF: ${row.cpf ? fmtCpf(row.cpf) : "—"}`,
    ...linhasDet.map(([k, v]) => `${k}: ${v}`),
    `Mensagem: ${row.observacoes || "—"}`, "",
    `Chamar no WhatsApp: ${waUrl}`, `Painel: ${painel}`,
  ].join("\n");

  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      replyTo: row.email ? { name: row.nome, email: row.email } : { name: fromName, email: fromEmail },
      to: [{ email: para, name: "Trajano Seguros" }],
      subject: `Nova cotação · Seguro ${row.tipo} · ${row.nome} (nº ${row.protocolo})`,
      htmlContent: html,
      textContent: texto,
      tags: ["trajano-seguros", "nova-cotacao"],
    }),
  });
  const txt = await r.text();
  if (!r.ok) console.error("Brevo falhou:", r.status, txt);
  return json({ ok: r.ok, status: r.status, brevo: txt });
});
