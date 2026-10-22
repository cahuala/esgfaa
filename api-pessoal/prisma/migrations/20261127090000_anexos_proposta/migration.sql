-- CreateTable
CREATE TABLE "anexos_proposta" (
    "id" SERIAL NOT NULL,
    "proposta_id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "ficheiro" TEXT NOT NULL,
    "nome_original" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "criado_por" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anexos_proposta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anexos_proposta_proposta_id_idx" ON "anexos_proposta"("proposta_id");

-- AddForeignKey
ALTER TABLE "anexos_proposta" ADD CONSTRAINT "anexos_proposta_proposta_id_fkey" FOREIGN KEY ("proposta_id") REFERENCES "propostas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

