-- CreateTable
CREATE TABLE "integridade_documentos" (
    "id" SERIAL NOT NULL,
    "origem" TEXT NOT NULL,
    "origem_id" TEXT,
    "titulo" TEXT NOT NULL,
    "autor" TEXT NOT NULL DEFAULT '',
    "contexto" TEXT NOT NULL DEFAULT '',
    "texto" TEXT NOT NULL,
    "palavras" INTEGER NOT NULL DEFAULT 0,
    "fonte" BOOLEAN NOT NULL DEFAULT true,
    "conta_id" INTEGER,
    "pedido_por" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integridade_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integridade_impressoes" (
    "documento_id" INTEGER NOT NULL,
    "posicao" INTEGER NOT NULL,
    "hash" INTEGER NOT NULL,

    CONSTRAINT "integridade_impressoes_pkey" PRIMARY KEY ("documento_id","posicao")
);

-- CreateTable
CREATE TABLE "integridade_analises" (
    "id" SERIAL NOT NULL,
    "documento_id" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "percentagem" DECIMAL(5,1),
    "fontes" JSONB NOT NULL DEFAULT '[]',
    "trechos" JSONB NOT NULL DEFAULT '[]',
    "opcoes" JSONB NOT NULL DEFAULT '{}',
    "erro" TEXT NOT NULL DEFAULT '',
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluida_em" TIMESTAMPTZ(3),

    CONSTRAINT "integridade_analises_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integridade_documentos_conta_id_idx" ON "integridade_documentos"("conta_id");

-- CreateIndex
CREATE UNIQUE INDEX "integridade_documentos_origem_origem_id_key" ON "integridade_documentos"("origem", "origem_id");

-- CreateIndex
CREATE INDEX "integridade_impressoes_hash_idx" ON "integridade_impressoes"("hash");

-- CreateIndex
CREATE INDEX "integridade_analises_documento_id_idx" ON "integridade_analises"("documento_id");

-- CreateIndex
CREATE INDEX "integridade_analises_estado_idx" ON "integridade_analises"("estado");

-- AddForeignKey
ALTER TABLE "integridade_impressoes" ADD CONSTRAINT "integridade_impressoes_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "integridade_documentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integridade_analises" ADD CONSTRAINT "integridade_analises_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "integridade_documentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

