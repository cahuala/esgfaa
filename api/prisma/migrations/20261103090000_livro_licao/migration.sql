-- AlterTable
ALTER TABLE "materiais" ADD COLUMN     "estrutura" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "progresso_licoes" (
    "id" SERIAL NOT NULL,
    "material_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "pagina" TEXT NOT NULL DEFAULT '',
    "respostas" JSONB NOT NULL DEFAULT '{}',
    "visitas" INTEGER NOT NULL DEFAULT 1,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "nota" DECIMAL(4,2),
    "melhor_nota" DECIMAL(4,2),
    "atualizada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progresso_licoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "progresso_licoes_material_id_estudante_id_key" ON "progresso_licoes"("material_id", "estudante_id");

-- AddForeignKey
ALTER TABLE "progresso_licoes" ADD CONSTRAINT "progresso_licoes_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materiais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progresso_licoes" ADD CONSTRAINT "progresso_licoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

