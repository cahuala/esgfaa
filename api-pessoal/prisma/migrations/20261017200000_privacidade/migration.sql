-- AlterTable
ALTER TABLE "utilizadores" ADD COLUMN     "privacidade_em" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "pedidos_dados" (
    "id" SERIAL NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "resposta" TEXT NOT NULL DEFAULT '',
    "respondido_por" TEXT NOT NULL DEFAULT '',
    "respondido_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedidos_dados_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pedidos_dados" ADD CONSTRAINT "pedidos_dados_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

