-- Esquema do servidor de webhooks.
-- IDs de cliente e projeto são "slugs" legíveis (ex.: acme / site-vendas),
-- usados diretamente na URL de ingestão.

CREATE TABLE IF NOT EXISTS clients (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  client_id   TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  name        TEXT NOT NULL,
  secret      TEXT NOT NULL,           -- enviado no header X-Webhook-Secret
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, id)
);

CREATE TABLE IF NOT EXISTS events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  client_id   TEXT NOT NULL,
  project_id  TEXT NOT NULL,
  type        TEXT,                    -- categoria do evento (header X-Event-Type ou body.type)
  payload     JSONB NOT NULL,          -- corpo recebido
  headers     JSONB,                   -- headers relevantes (sem o segredo)
  source_ip   TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consultas típicas: eventos de um projeto, mais recentes primeiro.
CREATE INDEX IF NOT EXISTS idx_events_client_project
  ON events (client_id, project_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_type
  ON events (type);

-- Monitor de tráfego (track.js): contadores por site, sem guardar cada visita.
CREATE TABLE IF NOT EXISTS project_stats (
  client_id     TEXT NOT NULL,
  project_id    TEXT NOT NULL,
  last_seen     TIMESTAMPTZ,
  last_paid_at  TIMESTAMPTZ,
  last_free_at  TIMESTAMPTZ,
  total_paid    BIGINT NOT NULL DEFAULT 0,
  total_free    BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (client_id, project_id)
);

CREATE TABLE IF NOT EXISTS project_daily (
  client_id   TEXT NOT NULL,
  project_id  TEXT NOT NULL,
  day         DATE NOT NULL,
  paid        BIGINT NOT NULL DEFAULT 0,
  free        BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (client_id, project_id, day)
);
