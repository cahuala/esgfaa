-- DropForeignKey
ALTER TABLE "avaliacoes" DROP CONSTRAINT "avaliacoes_cadeira_id_fkey";

-- DropForeignKey
ALTER TABLE "notas" DROP CONSTRAINT "notas_avaliacao_id_fkey";

-- DropForeignKey
ALTER TABLE "notas" DROP CONSTRAINT "notas_estudante_id_fkey";

-- AlterTable
ALTER TABLE "unidades_curriculares" ADD COLUMN     "notas_publicadas" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- DropTable
DROP TABLE "avaliacoes";

-- DropTable
DROP TABLE "notas";

-- CreateTable
CREATE TABLE "pautas" (
    "cadeira_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "p1" DECIMAL(4,2),
    "p2" DECIMAL(4,2),
    "exame" DECIMAL(4,2),
    "recurso" DECIMAL(4,2),
    "observacao" TEXT NOT NULL DEFAULT '',
    "atualizada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pautas_pkey" PRIMARY KEY ("cadeira_id","estudante_id")
);

-- CreateIndex
CREATE INDEX "pautas_estudante_id_idx" ON "pautas"("estudante_id");

-- AddForeignKey
ALTER TABLE "pautas" ADD CONSTRAINT "pautas_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pautas" ADD CONSTRAINT "pautas_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

