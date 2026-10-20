-- DropIndex
DROP INDEX "integridade_impressoes_hash_idx";

-- AlterTable
ALTER TABLE "integridade_analises" ADD COLUMN     "verificacoes" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "integridade_impressoes" DROP CONSTRAINT "integridade_impressoes_pkey",
ADD COLUMN     "tipo" SMALLINT NOT NULL DEFAULT 0,
ADD CONSTRAINT "integridade_impressoes_pkey" PRIMARY KEY ("documento_id", "tipo", "posicao");

-- CreateIndex
CREATE INDEX "integridade_impressoes_tipo_hash_idx" ON "integridade_impressoes"("tipo", "hash");

