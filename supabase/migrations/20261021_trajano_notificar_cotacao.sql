-- Trajano Seguros — aviso por e-mail à corretora a cada nova cotação (aplicado em 21/10/2026)
-- Projeto Supabase: CRM Vitalício (lffzxqwgqgsiumunahyt)
--
-- Fluxo: insert em trajano_cotacoes → gatilho (pg_net) → Edge Function notificar-cotacao → API da Brevo
--        → e-mail para TRAJANO_NOTIFY_EMAIL (trajanoseguros@yahoo.com).
-- Segredos no Vault: BREVO_API_KEY (chave da Brevo), NOTIFY_FROM_EMAIL (remetente verificado na Brevo),
--   TRAJANO_NOTIFY_EMAIL (destino), TRAJANO_NOTIFY_FROM_NAME (opcional; padrão "Site Trajano Seguros").

-- 1. Destino do aviso
select vault.create_secret('trajanoseguros@yahoo.com', 'TRAJANO_NOTIFY_EMAIL', 'Trajano Seguros: e-mail que recebe o aviso de nova cotação');

-- 2. Leitura dos segredos (só a chave de serviço, usada pela Edge Function)
create or replace function public.trajano_segredo(nome_segredo text)
returns text language sql security definer set search_path = vault, public as $$
  select decrypted_secret from vault.decrypted_secrets where name = nome_segredo limit 1;
$$;
revoke all on function public.trajano_segredo(text) from public, anon, authenticated;
grant execute on function public.trajano_segredo(text) to service_role;

-- 3. Gatilho: chama a Edge Function a cada nova cotação (o token é a chave pública anon, exigida por verify_jwt)
create or replace function public.trajano_notificar_cotacao()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://lffzxqwgqgsiumunahyt.supabase.co/functions/v1/notificar-cotacao',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <CHAVE_ANON_DO_PROJETO>'
    ),
    body := jsonb_build_object('id', new.id),
    timeout_milliseconds := 8000
  );
  return new;
end;
$$;
revoke all on function public.trajano_notificar_cotacao() from public, anon, authenticated;
create trigger trg_trajano_notificar_cotacao after insert on public.trajano_cotacoes for each row execute function public.trajano_notificar_cotacao();
