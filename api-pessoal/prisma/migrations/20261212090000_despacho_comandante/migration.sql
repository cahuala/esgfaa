-- casos que só valem depois do despacho do Comandante
ALTER TABLE "utilizadores" ADD COLUMN "aguarda_despacho" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pessoas" ADD COLUMN "docente_pendente" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "pedidos_despacho" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "pessoa_id" INTEGER,
    "utilizador_id" INTEGER,
    "dados" JSONB NOT NULL DEFAULT '{}',
    "resumo" TEXT NOT NULL,
    "pedido_por" TEXT NOT NULL,
    "pedido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidido_por" TEXT,
    "decidido_em" TIMESTAMPTZ(3),
    "despacho" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "pedidos_despacho_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pedidos_despacho_estado_idx" ON "pedidos_despacho"("estado");
ALTER TABLE "pedidos_despacho" ADD CONSTRAINT "pedidos_despacho_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pedidos_despacho" ADD CONSTRAINT "pedidos_despacho_utilizador_id_fkey" FOREIGN KEY ("utilizador_id") REFERENCES "utilizadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
