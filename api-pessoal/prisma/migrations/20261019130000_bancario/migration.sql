-- AlterTable
ALTER TABLE "pessoas" ADD COLUMN     "banco" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "iban" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "numero_conta" TEXT NOT NULL DEFAULT '';

