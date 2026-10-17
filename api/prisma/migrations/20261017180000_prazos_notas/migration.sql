-- CreateTable
CREATE TABLE "prazos_notas" (
    "id" SERIAL NOT NULL,
    "componente" TEXT NOT NULL,
    "inicio" TEXT NOT NULL,
    "fim" TEXT NOT NULL,
    "turma_id" INTEGER,
    "cadeira_id" INTEGER,
    "descricao" TEXT NOT NULL DEFAULT '',
    "criado_por" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prazos_notas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prazos_notas_componente_idx" ON "prazos_notas"("componente");

-- AddForeignKey
ALTER TABLE "prazos_notas" ADD CONSTRAINT "prazos_notas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prazos_notas" ADD CONSTRAINT "prazos_notas_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

