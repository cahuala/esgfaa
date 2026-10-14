-- CreateTable
CREATE TABLE "inscricoes_cadeiras" (
    "id" SERIAL NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "observacao" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'ativa',
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscricoes_cadeiras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inscricoes_cadeiras_cadeira_id_idx" ON "inscricoes_cadeiras"("cadeira_id");

-- CreateIndex
CREATE UNIQUE INDEX "inscricoes_cadeiras_estudante_id_cadeira_id_key" ON "inscricoes_cadeiras"("estudante_id", "cadeira_id");

-- AddForeignKey
ALTER TABLE "inscricoes_cadeiras" ADD CONSTRAINT "inscricoes_cadeiras_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscricoes_cadeiras" ADD CONSTRAINT "inscricoes_cadeiras_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

