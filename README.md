# Webhook Monitor

Servidor de webhooks multi-projeto rodando em **Vercel** (funções serverless) com
**Neon** (Postgres). Cada sistema seu manda eventos para uma URL própria; tudo fica
guardado e consultável, separado por **cliente** e **projeto**.

## Como os IDs funcionam

Cada projeto tem uma URL de ingestão no formato:

```
POST https://SEU-APP.vercel.app/api/ingest/{cliente}/{projeto}
```

- `{cliente}` e `{projeto}` são "slugs" legíveis (`[a-z0-9-]`), ex.: `acme` / `site-vendas`.
- A autenticação é por **segredo por projeto**, enviado no header `X-Webhook-Secret`.
  O ID sozinho não dá acesso — assim você pode revogar/rotacionar um projeto sem
  mudar a URL, e os IDs continuam visíveis nos logs para você saber de quem veio.

## Estrutura

```
api/
  ingest/[client]/[project].ts   POST  recebe e grava um evento (auth: X-Webhook-Secret)
  events.ts                      GET   consulta eventos          (auth: Bearer ADMIN_TOKEN)
  clients.ts                     GET/POST  lista/cria clientes    (auth: Bearer ADMIN_TOKEN)
  projects.ts                    GET/POST  lista/cria projetos    (auth: Bearer ADMIN_TOKEN)
  migrate.ts                     POST  cria o esquema no banco    (auth: Bearer ADMIN_TOKEN)
  health.ts                      GET   status + conexão do banco
lib/
  db.ts, http.ts, schema.sql
```

## Configuração

1. Crie um projeto no Neon e copie a **pooled connection string**.
2. No painel da Vercel, defina as variáveis de ambiente (veja `.env.example`):
   - `DATABASE_URL` — connection string do Neon
   - `ADMIN_TOKEN` — token forte (`openssl rand -base64 32`)
3. Faça deploy (`vercel` ou via Git). O runtime é Node/TypeScript nativo da Vercel.

## Uso

Todos os exemplos usam `ADMIN` = valor de `ADMIN_TOKEN` e `APP` = URL do deploy.

### 1. Rodar a migração (uma vez)

```bash
curl -X POST "$APP/api/migrate" -H "Authorization: Bearer $ADMIN"
```

### 2. Criar um cliente

```bash
curl -X POST "$APP/api/clients" -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"id":"acme","name":"Acme Ltda"}'
```

### 3. Criar um projeto (retorna o segredo e a URL — guarde o segredo)

```bash
curl -X POST "$APP/api/projects" -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"client":"acme","id":"site-vendas","name":"Site de Vendas"}'
```

### 4. Enviar um evento (é isso que seus sistemas fazem)

```bash
curl -X POST "$APP/api/ingest/acme/site-vendas" \
  -H "X-Webhook-Secret: <segredo-do-projeto>" \
  -H "X-Event-Type: order.paid" \
  -H "Content-Type: application/json" \
  -d '{"order_id":123,"total":49.9}'
```

Resposta: `202` com `event_id`. O `type` vem do header `X-Event-Type` ou do campo
`type` no corpo.

### 5. Consultar eventos

```bash
curl "$APP/api/events?client=acme&project=site-vendas&limit=20" \
  -H "Authorization: Bearer $ADMIN"
```

Filtros: `client`, `project`, `type`, `limit` (1–200), `before` (paginação por id).

## Monitor de sites (tráfego pago × grátis)

Para saber se seus sites estão recebendo acesso — e se é tráfego pago ou orgânico —
sem armazenar cada visita, use o pixel `track.js`. Ele atualiza apenas contadores
por site (última visita, total pago/grátis e o total de hoje).

1. Cadastre o site como um projeto (`POST /api/projects`).
2. Cole o snippet em cada página do site:

   ```html
   <script src="https://SEU-APP.vercel.app/track.js"
           data-client="acme" data-project="site-vendas"></script>
   ```

3. Acompanhe em **`/sites`** — um card por site, ao vivo (atualiza a cada 15s),
   com bolinha verde quando houve visita nos últimos 10 min.

Classificação **pago**: presença de `gclid`/`gbraid`/`wbraid` (Google Ads),
`msclkid` (Bing), `ttclid` (TikTok), `twclid` (X) ou `utm_medium` de mídia paga
(`cpc`, `ppc`, `paid`, `display`, ...). Qualquer outra origem conta como **grátis**.

O endpoint `POST /api/track/{cliente}/{projeto}` é **público** (roda no navegador,
por isso não usa segredo) e só contabiliza sites já cadastrados e ativos.

## Segurança

- Ingestão: segredo por projeto (`X-Webhook-Secret`), comparado em tempo constante.
- Gestão/consulta: `Authorization: Bearer <ADMIN_TOKEN>`.
- O segredo do projeto só é exibido na criação; não fica exposto na listagem.
- Headers sensíveis (`x-webhook-secret`, `authorization`, `cookie`) não são gravados.
