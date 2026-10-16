-- AlterTable
ALTER TABLE "trabalhos" ADD COLUMN     "anonimo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notas_libertadas_em" TIMESTAMPTZ(3),
ADD COLUMN     "notas_ocultas" BOOLEAN NOT NULL DEFAULT false;

