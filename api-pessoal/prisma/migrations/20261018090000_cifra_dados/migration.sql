-- DropIndex
DROP INDEX "pessoas_bi_key";

-- AlterTable
ALTER TABLE "pessoas" ADD COLUMN     "bi_indice" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "pessoas_bi_indice_key" ON "pessoas"("bi_indice");

