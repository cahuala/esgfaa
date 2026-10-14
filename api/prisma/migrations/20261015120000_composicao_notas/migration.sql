-- CreateTable
CREATE TABLE "composicoes_nota" (
    "cadeira_id" INTEGER NOT NULL,
    "componente" TEXT NOT NULL,
    "itens" JSONB NOT NULL,
    "alterada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "composicoes_nota_pkey" PRIMARY KEY ("cadeira_id","componente")
);

-- AddForeignKey
ALTER TABLE "composicoes_nota" ADD CONSTRAINT "composicoes_nota_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

