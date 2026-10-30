-- AlterTable
ALTER TABLE "contas_portal" ADD COLUMN     "verificado_em" TIMESTAMPTZ(3),
ADD COLUMN     "verificado_por" TEXT;

-- CreateTable
CREATE TABLE "enunciados_prova" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "data" TEXT,
    "ficheiro_id" TEXT NOT NULL,
    "copias" INTEGER NOT NULL,
    "observacoes" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'enviado',
    "enviado_por" INTEGER,
    "enviado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impresso_por" TEXT NOT NULL DEFAULT '',
    "impresso_em" TIMESTAMPTZ(3),

    CONSTRAINT "enunciados_prova_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_alteracao_nota" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "avaliacao_id" INTEGER,
    "componente" TEXT,
    "estudante_id" INTEGER NOT NULL,
    "nota_atual" DOUBLE PRECISION,
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "pedido_por" INTEGER NOT NULL,
    "pedido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidido_por" TEXT NOT NULL DEFAULT '',
    "decidido_em" TIMESTAMPTZ(3),
    "fundamento" TEXT NOT NULL DEFAULT '',
    "nota_nova" DOUBLE PRECISION,
    "usado_em" TIMESTAMPTZ(3),

    CONSTRAINT "pedidos_alteracao_nota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enunciados_prova_ficheiro_id_key" ON "enunciados_prova"("ficheiro_id");

-- CreateIndex
CREATE INDEX "enunciados_prova_estado_enviado_em_idx" ON "enunciados_prova"("estado", "enviado_em");

-- CreateIndex
CREATE INDEX "pedidos_alteracao_nota_estado_pedido_em_idx" ON "pedidos_alteracao_nota"("estado", "pedido_em");

-- CreateIndex
CREATE INDEX "pedidos_alteracao_nota_cadeira_id_estudante_id_idx" ON "pedidos_alteracao_nota"("cadeira_id", "estudante_id");

-- AddForeignKey
ALTER TABLE "enunciados_prova" ADD CONSTRAINT "enunciados_prova_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_alteracao_nota" ADD CONSTRAINT "pedidos_alteracao_nota_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

