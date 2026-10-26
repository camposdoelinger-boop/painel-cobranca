-- =====================================================================
-- Painel de Cobrança – Fucape · configuração do Supabase
-- Rode este arquivo INTEIRO uma vez em: Supabase → SQL Editor → New query → Run
-- Pode rodar de novo sem problema (é idempotente).
-- =====================================================================

-- 1) Quem pode entrar (lista de acesso) ---------------------------------
create table if not exists public.acessos (
  email  text primary key check (email = lower(email)),
  nome   text not null,
  admin  boolean not null default false,   -- admin = pode validar listas/equipe (o antigo "dono")
  ativo  boolean not null default true,    -- false = bloqueia o acesso na hora
  criado_em timestamptz not null default now()
);

-- 2) Perfis (liga o id do login ao e-mail) ------------------------------
create table if not exists public.perfis (
  id    uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  criado_em timestamptz not null default now()
);

create or replace function public.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, email) values (new.id, lower(coalesce(new.email, '')))
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert or update of email on auth.users
  for each row execute function public.ao_criar_usuario();

insert into public.perfis (id, email)
  select id, lower(email) from auth.users where email is not null
  on conflict (id) do nothing;

-- 3) Funções de permissão -----------------------------------------------
create or replace function public.eh_membro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.acessos a
                 where a.email = lower(coalesce(auth.jwt() ->> 'email', '')) and a.ativo);
$$;

create or replace function public.eh_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.acessos a
                 where a.email = lower(coalesce(auth.jwt() ->> 'email', '')) and a.ativo and a.admin);
$$;

alter table public.acessos enable row level security;
alter table public.perfis  enable row level security;

drop policy if exists acessos_ler on public.acessos;
create policy acessos_ler on public.acessos for select to authenticated
  using (public.eh_membro() or email = lower(coalesce(auth.jwt() ->> 'email', '')));
drop policy if exists acessos_admin on public.acessos;
create policy acessos_admin on public.acessos for all to authenticated
  using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists perfis_ler on public.perfis;
create policy perfis_ler on public.perfis for select to authenticated using (public.eh_membro());

-- visão usada pelo painel para nomes, busca e designação
create or replace view public.pessoas with (security_invoker = true) as
  select p.id, coalesce(a.nome, split_part(p.email, '@', 1)) as nome, p.email,
         coalesce(a.ativo, false) as ativo, coalesce(a.admin, false) as admin
  from public.perfis p left join public.acessos a on a.email = p.email;

-- 4) Dados do quadro (cartões, eventos, ajustes, inclusões, listas…) -----
create table if not exists public.docs (
  colecao text not null,
  id      text not null,
  data    jsonb not null,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid default auth.uid(),
  primary key (colecao, id)
);

-- histórico de toda alteração (auditoria / desfazer manual)
create table if not exists public.docs_historico (
  hid bigint generated always as identity primary key,
  colecao text not null, id text not null,
  data_anterior jsonb, data_nova jsonb,
  alterado_em timestamptz not null default now(),
  alterado_por uuid
);

create or replace function public.docs_carimbo()
returns trigger language plpgsql set search_path = public as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;

create or replace function public.docs_auditoria()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.docs_historico (colecao, id, data_anterior, data_nova, alterado_por)
  values (new.colecao, new.id, case when tg_op = 'UPDATE' then old.data end, new.data, auth.uid());
  return null;
end $$;

drop trigger if exists docs_carimbo on public.docs;
create trigger docs_carimbo before insert or update on public.docs
  for each row execute function public.docs_carimbo();
drop trigger if exists docs_auditoria on public.docs;
create trigger docs_auditoria after insert or update on public.docs
  for each row execute function public.docs_auditoria();

alter table public.docs enable row level security;
alter table public.docs_historico enable row level security;

drop policy if exists docs_ler on public.docs;
create policy docs_ler on public.docs for select to authenticated using (public.eh_membro());
drop policy if exists docs_inserir on public.docs;
create policy docs_inserir on public.docs for insert to authenticated
  with check (public.eh_membro() and (colecao <> 'config' or public.eh_admin()));
drop policy if exists docs_alterar on public.docs;
create policy docs_alterar on public.docs for update to authenticated
  using (public.eh_membro() and (colecao <> 'config' or public.eh_admin()))
  with check (public.eh_membro() and (colecao <> 'config' or public.eh_admin()));
-- (sem política de DELETE: ninguém apaga pelo painel; exclusões são "soft delete")

drop policy if exists historico_ler on public.docs_historico;
create policy historico_ler on public.docs_historico for select to authenticated using (public.eh_admin());

create index if not exists docs_colecao_idx on public.docs (colecao);

-- tempo real (o quadro atualiza sozinho para todos)
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- 5) Arquivos de dados (bucket PRIVADO) ----------------------------------
insert into storage.buckets (id, name, public) values ('dados', 'dados', false)
  on conflict (id) do update set public = false;

drop policy if exists dados_ler on storage.objects;
create policy dados_ler on storage.objects for select to authenticated
  using (bucket_id = 'dados' and public.eh_membro());
drop policy if exists dados_admin_inserir on storage.objects;
create policy dados_admin_inserir on storage.objects for insert to authenticated
  with check (bucket_id = 'dados' and public.eh_admin());
drop policy if exists dados_admin_alterar on storage.objects;
create policy dados_admin_alterar on storage.objects for update to authenticated
  using (bucket_id = 'dados' and public.eh_admin());
drop policy if exists dados_admin_apagar on storage.objects;
create policy dados_admin_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'dados' and public.eh_admin());

-- 6) Listas padrão (motivos, canais, resultados, tipos de ação) ----------
insert into public.docs (colecao, id, data)
values ('config', 'listas', $listas${"canais": [{"ativo": true, "id": "can01", "nome": "Telefone"}, {"ativo": true, "id": "can02", "nome": "WhatsApp"}, {"ativo": true, "id": "can03", "nome": "E-mail"}, {"ativo": true, "id": "can04", "nome": "SMS"}, {"ativo": true, "id": "can05", "nome": "Presencial"}, {"ativo": true, "id": "can06", "nome": "Carta / notificação"}], "motivosAtraso": [{"ativo": true, "id": "atr01", "nome": "Não recebeu boleto"}, {"ativo": true, "id": "atr02", "nome": "Discorda do valor"}, {"ativo": true, "id": "atr03", "nome": "Dificuldade financeira / desemprego"}, {"ativo": true, "id": "atr04", "nome": "Esquecimento"}, {"ativo": true, "id": "atr05", "nome": "Aguardando reembolso da empresa"}, {"ativo": true, "id": "atr06", "nome": "Contestação acadêmica"}, {"ativo": true, "id": "atr07", "nome": "Trancamento ou desistência não formalizados"}, {"ativo": true, "id": "atr08", "nome": "Aguardando bolsa ou desconto"}, {"ativo": true, "id": "atr09", "nome": "Diz que já pagou"}, {"ativo": true, "id": "atr10", "nome": "Mudança de responsável financeiro"}, {"ativo": true, "id": "atr11", "nome": "Saúde ou questão pessoal"}, {"ativo": true, "id": "atr12", "nome": "Outro"}], "motivosIndevida": [{"ativo": true, "grupo": "Emissão / sistema", "id": "ind01", "nome": "Boleto emitido com valor ou vencimento errado"}, {"ativo": true, "grupo": "Emissão / sistema", "id": "ind02", "nome": "Lançamento duplicado"}, {"ativo": true, "grupo": "Emissão / sistema", "id": "ind03", "nome": "Erro de migração Athenas → RM"}, {"ativo": true, "grupo": "Emissão / sistema", "id": "ind04", "nome": "Lançamento de teste"}, {"ativo": true, "grupo": "Emissão / sistema", "id": "ind05", "nome": "Parcela gerada após conclusão ou defesa antecipada"}, {"ativo": true, "grupo": "Emissão / sistema", "id": "ind06", "nome": "Parcela não cancelada após trancamento, desistência ou cancelamento"}, {"ativo": true, "grupo": "Benefícios", "id": "ind07", "nome": "Bolsa não contabilizada"}, {"ativo": true, "grupo": "Benefícios", "id": "ind08", "nome": "Desconto ou convênio não aplicado"}, {"ativo": true, "grupo": "Benefícios", "id": "ind09", "nome": "Isenção (colaborador ou dependente)"}, {"ativo": true, "grupo": "Benefícios", "id": "ind10", "nome": "Deveria ser faturado para empresa/convênio"}, {"ativo": true, "grupo": "Pagamento", "id": "ind11", "nome": "Pago e não conciliado (PIX ou depósito)"}, {"ativo": true, "grupo": "Pagamento", "id": "ind12", "nome": "Pago em outro título ou acordo"}, {"ativo": true, "grupo": "Pagamento", "id": "ind13", "nome": "Pago em duplicidade pelo aluno"}, {"ativo": true, "grupo": "Contratual", "id": "ind14", "nome": "Parcela já renegociada em acordo"}, {"ativo": true, "grupo": "Contratual", "id": "ind15", "nome": "Transferência de curso ou turma"}, {"ativo": true, "grupo": "Contratual", "id": "ind16", "nome": "Responsável financeiro errado"}, {"ativo": true, "grupo": "Contratual", "id": "ind17", "nome": "Cobrança já está com o escritório"}, {"ativo": true, "grupo": "Contratual", "id": "ind18", "nome": "Prova ou taxa não realizada"}, {"ativo": true, "grupo": "Contratual", "id": "ind19", "nome": "Desistência no prazo de arrependimento"}, {"ativo": true, "grupo": "Outros", "id": "ind20", "nome": "Outro"}], "resultados": [{"ativo": true, "id": "res01", "nome": "Sem resposta"}, {"ativo": true, "id": "res02", "nome": "Caixa postal"}, {"ativo": true, "id": "res03", "nome": "Número ou e-mail inválido"}, {"ativo": true, "id": "res04", "nome": "Retornou / conversou"}, {"ativo": true, "id": "res05", "nome": "Prometeu pagar"}, {"ativo": true, "id": "res06", "nome": "Pediu negociação"}, {"ativo": true, "id": "res07", "nome": "Informou que já pagou"}, {"ativo": true, "id": "res08", "nome": "Contestou a cobrança"}, {"ativo": true, "id": "res09", "nome": "Recusou pagar"}], "tiposAcao": [{"ativo": true, "id": "acao01", "nome": "Ligar"}, {"ativo": true, "id": "acao02", "nome": "Enviar mensagem (WhatsApp)"}, {"ativo": true, "id": "acao03", "nome": "Enviar e-mail"}, {"ativo": true, "id": "acao04", "nome": "Verificar informação com outra área"}, {"ativo": true, "id": "acao05", "nome": "Enviar documento ao aluno"}, {"ativo": true, "id": "acao06", "nome": "Emitir / reenviar boleto"}, {"ativo": true, "id": "acao07", "nome": "Conferir pagamento prometido"}, {"ativo": true, "id": "acao08", "nome": "Aguardar retorno do aluno"}, {"ativo": true, "id": "acao09", "nome": "Enviar ao escritório de cobrança"}]}$listas$::jsonb)
on conflict (colecao, id) do nothing;

-- 7) Primeiro administrador ---------------------------------------------
insert into public.acessos (email, nome, admin)
values ('caiodoelinger@fucape.br', 'Caio Doelinger', true)
on conflict (email) do update set admin = true, ativo = true;

-- Para liberar outra pessoa (depois crie o login dela em Authentication → Users):
--   insert into public.acessos (email, nome) values ('fulano@fucape.br', 'Fulano de Tal');
-- Para bloquear:
--   update public.acessos set ativo = false where email = 'fulano@fucape.br';
