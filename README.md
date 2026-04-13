# Sistema de Gestão de Treinos

Plataforma de gestão de treinos personalizados. Next.js 15 + React 19 + Prisma + Supabase.

## Funcionalidades

- Agenda em grade horária (05:30–22:00), diária, mensal e kanban.
- Cadastro de atletas e personais (coaches).
- Formulário de bem-estar e monitoramento (ACWR, carga, fadiga).
- Registro de dores e lesões.
- Relatórios em PDF por atleta ou coach.
- Autenticação via Supabase Auth (admin e personal trainer).

## Rodar em modo demo (sem configurar nada)

O projeto já vem com um modo demo que usa dados mock locais. Não precisa de Supabase nem banco para ver a interface.

```bash
# 1. Instalar dependências
npm install

# 2. Criar o arquivo .env a partir do exemplo
cp .env.example .env

# 3. Rodar
npm run dev
```

Abre em `http://localhost:3000`. Pula login e mostra 5 atletas fictícios + 2 coaches.

## Configurar para uso real (Supabase)

Quando for usar com dados reais:

### 1. Criar projeto Supabase

- Cria um projeto gratuito em [supabase.com](https://supabase.com).
- Em **Project Settings → API**, copia:
  - `Project URL`
  - `anon public` key
- Em **Project Settings → Database → Connection string**, copia a URL em modo **Transaction** (porta 6543).

### 2. Configurar `.env`

Edita o `.env`:

```env
NEXT_PUBLIC_DEMO_MODE="false"

DATABASE_URL="postgresql://postgres.<project>:<senha>@aws-...pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<anon-key>"
```

> ⚠️ Se a senha tiver caracteres especiais (`@`, `!`, `#`), use a versão URL-encoded (`%40`, `%21`, `%23`).

### 3. Aplicar o schema no banco

```bash
# Aplica o schema do Prisma no Supabase
npx prisma db push
```

Alternativa: rodar `supabase-setup.sql` no **SQL Editor** do Supabase para criar a tabela `profiles` e a trigger de auto-criação de perfil.

### 4. Criar primeiro admin

Depois de rodar a app com Supabase conectado:

1. Acesse `/login` e cria uma conta nova (ou usa convite por email).
2. No Supabase, vai em **Table Editor → profiles** e muda o `role` do seu usuário para `admin`.

### 5. Popular dados

Use a própria interface da aplicação para cadastrar coaches, atletas e tipos de treino. Ou rode o endpoint `/api/seed` (se incluído na sua instalação).

## Deploy (Vercel)

1. Push do projeto pro GitHub.
2. Importa no Vercel.
3. Cola as mesmas variáveis de `.env` em **Settings → Environment Variables**.
4. Build command: `prisma generate && next build` (já configurado no `package.json`).

## Estrutura principal

```
src/
├── app/
│   ├── api/           → Endpoints (atletas, coaches, sessions, reports, etc.)
│   ├── (auth)/login/  → Página de login Supabase
│   └── page.tsx       → Entrada principal (dashboard)
├── components/        → DataProvider + UI monolítica (TeamZQDesignSystemSkeleton)
├── hooks/             → use-data (contexto de dados)
├── lib/               → prisma, supabase, date-utils, monitoring (ACWR)
├── data.json          → Dados mock usados em modo demo
└── middleware.ts      → Proteção de rotas via Supabase Auth
```

## Customização

- **Nome da aplicação, logo, cores:** editar em `src/components/TeamZQDesignSystemSkeleton.tsx` e nos arquivos de layout/globals.
- **Coaches padrão:** remover do seed ou deletar via interface após primeiro login.
- **Escala de valores do formulário de bem-estar:** `wellbeingFields` em `TeamZQDesignSystemSkeleton.tsx`.

## Stack

- Next.js 15 (App Router)
- React 19
- TypeScript
- Prisma 5
- Supabase (Postgres + Auth)
- Tailwind CSS 3 + Radix UI
- html2canvas-pro + jspdf (PDF reports)

## Suporte

Este é um template. Customize à vontade.