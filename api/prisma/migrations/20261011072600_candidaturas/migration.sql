-- CreateTable
CREATE TABLE "candidaturas" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'recebida',
    "notas" TEXT NOT NULL DEFAULT '',
    "ip" TEXT,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizada_por" INTEGER,

    CONSTRAINT "candidaturas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidaturas_codigo_key" ON "candidaturas"("codigo");

-- CreateIndex
CREATE INDEX "candidaturas_estado_idx" ON "candidaturas"("estado");

-- CreateIndex
CREATE INDEX "candidaturas_curso_idx" ON "candidaturas"("curso");

-- CreateIndex
CREATE INDEX "candidaturas_email_idx" ON "candidaturas"("email");

-- CreateIndex
CREATE INDEX "candidaturas_criada_em_idx" ON "candidaturas"("criada_em" DESC);
