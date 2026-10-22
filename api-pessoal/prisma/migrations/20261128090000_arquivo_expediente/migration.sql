-- AlterTable
ALTER TABLE "expedientes" ADD COLUMN     "armario" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "arquivado_em" TIMESTAMPTZ(3),
ADD COLUMN     "pasta" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "prateleira" TEXT NOT NULL DEFAULT '';

