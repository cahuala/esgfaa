-- AlterTable
ALTER TABLE "avaliacoes_uc" ADD COLUMN     "peso" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "planos_curso" ADD COLUMN     "duracao_meses" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "exigir_tii" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "exigir_ucs" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "factores_juizo" TEXT[] DEFAULT ARRAY[]::TEXT[];

