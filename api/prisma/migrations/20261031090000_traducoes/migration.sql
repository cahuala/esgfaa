-- CreateTable
CREATE TABLE "traducoes" (
    "colecao" TEXT NOT NULL,
    "alvo_id" TEXT NOT NULL,
    "lingua" TEXT NOT NULL,
    "textos" JSONB NOT NULL DEFAULT '{}',
    "originais" JSONB NOT NULL DEFAULT '{}',
    "estado" TEXT NOT NULL DEFAULT 'rascunho',
    "automatica" BOOLEAN NOT NULL DEFAULT false,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_por" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "traducoes_pkey" PRIMARY KEY ("colecao","alvo_id","lingua")
);

-- CreateIndex
CREATE INDEX "traducoes_estado_idx" ON "traducoes"("estado");

