-- AlterTable
ALTER TABLE "utilizadores" ADD COLUMN     "privacidade_em" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "pedidos_dados" (
    "id" SERIAL NOT NULL,
    "conta_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "resposta" TEXT NOT NULL DEFAULT '',
    "respondido_por" TEXT NOT NULL DEFAULT '',
    "respondido_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedidos_dados_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pedidos_dados_estado_idx" ON "pedidos_dados"("estado");

-- AddForeignKey
ALTER TABLE "pedidos_dados" ADD CONSTRAINT "pedidos_dados_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AlterTable
ALTER TABLE "contas_portal" ADD COLUMN     "privacidade_em" TIMESTAMPTZ(3);

