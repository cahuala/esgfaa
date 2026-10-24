-- AlterTable
ALTER TABLE "textos_traduzidos" ADD COLUMN     "revisto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "revisto_por" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "textos_traduzidos_lingua_revisto_idx" ON "textos_traduzidos"("lingua", "revisto");

