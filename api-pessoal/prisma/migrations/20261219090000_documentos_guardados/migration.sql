-- Secretária digital de cada conta: os documentos que a pessoa guarda (por pastas) para abrir quando precisar
CREATE TABLE "documentos_guardados" (
    "id" SERIAL NOT NULL,
    "utilizador_id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "pasta" TEXT NOT NULL DEFAULT '',
    "ficheiro" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documentos_guardados_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "documentos_guardados_utilizador_id_idx" ON "documentos_guardados"("utilizador_id");
ALTER TABLE "documentos_guardados" ADD CONSTRAINT "documentos_guardados_utilizador_id_fkey" FOREIGN KEY ("utilizador_id") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
