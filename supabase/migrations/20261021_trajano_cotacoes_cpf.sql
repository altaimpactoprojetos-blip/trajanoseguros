-- Trajano Seguros — CPF na solicitação de cotação (aplicado em 21/10/2026)
-- Projeto Supabase: CRM Vitalício (lffzxqwgqgsiumunahyt)

-- 1. Coluna
alter table public.trajano_cotacoes add column if not exists cpf text check (cpf is null or cpf ~ '^[0-9]{11}$');

-- 2. Validação dos dígitos verificadores
create or replace function public.trajano_cpf_valido(p_cpf text)
returns boolean language plpgsql immutable set search_path = public as $$
declare d int[]; s int; r int; n int;
begin
  if p_cpf is null or p_cpf !~ '^[0-9]{11}$' then return false; end if;
  if p_cpf ~ '^(\d)\1{10}$' then return false; end if;
  d := array(select (regexp_split_to_table(p_cpf, ''))::int);
  foreach n in array array[9, 10] loop
    s := 0;
    for i in 1..n loop s := s + d[i] * (n + 2 - i); end loop;
    r := (s * 10) % 11; if r = 10 then r := 0; end if;
    if r <> d[n + 1] then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.trajano_cpf_valido(text) from public, anon, authenticated;

-- 3. trajano_solicitar_cotacao: o site envia o CPF dentro de p_detalhes ("cpf"); a função
--    valida com trajano_cpf_valido, exige o campo e grava na coluna cpf (não nos detalhes).
--    Trechos acrescentados em relação a 20261020_trajano_cotacoes.sql:
--      declare ... v_cpf text := regexp_replace(coalesce(p_detalhes ->> 'cpf', ''), '\D', '', 'g');
--      if not public.trajano_cpf_valido(v_cpf) then
--        raise exception 'cpf' using errcode = 'P0001', hint = 'Informe um CPF válido.';
--      end if;
--      insert into public.trajano_cotacoes (tipo, nome, telefone, cpf, email, ...) values (..., v_cpf, ...)

-- 4. (21/10, formulário Auto) campo opcional tem_seguro ('Sim'/'Não') aceito em p_detalhes para Auto;
--    ano mínimo do veículo passa de 1950 para 1980.
--      when 'Auto' then v_permitidas := array['veiculo', 'ano', 'uso', 'cep', 'tem_seguro']; ...
--      if v_det ? 'tem_seguro' and v_det ->> 'tem_seguro' not in ('Sim', 'Não') then raise exception 'tem_seguro' ...
--      if v_ano is null or v_ano < 1980 or ...

-- 5. (21/10, painel) status 'perdida' e exclusão pelos admins
alter table public.trajano_cotacoes drop constraint trajano_cotacoes_status_check;
alter table public.trajano_cotacoes add constraint trajano_cotacoes_status_check2
  check (status in ('nova', 'em_atendimento', 'proposta_enviada', 'fechada', 'perdida', 'arquivada'));
grant delete on public.trajano_cotacoes to authenticated;
create policy "admins_excluem_cotacoes" on public.trajano_cotacoes for delete to authenticated using (public.trajano_eh_admin());
