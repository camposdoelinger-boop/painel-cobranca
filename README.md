# Painel de Cobrança – Fucape (versão Vercel + Supabase)

Quadro de cobrança (kanban, agenda, equipe, indicadores, configurações) **com a aba Recebíveis completa** (conciliação, conferência mês a mês, disciplinas, planos e exportações em Excel/Word), rodando fora do Claude.

## Como funciona (e por que gasta quase nada)

```
Navegador da equipe ──► Vercel (só arquivos estáticos: index.html + 2 .js)
        │
        └──────────────► Supabase (login, banco do quadro em tempo real, CSVs privados)
```

* **Vercel** só entrega 3 arquivos estáticos (~70 KB compactados). Não há *build*, *serverless functions*, *middleware* nem *image optimization*, que são o que consome créditos. O uso fica no limite gratuito com folga.
* **Supabase** (plano Free) guarda o login, os dados do quadro e os CSVs. Os CSVs vão compactados (`.csv.gz`, 1,1 MB no total, contra 15 MB sem compactar) e ficam em cache no navegador de cada pessoa. Só são baixados de novo quando você substitui o arquivo.
* **Os dados dos alunos NÃO vão para a Vercel.** Ficam num bucket privado do Supabase, que só entrega os arquivos para quem fez login e está na lista de acesso.

> ⚠️ **Plano da Vercel:** o plano *Hobby* (gratuito) é só para uso não comercial. Para uso institucional, os termos pedem o plano *Pro*. Se não quiser assinar, a mesma pasta `public/` funciona sem mudança nenhuma no Cloudflare Pages ou na Netlify, que têm planos gratuitos que permitem esse uso.
>
> ⚠️ **Supabase Free:** o projeto entra em pausa depois de 7 dias sem nenhum acesso. Com uso diário isso não acontece. Se pausar, basta clicar em "Restore" no painel do Supabase.

## Estrutura

```
public/
  index.html          ← o painel (mesmo código do artifact, só com os endereços dos dados trocados)
  js/config.js        ← URL + chave anon do Supabase (você preenche)
  js/claude-shim.js   ← faz o papel do "Claude" (login, banco, arquivos, downloads)
  robots.txt
supabase/setup.sql    ← cria tabelas, regras de acesso, bucket e listas padrão
ferramentas/compactar_csv.py
vercel.json           ← site estático, sem build, com cabeçalhos de segurança
```

Os dados (`dados_para_upload.zip`) vêm **separados** e nunca devem entrar no Git nem na Vercel. O `.gitignore` já bloqueia `*.csv`, `*.csv.gz` e `*.xlsx`.

---

## Passo a passo (uns 20 minutos, uma vez só)

### 1. Supabase: criar o projeto
1. Entre em <https://supabase.com>, clique em **New project** e escolha a região **South America (São Paulo)**.
2. Vá em **SQL Editor → New query**, cole o conteúdo de `supabase/setup.sql` e clique em **Run**.
   * Esse arquivo já cadastra `caiodoelinger@fucape.br` como administrador. Se o administrador for outra pessoa, troque o e-mail na seção 7 antes de rodar.
3. Vá em **Authentication → Sign In / Providers**:
   * desligue **Allow new users to sign up**. Assim, só você cria os usuários.
4. Vá em **Authentication → URL Configuration** e, em **Site URL**, coloque o endereço que a Vercel der (passo 3). Dá para preencher depois.

### 2. Supabase: subir os dados
1. **Storage → bucket `dados`** (o `setup.sql` já criou esse bucket como privado).
2. Arraste os 7 arquivos `.csv.gz` de `dados_para_upload.zip`:
   `cards.csv.gz`, `kanban_titulos.csv.gz`, `pagadores.csv.gz`, `titulos_jan_jun.csv.gz`, `titulos_jul_dez.csv.gz`, `disciplinas.csv.gz`, `planos_alunos.csv.gz`.
3. Os nomes precisam ser exatamente esses.

### 3. Configurar e publicar na Vercel
1. No Supabase, abra **Project Settings → API** e copie a **Project URL** e a chave **anon / public**.
2. Cole as duas em `public/js/config.js`.
   **Nunca** use a chave `service_role`.
3. Publique. Escolha uma das duas formas:
   * **Pela linha de comando** (o mais simples): dentro desta pasta, rode `npx vercel` para criar um ambiente de teste e depois `npx vercel --prod` para publicar.
   * **Pelo GitHub:** crie um repositório **privado** com esta pasta e, na Vercel, use **Add New → Project → Import**. Framework: *Other*. Não preencha comando de build.
4. Opcional: ative **Settings → Deployment Protection** na Vercel para ter uma camada extra de proteção. O login do painel já protege os dados.

### 4. Liberar a equipe
Para cada pessoa:
1. No **SQL Editor**, rode:
   ```sql
   insert into public.acessos (email, nome) values ('fulano@fucape.br', 'Fulano de Tal');
   ```
   Para dar poderes de administrador (validar listas e equipe), use `(email, nome, admin)` com `true`.
2. Em **Authentication → Users → Add user → Create new user**, coloque o e-mail e uma senha provisória e marque **Auto Confirm User**.
3. Mande o link do site e a senha provisória para a pessoa. No canto inferior direito do painel tem o botão **Trocar senha**.
4. Depois do primeiro login, ela aparece na busca da aba **Configurações → Equipe de cobrança**. Adicione a pessoa lá para que ela entre nas listas de designação.

Para **bloquear** alguém na hora:
`update public.acessos set ativo = false where email = 'fulano@fucape.br';`

Se alguém **esquecer a senha**: em **Authentication → Users**, abra a pessoa e defina uma senha nova.
O e-mail de recuperação só funciona se você configurar um SMTP próprio em **Authentication → Emails → SMTP**, por exemplo o Microsoft 365 da Fucape. O SMTP padrão do Supabase só envia para membros do projeto Supabase.

---

## Atualizar a base (nova extração do RM)
1. Gere os CSVs novos. O processamento das planilhas do RM é feito à parte e produz os mesmos 7 arquivos.
2. Compacte com `python ferramentas/compactar_csv.py PASTA_DOS_CSV`.
3. No bucket `dados` do Supabase, suba os `.gz` **substituindo** os antigos.

Na próxima vez que cada pessoa abrir o painel, o navegador percebe que o arquivo mudou e baixa a versão nova. O histórico do quadro (cartões, eventos, ajustes) fica no banco e não se perde.

## Onde ficam os dados do quadro
* Tabela `docs`: tudo o que a equipe registra (cartões, eventos/CRM, alocações, ajustes e inclusões de parcelas, propostas, listas e equipe).
* Tabela `docs_historico`: cópia de **cada alteração**, com data e autor. Serve de auditoria e para desfazer algo manualmente.
* Regras de acesso:
  * só quem está ativo em `acessos` lê ou grava;
  * só administrador altera `config` (listas e equipe);
  * ninguém apaga registros pelo painel, porque as exclusões são marcadas e não removidas.
* Backup: em **Table Editor → docs → Export to CSV**, ou pelo backup diário do Supabase nos planos pagos.

## Observações
* A primeira abertura baixa cerca de 1,1 MB de dados. As seguintes usam o cache, até você trocar algum arquivo. Ao clicar em **Sair**, o cache local é apagado.
* Os testes feitos no quadro dentro do Claude (3 cartões e 8 eventos) **não foram migrados**, porque os identificadores de usuário mudam. As listas de motivos, canais, resultados e tipos de ação foram migradas pelo `setup.sql`.
