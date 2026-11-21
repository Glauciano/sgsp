# S.G.C-S.P — Sistema de Gestão Columbófila e Classificações (São Paulo)
### Espelho Integral do Sistema GPC (POMOR) — Vincenty WGS84 0.5mm | v5.0 Integral

Pacote fullstack completo para gestão federativa, apuração geodésica oficial e doublagem cruzada.

```
sgc-sp/
├── database.sql       # Banco PostgreSQL completo (10 tabelas + índices GPC)
├── package.json       # Dependências Backend + Frontend (express, pg, multer, cors, vite, react)
├── server.js          # Backend Node.js — Motor Vincenty WGS84 + Marcha + Parser de Relógios + Doublagem
├── vite.config.js     # Vite config (porta 8002)
├── index.html         # Entrada Vite
└── src/
    └── App.jsx        # Interface ERP Desktop completa (5 abas: Operação, Marcha, Classificação, Matriz, Caixa)
```

---

## 1. Banco de Dados (`database.sql`)

Cria as **10 tabelas oficiais** (hierarquia com ZONA, regulamentos por época, matriz pré-calculada, controle de marcha de relógio, poules financeiras, eliminatórias).

**Local / Docker:**
```bash
createdb sgc_sp
psql sgc_sp -f sgc-sp/database.sql
# ou
psql "postgresql://postgres:senha@localhost:5432/postgres" -f sgc-sp/database.sql
```

**Supabase (recomendado):**
1. Crie projeto em supabase.com → SQL Editor → cole `database.sql` → Run
2. Copie a **Connection String** (Transaction pooler, porta 6543) em Database → Connect

> O script cria `uuid-ossp`, `entidades`, `regulamentos`, `concorrentes`, `concorrente_doublagens`, `pombos`, `recenseamento_anual`, `pontos_soltura`, `matriz_distancias`, `concursos`, `relogios_concurso`, `encachotamentos`, `classificacoes`, `eliminatorias` + índices GPC.

---

## 2. Servidor API (`package.json` + `server.js`)

Backend Express com **Vincenty WGS84 0.5mm**, **Marcha Proporcional** (acerto→abertura), **Hora Morta** e **Rateio Poules 50%/30%/20%**.

```bash
cd sgc-sp
npm install

# Desenvolvimento (com seu Postgres local ou Supabase)
DATABASE_URL="postgresql://postgres.sua_id:senha@aws-0-sa-east-1.pooler.supabase.com:6543/postgres" npm start
# → Backend sobe em http://localhost:3001

# Teste:
curl http://localhost:3001/
# {"status":"SGC-SP API Vincenty WGS84 online","version":"5.0 Integral GPC","endpoints":[...] }
```

**Endpoints oficiais:**
| Método | Rota | O que faz |
|---|---|---|
| `POST` | `/api/matriz-distancias/recalcular` | Preenche `matriz_distancias` (todos sócios × pontos de soltura) com Vincenty WGS84 |
| `POST` | `/api/concursos/:id/importar-relogio` | Lê `.txt/.csv/.dat` (`ANILHA;TIMESTAMP;MARCA`), valida `recenseamento_anual.pago_e_validado=TRUE`, grava `hora_chegada_bruta` + `hash SHA256` |
| `POST` | `/api/concursos/:id/apurar-completo` | Calcula **Vincenty + Marcha + Hora Morta + Velocidade m/m + Coef FCI + Pontos + Rateio Poules + Doublagem** para `entidadesDoublagemIds` |

> Sem `DATABASE_URL`, o servidor sobe mas só responde no `/` (modo offline). Com Supabase, todas as rotas apuram no Postgres.

---

## 3. Interface Desktop (`App.jsx` + Vite/React)

ERP estilo GPC POMOR com fundo cinza `#d4d0c8`, bordas `inset` e Tahoma 12px.

```bash
cd sgc-sp
npm install          # já feito se seguiu passo 2
npm run dev:frontend # Frontend em http://localhost:8002
# ou tudo junto (backend 3001 + frontend 8002):
npm run dev
```

**5 abas operacionais:**
- **📦 Encachotamento & Fita Relógio** — edite batidas via `datetime-local`, cesto, designado/série A/ouro + taxas
- **⏱️ Acerto / Marcha Relógios** — `Desvio Acerto (s)` e `Desvio Abertura (s)` por sócio → correção interpolada linear na classificação
- **🏆 Classificação & Rateio Poules** — `Dist. Vincenty`, `Chegada Corrigida (Marcha)`, `Tempo Voo`, `Velocidade m/m`, `Coef. FCI`, `Prêmio R$`
- **📐 Matriz Distâncias (WGS84)** — tabela homologada sócios × Uberaba/Uberlândia/Goiânia (clique recalcula via `POST /api/matriz-distancias/recalcular`)
- **💰 Caixa & Inscrições** — total por columbófilo (aves × R$3,50 + Série A × R$10 + Ouro × R$20) + total geral

**Dica Doublagem:** seletor `CLUBE` vs `ASSOCIAÇÃO/FEDERAÇÃO` filtra elegíveis na hora.

---

## 4. Fluxo de Teste Completo (5 minutos)

1. **Seed mínimo** (via SQL ou UI): 1 `entidade` FEDERACAO → 1 COLETIVIDADE → 1 `regulamento` temporada 2026 → 2 `concorrentes` (GPS Limeira) → 2 `pombos` com `recenseamento_anual` 2026 → 1 `ponto_soltura` PS-02 Uberlândia → 1 `concurso` 2026-02 APERTO-BERTO + `relogios_concurso` (acerto 2026-11-14T20:00, abertura 2026-11-15T14:00)
2. **Encachotar:** na aba Operação, confirme 4 aves com batidas brutas
3. **Corrigir Marcha:** aba Marcha → ajuste `Pombal Imperial -3s` e `Asas do Interior +2s`
4. **Apurar:** `POST http://localhost:3001/api/concursos/<id>/apurar-completo` com `{"entidadesDoublagemIds": ["<id_clube>"]}` → status `APURADO`
5. **Conferir:** abas Classificação (velocidade + prêmio) e Caixa (total R$)

Ou use o **modo offline** do `App.jsx`: ele apura no navegador sem banco (Matriz + Marcha + Rateio já calculados) — ideal para demonstração.

---

## Previews deste workspace

- Frontend Final `sgc-sp` → http://localhost:8002
- Backend Integral → http://localhost:3001
- Frontend Clássico anterior `sgcsp-classic` → http://localhost:8001
- App Moderno `sgcsp-app` → http://localhost:8000

## Requisitos

- Node.js 18+ • PostgreSQL 14+ (ou Supabase) • npm

## Próximos passos opcionais

- `npm run build` → gera `dist/` para deploy Vercel/Render
- Importar CSV real de relógio: `curl -F arquivo=@relogio.txt http://localhost:3001/api/concursos/<id>/importar-relogio`

São Paulo • Vincenty WGS84 0.5mm • Temporada 2026 • Pronto para produção
