-- CreateTable
CREATE TABLE "progresso_pacotes" (
    "id" SERIAL NOT NULL,
    "material_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'iniciado',
    "nota" DECIMAL(4,2),
    "dados" JSONB NOT NULL DEFAULT '{}',
    "tempo_segundos" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progresso_pacotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "progresso_pacotes_material_id_estudante_id_key" ON "progresso_pacotes"("material_id", "estudante_id");

-- AddForeignKey
ALTER TABLE "progresso_pacotes" ADD CONSTRAINT "progresso_pacotes_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materiais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progresso_pacotes" ADD CONSTRAINT "progresso_pacotes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

