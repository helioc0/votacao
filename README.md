# Vota — GitHub Pages + Supabase

O site pode continuar publicado no GitHub Pages. O Supabase guarda a votação partilhada, os votos e a área protegida de gestão.

## Configuração única no Supabase

1. Crie um projeto no [Supabase](https://supabase.com/dashboard).
2. Em **Authentication > Providers > Anonymous**, ative **Anonymous sign-ins**.
3. Abra **SQL Editor**, cole e execute o conteúdo de `supabase/schema.sql`.
4. Instale a CLI do Supabase, inicie sessão e ligue este repositório ao projeto:

   ```powershell
   npx supabase login
   npx supabase link --project-ref O_SEU_PROJECT_REF
   ```

5. Defina um PIN privado e publique a função de gestão:

   ```powershell
   npx supabase secrets set MANAGER_PIN=UM_PIN_FORTE
   npx supabase functions deploy manage
   ```

6. Em **Settings > API**, copie o Project URL e a chave **publishable** (ou a chave `anon` dos projetos antigos). Cole ambos em `supabase-config.js`.
7. Envie as alterações para o GitHub. O GitHub Pages passa a utilizar o Supabase automaticamente.

## Segurança e comportamento

- A chave publishable pode ficar no site público: as regras RLS do Supabase limitam o acesso.
- O PIN de gestão fica apenas nos secrets da Edge Function, não no GitHub Pages.
- Cada visitante recebe uma sessão anónima; pode alterar o seu voto até ao fim da votação.
- A área pública recebe apenas a votação atual e os totais. O histórico e os votos individuais só são consultados pela função de gestão.

Para realmente assegurar “uma pessoa, um voto” entre dispositivos, troque a sessão anónima por login com e-mail, código de estudante ou códigos individuais.
