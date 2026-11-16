-- Contas automáticas dos civis da Direcção de Ensino (vêm do Sistema de Gestão de Pessoal e entram com o BI).
ALTER TABLE "utilizadores" ADD COLUMN "pessoal_ref" TEXT;
ALTER TABLE "utilizadores" ADD COLUMN "bi_hash" TEXT;
CREATE UNIQUE INDEX "utilizadores_pessoal_ref_key" ON "utilizadores"("pessoal_ref");
CREATE UNIQUE INDEX "utilizadores_bi_hash_key" ON "utilizadores"("bi_hash");
