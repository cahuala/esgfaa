-- AlterTable
ALTER TABLE "contas_portal" ADD COLUMN     "token_calendario" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "contas_portal_token_calendario_key" ON "contas_portal"("token_calendario");

