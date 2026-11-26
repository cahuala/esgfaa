-- replicação entre os sistemas separados: a fila das mudanças e até onde se trocou com cada sistema
CREATE TABLE "replicacao_fila" (
    "id" BIGSERIAL NOT NULL,
    "tabela" TEXT NOT NULL,
    "chave" JSONB NOT NULL,
    "origem" TEXT NOT NULL DEFAULT '',
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "replicacao_fila_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "replicacao_cursores" (
    "par" TEXT NOT NULL,
    "enviado" BIGINT NOT NULL DEFAULT 0,
    "recebido" BIGINT NOT NULL DEFAULT 0,
    "uploads_ate" BIGINT NOT NULL DEFAULT 0,
    "ultima_troca" TIMESTAMPTZ(3),
    "ultimo_erro" TEXT NOT NULL DEFAULT '',
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "replicacao_cursores_pkey" PRIMARY KEY ("par")
);

-- o gatilho de cada tabela replicada: regista a chave da linha que mudou e de onde veio a mudança
-- (replicacao.origem vem preenchido quando se aplicam as linhas recebidas de outro sistema)
CREATE OR REPLACE FUNCTION replicacao_registar() RETURNS trigger AS $$
DECLARE
  linha jsonb;
  chave jsonb := '{}'::jsonb;
  coluna text;
BEGIN
  IF TG_OP = 'DELETE' THEN linha := to_jsonb(OLD); ELSE linha := to_jsonb(NEW); END IF;
  FOREACH coluna IN ARRAY TG_ARGV LOOP
    chave := chave || jsonb_build_object(coluna, linha -> coluna);
  END LOOP;
  INSERT INTO replicacao_fila (tabela, chave, origem) VALUES (TG_TABLE_NAME, chave, coalesce(current_setting('replicacao.origem', true), ''));
  RETURN NULL;
END
$$ LANGUAGE plpgsql;
