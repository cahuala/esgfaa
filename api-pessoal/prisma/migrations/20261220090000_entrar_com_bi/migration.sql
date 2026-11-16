-- Os civis da Repartição de Pessoal e Quadros entram com o BI: guarda-se só a impressão (HMAC) do BI.
ALTER TABLE "utilizadores" ADD COLUMN "bi_hash" TEXT;
CREATE UNIQUE INDEX "utilizadores_bi_hash_key" ON "utilizadores"("bi_hash");
