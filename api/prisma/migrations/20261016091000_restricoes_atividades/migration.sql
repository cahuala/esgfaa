-- AlterTable
ALTER TABLE "questionarios" ADD COLUMN     "disponivel_de" TIMESTAMPTZ(3),
ADD COLUMN     "requisitos" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "visivel" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "trabalhos" ADD COLUMN     "disponivel_de" TIMESTAMPTZ(3),
ADD COLUMN     "requisitos" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "visivel" BOOLEAN NOT NULL DEFAULT true;

