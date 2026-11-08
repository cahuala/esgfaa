-- sessões abertas (uma por entrada): inactividade, navegador, terminar uma a uma
CREATE TABLE "sessoes" (
    "id" TEXT NOT NULL,
    "utilizador_id" INTEGER NOT NULL,
    "versao" INTEGER NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "navegador" TEXT NOT NULL DEFAULT '',
    "criada_em" TIMESTAMPTZ(3) NOT NULL,
    "usada_em" TIMESTAMPTZ(3) NOT NULL,
    "terminada_em" TIMESTAMPTZ(3),
    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sessoes_utilizador_id_idx" ON "sessoes"("utilizador_id");
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_utilizador_id_fkey" FOREIGN KEY ("utilizador_id") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
