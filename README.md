# FinTrack

App de gestão financeira (contas recorrentes, gastos, metas e lembretes).

**Stack:** React + Vite + TypeScript · **Supabase** (Auth + PostgreSQL) · deploy **Netlify**

## Início rápido

```bash
npm install
cp .env.example .env   # preencha URL e anon key do Supabase
npm run dev
```

Guia completo de Supabase + Netlify: **[DEPLOY.md](./DEPLOY.md)**  
Schema SQL: **[supabase/schema.sql](./supabase/schema.sql)**

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Desenvolvimento em http://localhost:3000 |
| `npm run build` | Build de produção (`dist/`) |
| `npm run preview` | Preview do build |
| `npm run lint` | Typecheck |

## Recursos

- Contas recorrentes com dia de vencimento e aviso
- Lembretes no app + Google/Apple Calendar
- Metas de gasto, dashboard e gráficos
- Convites de convidado (view/edit)
- Modo Local (sem backend) para testes de UI
