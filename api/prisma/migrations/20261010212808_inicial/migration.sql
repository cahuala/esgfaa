-- CreateTable
CREATE TABLE "itens" (
    "colecao" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'publicado',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "criado_por" INTEGER,
    "atualizado_por" INTEGER,

    CONSTRAINT "itens_pkey" PRIMARY KEY ("colecao","id")
);

-- CreateTable
CREATE TABLE "paginas" (
    "chave" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" INTEGER,

    CONSTRAINT "paginas_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "utilizadores" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_acesso" TIMESTAMPTZ(3),
    "tentativas_falhadas" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_ate" TIMESTAMPTZ(3),
    "versao_token" INTEGER NOT NULL DEFAULT 0,
    "deve_mudar_senha" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "utilizadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papeis" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "permissoes" JSONB NOT NULL DEFAULT '[]',
    "sistema" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "papeis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atividades" (
    "id" SERIAL NOT NULL,
    "utilizador_id" INTEGER,
    "utilizador_nome" TEXT,
    "acao" TEXT NOT NULL,
    "colecao" TEXT,
    "alvo_id" TEXT,
    "alvo_titulo" TEXT,
    "detalhes" TEXT,
    "ip" TEXT,
    "agente" TEXT,
    "data" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "atividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gostos" (
    "colecao" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "visitante" TEXT NOT NULL,
    "data" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gostos_pkey" PRIMARY KEY ("colecao","item_id","visitante")
);

-- CreateTable
CREATE TABLE "comentarios" (
    "id" SERIAL NOT NULL,
    "colecao" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ip" TEXT,
    "data" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visualizacoes" (
    "colecao" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "visualizacoes_pkey" PRIMARY KEY ("colecao","item_id")
);

-- CreateTable
CREATE TABLE "visitas" (
    "id" SERIAL NOT NULL,
    "data" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitante" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "origem" TEXT,
    "dispositivo" TEXT,
    "navegador" TEXT,

    CONSTRAINT "visitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publicidade_metricas" (
    "banner_id" TEXT NOT NULL,
    "dia" DATE NOT NULL,
    "impressoes" INTEGER NOT NULL DEFAULT 0,
    "cliques" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "publicidade_metricas_pkey" PRIMARY KEY ("banner_id","dia")
);

-- CreateTable
CREATE TABLE "sessoes_revogadas" (
    "jti" TEXT NOT NULL,
    "expira" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessoes_revogadas_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE INDEX "itens_colecao_estado_idx" ON "itens"("colecao", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "utilizadores_email_key" ON "utilizadores"("email");

-- CreateIndex
CREATE INDEX "utilizadores_papel_idx" ON "utilizadores"("papel");

-- CreateIndex
CREATE INDEX "atividades_data_idx" ON "atividades"("data" DESC);

-- CreateIndex
CREATE INDEX "atividades_utilizador_id_idx" ON "atividades"("utilizador_id");

-- CreateIndex
CREATE INDEX "atividades_acao_idx" ON "atividades"("acao");

-- CreateIndex
CREATE INDEX "comentarios_colecao_item_id_idx" ON "comentarios"("colecao", "item_id");

-- CreateIndex
CREATE INDEX "comentarios_data_idx" ON "comentarios"("data" DESC);

-- CreateIndex
CREATE INDEX "visitas_data_idx" ON "visitas"("data");

-- CreateIndex
CREATE INDEX "visitas_visitante_idx" ON "visitas"("visitante");

-- CreateIndex
CREATE INDEX "sessoes_revogadas_expira_idx" ON "sessoes_revogadas"("expira");

-- AddForeignKey
ALTER TABLE "itens" ADD CONSTRAINT "itens_atualizado_por_fkey" FOREIGN KEY ("atualizado_por") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
