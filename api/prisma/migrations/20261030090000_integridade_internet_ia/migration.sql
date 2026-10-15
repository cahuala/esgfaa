-- AlterTable
ALTER TABLE "integridade_analises" ADD COLUMN     "ia" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "internet" JSONB NOT NULL DEFAULT '{}';

