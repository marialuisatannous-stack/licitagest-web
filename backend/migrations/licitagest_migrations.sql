-- ============================================================
--  LicitaGest — Script de criação do banco de dados
--  Compatível com Supabase (PostgreSQL 15+)
--  Cole este arquivo no SQL Editor do Supabase e execute.
-- ============================================================

-- Extensão para UUIDs automáticos
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TIPOS ENUM
-- ============================================================

CREATE TYPE status_usuario      AS ENUM ('ativo', 'inativo', 'suspenso');
CREATE TYPE role_usuario        AS ENUM ('admin_plataforma', 'gestor_cliente', 'operador');
CREATE TYPE status_edital       AS ENUM ('aguardando', 'processando', 'analisado', 'em_andamento', 'encerrado', 'cancelado');
CREATE TYPE modalidade_edital   AS ENUM ('pregao_eletronico', 'pregao_presencial', 'concorrencia', 'tomada_precos', 'convite', 'leilao', 'rdc');
CREATE TYPE tipo_prazo          AS ENUM ('entrega_proposta', 'sessao_publica', 'recurso', 'contrato', 'habilitacao', 'abertura_envelopes', 'inicio_execucao');
CREATE TYPE resultado_validacao AS ENUM ('ok', 'vencido', 'vencendo', 'faltando', 'pendente_revisao');
CREATE TYPE status_validade_doc AS ENUM ('valido', 'vencendo', 'vencido', 'sem_validade');
CREATE TYPE canal_notificacao   AS ENUM ('email', 'sms', 'push', 'sistema');
CREATE TYPE tipo_notificacao    AS ENUM ('doc_faltando', 'doc_vencendo', 'doc_vencido', 'lembrete_prazo', 'prazo_urgente', 'analise_concluida');
CREATE TYPE status_envio        AS ENUM ('agendado', 'enviado', 'falhou', 'cancelado');
CREATE TYPE status_analise_ia   AS ENUM ('processando', 'concluido', 'falhou');

-- ============================================================
-- TABELA: clientes
-- ============================================================

CREATE TABLE clientes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social        TEXT        NOT NULL,
  cnpj                VARCHAR(18) NOT NULL UNIQUE,
  email_responsavel   TEXT        NOT NULL,
  telefone            VARCHAR(20),
  segmento            TEXT,
  status              TEXT        NOT NULL DEFAULT 'ativo',
  observacoes         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clientes_cnpj   ON clientes (cnpj);
CREATE INDEX idx_clientes_status ON clientes (status);

-- ============================================================
-- TABELA: usuarios
-- ============================================================

CREATE TABLE usuarios (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    UUID          REFERENCES clientes (id) ON DELETE CASCADE,
  nome          TEXT          NOT NULL,
  email         TEXT          NOT NULL UNIQUE,
  senha_hash    TEXT          NOT NULL,
  role          role_usuario  NOT NULL DEFAULT 'operador',
  ativo         BOOLEAN       NOT NULL DEFAULT TRUE,
  ultimo_acesso TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_cliente ON usuarios (cliente_id);
CREATE INDEX idx_usuarios_email   ON usuarios (email);

-- ============================================================
-- TABELA: tipos_documento
-- (catálogo de tipos de documentos conhecidos)
-- ============================================================

CREATE TABLE tipos_documento (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                 TEXT    NOT NULL UNIQUE,
  descricao            TEXT,
  categoria            TEXT,   -- fiscal | juridico | tecnico | economico | trabalhista
  validade_padrao_dias INTEGER,
  obrigatorio_padrao   BOOLEAN NOT NULL DEFAULT FALSE,
  ativo                BOOLEAN NOT NULL DEFAULT TRUE
);

-- Seed: tipos comuns em licitações
INSERT INTO tipos_documento (nome, categoria, validade_padrao_dias, obrigatorio_padrao) VALUES
  ('Contrato Social / Estatuto',         'juridico',     NULL, TRUE),
  ('Cartão CNPJ',                        'juridico',     30,   TRUE),
  ('CND Federal (Receita Federal)',       'fiscal',       180,  TRUE),
  ('CND Estadual',                       'fiscal',       180,  TRUE),
  ('CND Municipal',                      'fiscal',       180,  TRUE),
  ('Certidão FGTS (Caixa Econômica)',    'trabalhista',  30,   TRUE),
  ('Certidão de Débitos Trabalhistas',   'trabalhista',  180,  TRUE),
  ('Balanço Patrimonial',                'economico',    365,  TRUE),
  ('Atestado de Capacidade Técnica',     'tecnico',      NULL, FALSE),
  ('Alvará de Funcionamento',            'juridico',     365,  TRUE),
  ('Certidão de Falência e Concordata',  'juridico',     60,   FALSE),
  ('Apólice de Seguro de Responsabilidade', 'economico', 365,  FALSE),
  ('Registro no CREA / CRM / CRO',       'tecnico',      365,  FALSE),
  ('Declaração de Microempresa (ME/EPP)','juridico',     NULL, FALSE);

-- ============================================================
-- TABELA: documentos_cliente
-- (documentos cadastrados por cliente)
-- ============================================================

CREATE TABLE documentos_cliente (
  id               UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID                  NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
  tipo_documento_id UUID                 REFERENCES tipos_documento (id),
  nome             TEXT                  NOT NULL,
  arquivo_url      TEXT,
  data_emissao     DATE,
  data_validade    DATE,
  status_validade  status_validade_doc   NOT NULL DEFAULT 'valido',
  observacoes      TEXT,
  created_at       TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_docs_cliente    ON documentos_cliente (cliente_id);
CREATE INDEX idx_docs_validade   ON documentos_cliente (data_validade);
CREATE INDEX idx_docs_status     ON documentos_cliente (status_validade);

-- ============================================================
-- TABELA: editais
-- ============================================================

CREATE TABLE editais (
  id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id          UUID                NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
  numero_edital       TEXT                NOT NULL,
  orgao               TEXT                NOT NULL,
  objeto              TEXT,
  modalidade          modalidade_edital,
  valor_estimado      NUMERIC(15, 2),
  status              status_edital        NOT NULL DEFAULT 'aguardando',
  arquivo_original_url TEXT,
  conteudo_extraido   TEXT,
  requisitos_ia       JSONB,              -- JSON estruturado retornado pelo LLM
  conformidade_pct    INTEGER,            -- 0-100, calculado na validação
  created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

  UNIQUE (cliente_id, numero_edital)
);

CREATE INDEX idx_editais_cliente ON editais (cliente_id);
CREATE INDEX idx_editais_status  ON editais (status);
CREATE INDEX idx_editais_req_ia  ON editais USING GIN (requisitos_ia);

-- ============================================================
-- TABELA: requisitos_edital
-- (documentos exigidos, extraídos do edital pela IA)
-- ============================================================

CREATE TABLE requisitos_edital (
  id                       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  edital_id                UUID    NOT NULL REFERENCES editais (id) ON DELETE CASCADE,
  tipo_documento_id        UUID    REFERENCES tipos_documento (id),
  nome_documento           TEXT    NOT NULL,
  categoria                TEXT,
  obrigatorio              BOOLEAN NOT NULL DEFAULT TRUE,
  descricao_original       TEXT,   -- trecho do edital de onde foi extraído
  confirmado_manualmente   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_req_edital ON requisitos_edital (edital_id);

-- ============================================================
-- TABELA: prazos_edital
-- ============================================================

CREATE TABLE prazos_edital (
  id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  edital_id   UUID            NOT NULL REFERENCES editais (id) ON DELETE CASCADE,
  tipo_prazo  tipo_prazo      NOT NULL,
  data_hora   TIMESTAMPTZ     NOT NULL,
  descricao   TEXT,
  notificado  BOOLEAN         NOT NULL DEFAULT FALSE,
  concluido   BOOLEAN         NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prazos_edital    ON prazos_edital (edital_id);
CREATE INDEX idx_prazos_data_hora ON prazos_edital (data_hora);
CREATE INDEX idx_prazos_notif     ON prazos_edital (notificado) WHERE notificado = FALSE;

-- ============================================================
-- TABELA: validacoes_edital
-- (resultado do cruzamento requisito × documento do cliente)
-- ============================================================

CREATE TABLE validacoes_edital (
  id                       UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  edital_id                UUID                  NOT NULL REFERENCES editais (id) ON DELETE CASCADE,
  requisito_id             UUID                  REFERENCES requisitos_edital (id),
  documento_cliente_id     UUID                  REFERENCES documentos_cliente (id),
  tipo_documento_exigido   TEXT                  NOT NULL,
  resultado                resultado_validacao   NOT NULL DEFAULT 'pendente_revisao',
  observacao               TEXT,
  validado_por             UUID                  REFERENCES usuarios (id),
  validado_em              TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_val_edital    ON validacoes_edital (edital_id);
CREATE INDEX idx_val_resultado ON validacoes_edital (resultado);

-- ============================================================
-- TABELA: analises_ia
-- (log de cada chamada ao LLM)
-- ============================================================

CREATE TABLE analises_ia (
  id             UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  edital_id      UUID               NOT NULL REFERENCES editais (id) ON DELETE CASCADE,
  modelo_usado   TEXT               NOT NULL DEFAULT 'claude-sonnet-4-6',
  resultado_raw  JSONB,
  tokens_usados  INTEGER,
  tentativas     INTEGER            NOT NULL DEFAULT 1,
  status         status_analise_ia  NOT NULL DEFAULT 'processando',
  erro_mensagem  TEXT,
  created_at     TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ia_edital ON analises_ia (edital_id);
CREATE INDEX idx_ia_status ON analises_ia (status);

-- ============================================================
-- TABELA: notificacoes
-- ============================================================

CREATE TABLE notificacoes (
  id           UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id   UUID                 NOT NULL REFERENCES clientes (id) ON DELETE CASCADE,
  edital_id    UUID                 REFERENCES editais (id) ON DELETE SET NULL,
  prazo_id     UUID                 REFERENCES prazos_edital (id) ON DELETE SET NULL,
  tipo         tipo_notificacao     NOT NULL,
  canal        canal_notificacao    NOT NULL,
  assunto      TEXT,
  mensagem     TEXT,
  status_envio status_envio         NOT NULL DEFAULT 'agendado',
  enviado_em   TIMESTAMPTZ,
  agendar_para TIMESTAMPTZ,
  created_at   TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_cliente      ON notificacoes (cliente_id);
CREATE INDEX idx_notif_status       ON notificacoes (status_envio);
CREATE INDEX idx_notif_agendar_para ON notificacoes (agendar_para) WHERE status_envio = 'agendado';

-- ============================================================
-- TRIGGER: atualiza updated_at automaticamente
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_documentos_updated_at
  BEFORE UPDATE ON documentos_cliente
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_editais_updated_at
  BEFORE UPDATE ON editais
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- TRIGGER: recalcula status_validade dos documentos
-- ============================================================

CREATE OR REPLACE FUNCTION recalcular_status_validade()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.data_validade IS NULL THEN
    NEW.status_validade = 'sem_validade';
  ELSIF NEW.data_validade < CURRENT_DATE THEN
    NEW.status_validade = 'vencido';
  ELSIF NEW.data_validade <= CURRENT_DATE + INTERVAL '15 days' THEN
    NEW.status_validade = 'vencendo';
  ELSE
    NEW.status_validade = 'valido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_doc_status_validade
  BEFORE INSERT OR UPDATE ON documentos_cliente
  FOR EACH ROW EXECUTE FUNCTION recalcular_status_validade();

-- ============================================================
-- VIEW: painel_clientes
-- (resumo usado no dashboard)
-- ============================================================

CREATE VIEW painel_clientes AS
SELECT
  c.id,
  c.razao_social,
  c.cnpj,
  c.email_responsavel,
  c.status,
  COUNT(DISTINCT e.id)  FILTER (WHERE e.status NOT IN ('encerrado','cancelado')) AS editais_ativos,
  COUNT(DISTINCT d.id)  FILTER (WHERE d.status_validade = 'vencido')             AS docs_vencidos,
  COUNT(DISTINCT d.id)  FILTER (WHERE d.status_validade = 'vencendo')            AS docs_vencendo,
  COUNT(DISTINCT d.id)  FILTER (WHERE d.status_validade = 'valido')              AS docs_validos
FROM clientes c
LEFT JOIN editais           e ON e.cliente_id = c.id
LEFT JOIN documentos_cliente d ON d.cliente_id = c.id
GROUP BY c.id, c.razao_social, c.cnpj, c.email_responsavel, c.status;

-- ============================================================
-- VIEW: proximos_prazos
-- (alimenta a agenda)
-- ============================================================

CREATE VIEW proximos_prazos AS
SELECT
  p.id,
  p.edital_id,
  p.tipo_prazo,
  p.data_hora,
  p.descricao,
  p.notificado,
  e.numero_edital,
  e.orgao,
  c.id            AS cliente_id,
  c.razao_social  AS cliente_nome,
  CASE
    WHEN p.data_hora < NOW()                        THEN 'atrasado'
    WHEN p.data_hora < NOW() + INTERVAL '24 hours' THEN 'urgente'
    WHEN p.data_hora < NOW() + INTERVAL '7 days'   THEN 'proximo'
    ELSE 'normal'
  END AS urgencia
FROM prazos_edital p
JOIN editais  e ON e.id = p.edital_id
JOIN clientes c ON c.id = e.cliente_id
WHERE p.concluido = FALSE
ORDER BY p.data_hora ASC;

-- ============================================================
-- ROW LEVEL SECURITY (Supabase)
-- Cada cliente só enxerga seus próprios dados.
-- ============================================================

ALTER TABLE clientes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE editais            ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE prazos_edital      ENABLE ROW LEVEL SECURITY;
ALTER TABLE validacoes_edital  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes       ENABLE ROW LEVEL SECURITY;

-- Política: usuário autenticado só vê dados do seu cliente_id
-- (o cliente_id do usuário logado fica no JWT como claim)

CREATE POLICY pol_clientes_proprios ON clientes
  FOR ALL USING (id = (current_setting('request.jwt.claims', TRUE)::jsonb->>'cliente_id')::uuid);

CREATE POLICY pol_editais_proprios ON editais
  FOR ALL USING (cliente_id = (current_setting('request.jwt.claims', TRUE)::jsonb->>'cliente_id')::uuid);

CREATE POLICY pol_docs_proprios ON documentos_cliente
  FOR ALL USING (cliente_id = (current_setting('request.jwt.claims', TRUE)::jsonb->>'cliente_id')::uuid);

CREATE POLICY pol_prazos_proprios ON prazos_edital
  FOR ALL USING (
    edital_id IN (
      SELECT id FROM editais
      WHERE cliente_id = (current_setting('request.jwt.claims', TRUE)::jsonb->>'cliente_id')::uuid
    )
  );

CREATE POLICY pol_validacoes_proprias ON validacoes_edital
  FOR ALL USING (
    edital_id IN (
      SELECT id FROM editais
      WHERE cliente_id = (current_setting('request.jwt.claims', TRUE)::jsonb->>'cliente_id')::uuid
    )
  );

CREATE POLICY pol_notificacoes_proprias ON notificacoes
  FOR ALL USING (cliente_id = (current_setting('request.jwt.claims', TRUE)::jsonb->>'cliente_id')::uuid);

-- ============================================================
-- FIM DO SCRIPT
-- Tabelas criadas:
--   clientes, usuarios, tipos_documento, documentos_cliente,
--   editais, requisitos_edital, prazos_edital,
--   validacoes_edital, analises_ia, notificacoes
-- Views:
--   painel_clientes, proximos_prazos
-- Triggers:
--   set_updated_at, recalcular_status_validade
-- ============================================================
