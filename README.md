# LicitaGest — Plataforma de Gestão de Licitações

Plataforma completa para gestão integral de licitações públicas com análise automatizada de editais por IA.

## Stack

- **Frontend**: React + Vite (deploy na Vercel)
- **Backend**: Node.js + Express (deploy no Railway)
- **Banco**: PostgreSQL via Supabase
- **Filas**: Bull + Redis via Upstash
- **IA**: Claude API (Anthropic)
- **E-mail**: Resend
- **Arquivos**: Supabase Storage

---

## 1. Pré-requisitos

- [Node.js 20+](https://nodejs.org)
- [Git](https://git-scm.com)
- Conta no [GitHub](https://github.com)
- Conta no [Supabase](https://supabase.com)
- Conta no [Railway](https://railway.app)
- Conta na [Vercel](https://vercel.com)
- Conta no [Upstash](https://upstash.com)
- Chave de API da [Anthropic](https://console.anthropic.com)
- Conta no [Resend](https://resend.com)

---

## 2. Estrutura do repositório

Este repositório contém frontend e backend juntos:

```
licitagest-web/
├── src/                  # Frontend React
├── backend/              # Backend Node.js/Express
│   ├── src/
│   ├── migrations/       # SQL do banco de dados
│   └── Procfile
├── index.html
├── package.json          # Frontend
├── vite.config.js
└── vercel.json           # Config de deploy Vercel
```

---

## 3. Configurar o banco de dados (Supabase)

1. Acesse [supabase.com](https://supabase.com) → **New project**
2. Escolha nome, senha e região (ex: South America - São Paulo)
3. Aguarde o banco iniciar (~2 minutos)
4. Vá em **SQL Editor** → **New query**
5. Cole o conteúdo de `migrations/licitagest_migrations.sql` e clique **Run**
6. Vá em **Storage** → **New bucket** → nome: `licitagest` → marque **Public** → **Create**
7. Anote em **Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_KEY`
   - `Connection string` → `DATABASE_URL`

---

## 4. Configurar o Redis (Upstash)

1. Acesse [upstash.com](https://upstash.com) → **Create Database**
2. Nome: `licitagest-redis`, região: **São Paulo**
3. Copie a **REDIS_URL** (começa com `rediss://`)

---

## 5. Deploy do backend (Railway)

1. Acesse [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Selecione o repositório `licitagest-web`
3. Em **Settings → Root Directory** defina: `backend`
4. Railway detecta Node.js automaticamente e faz o primeiro deploy
5. Vá em **Variables** e adicione todas as variáveis abaixo:

```
DATABASE_URL=postgresql://postgres:SENHA@db.REF.supabase.co:5432/postgres
SUPABASE_URL=https://REF.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
REDIS_URL=rediss://default:SENHA@host.upstash.io:6379
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=string_aleatoria_longa_minimo_32_chars
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@seudominio.com.br
APP_URL=https://licitagest.com.br
NODE_ENV=production
PORT=3000
```

6. Vá em **Settings → Networking → Generate Domain** para obter a URL do backend
7. Anote a URL (ex: `https://licitagest-api.up.railway.app`)

> **Worker**: Para rodar o worker de filas, vá em **New Service** dentro do mesmo projeto, conecte o mesmo repositório e defina o start command como `node src/workers/edital.worker.js`

---

## 6. Deploy do frontend (Vercel)

1. Acesse [vercel.com](https://vercel.com) → **New Project**
2. Importe o repositório `licitagest-web`
3. Vercel detecta Vite automaticamente
4. Em **Environment Variables** adicione:
```
VITE_API_URL=https://licitagest-api.up.railway.app
```
5. Clique **Deploy**
6. Anote a URL gerada (ex: `https://licitagest-web.vercel.app`)

---

## 7. Criar o primeiro usuário admin

Após o banco estar configurado, execute via SQL Editor do Supabase:

```sql
-- Substitua os valores antes de executar
INSERT INTO clientes (razao_social, cnpj, email_responsavel)
VALUES ('Minha Empresa Ltda', '00.000.000/0001-00', 'admin@minhaempresa.com.br');

INSERT INTO usuarios (cliente_id, nome, email, senha_hash, role)
VALUES (
  (SELECT id FROM clientes WHERE cnpj = '00.000.000/0001-00'),
  'Administrador',
  'admin@minhaempresa.com.br',
  -- Gere o hash em: https://bcrypt-generator.com (rounds: 10)
  '$2a$10$HASH_GERADO_AQUI',
  'admin_plataforma'
);
```

Ou use o endpoint de registro (apenas na primeira vez):

```bash
curl -X POST https://licitagest-api.up.railway.app/api/auth/registro \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Administrador",
    "email": "admin@minhaempresa.com.br",
    "senha": "suasenha123",
    "razao_social": "Minha Empresa Ltda",
    "cnpj": "00.000.000/0001-00"
  }'
```

---

## 8. Apontar domínio (opcional)

### Frontend (Vercel)
Vercel → seu projeto → **Domains** → adicione seu domínio → configure o CNAME no seu provedor DNS:
```
www  CNAME  cname.vercel-dns.com
```

### Backend (Railway)
Railway → Settings → Networking → Custom Domain → adicione o subdomínio da API:
```
api  CNAME  licitagest-api.up.railway.app
```

---

## 9. Atualizar o código

A cada alteração no código:

```bash
git add .
git commit -m "fix: descrição da alteração"
git push
```

Railway e Vercel detectam o push e fazem o re-deploy automaticamente em ~2 minutos.

---

## Estrutura do projeto

```
licitagest/
├── backend/
│   ├── src/
│   │   ├── app.js                    # Entry point Express
│   │   ├── db/index.js               # Pool PostgreSQL
│   │   ├── queues/edital.queue.js    # Fila Bull
│   │   ├── routes/                   # Endpoints da API
│   │   ├── services/                 # IA, validação, notificações
│   │   ├── workers/edital.worker.js  # Processamento em background
│   │   └── middlewares/              # Auth JWT
│   ├── Procfile
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── main.jsx                  # Roteamento React
    │   ├── components/Layout.jsx     # Sidebar + navegação
    │   ├── pages/                    # Dashboard, Editais, etc.
    │   └── services/api.js           # Cliente Axios
    ├── index.html
    └── package.json
```

---

## Custo estimado (MVP)

| Serviço      | Plano       | Custo/mês   |
|--------------|-------------|-------------|
| Vercel       | Hobby       | Grátis      |
| Railway      | Starter     | ~R$ 60      |
| Supabase     | Free        | Grátis      |
| Upstash      | Free        | Grátis      |
| Resend       | Free        | Grátis      |
| Claude API   | Pay-as-you-go | ~R$ 0,50/edital |
| **Total**    |             | **~R$ 60-130/mês** |

---

## Suporte

Dúvidas sobre deploy ou configuração? Abra uma issue no repositório.
