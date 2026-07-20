# Deploy FinTrack — Supabase + Netlify

## 1. Criar projeto no Supabase

1. Acesse [https://supabase.com](https://supabase.com) e crie um projeto.
2. **SQL Editor** → New query → cole o conteúdo de `supabase/schema.sql` → **Run**.
3. **Authentication → Providers**:
   - Ative **Email**
   - (Opcional) **Google**, **Apple**
   - (Opcional) **Anonymous** (login de convidado)
4. **Authentication → URL Configuration**:
   - **Site URL**: `https://SEU-SITE.netlify.app` (e em dev `http://localhost:3000`)
   - **Redirect URLs**:
     - `http://localhost:3000/login`
     - `https://SEU-SITE.netlify.app/login`
5. **Project Settings → API** → copie:
   - Project URL → `VITE_SUPABASE_URL`
   - `anon` `public` key → `VITE_SUPABASE_ANON_KEY`
6. (Opcional) **Database → Replication** → ative Realtime em `bills` e `goals`.

## 2. Ambiente local

```bash
cd Thiagofin
cp .env.example .env
# edite .env com URL e anon key
npm install
npm run dev
```

Abra http://localhost:3000 — cadastre com e-mail/senha ou use Modo Local.

## 3. Deploy no Netlify

### Opção A — Git (recomendada)

1. Envie o repositório para o GitHub (`epthiago1-eng/Thiagofin`).
2. [Netlify](https://app.netlify.com) → **Add new site** → **Import an existing project**.
3. Conecte o GitHub e o repositório.
4. Build settings (já no `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
5. **Site configuration → Environment variables** adicione:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
6. Deploy. Depois do deploy, atualize no Supabase as **Redirect URLs** com a URL Netlify.

### Opção B — CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify env:set VITE_SUPABASE_URL "https://xxx.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "eyJ..."
netlify deploy --prod
```

## 4. Checklist pós-deploy

- [ ] Schema SQL executado
- [ ] Variáveis no Netlify
- [ ] Redirect URLs no Supabase
- [ ] Cadastro e-mail funciona
- [ ] Criar conta (bill) aparece no Table Editor do Supabase
- [ ] Google OAuth (se ativado) redireciona de volta ao site

## Estrutura de dados

| Tabela         | Uso                          |
|----------------|------------------------------|
| `bills`        | Contas recorrentes + history |
| `goals`        | Metas de gasto               |
| `invitations`  | Códigos de convite           |
| `guest_access` | Convidado → dono             |

Auth: Supabase Auth (`auth.users`). RLS isola dados por usuário.
