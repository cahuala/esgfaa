-- CreateTable
CREATE TABLE "dois_fatores" (
    "id" SERIAL NOT NULL,
    "utilizador_id" INTEGER NOT NULL,
    "segredo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT false,
    "ultimo_contador" INTEGER NOT NULL DEFAULT -1,
    "recuperacao" JSONB NOT NULL DEFAULT '[]',
    "ativado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dois_fatores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dois_fatores_utilizador_id_key" ON "dois_fatores"("utilizador_id");

-- AddForeignKey
ALTER TABLE "dois_fatores" ADD CONSTRAINT "dois_fatores_utilizador_id_fkey" FOREIGN KEY ("utilizador_id") REFERENCES "utilizadores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

