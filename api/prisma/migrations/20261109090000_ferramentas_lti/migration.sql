-- CreateTable
CREATE TABLE "ferramentas_lti" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "url_login" TEXT NOT NULL,
    "url_lancamento" TEXT NOT NULL,
    "redirecionamentos" JSONB NOT NULL DEFAULT '[]',
    "cliente_id" TEXT NOT NULL,
    "id_implementacao" TEXT NOT NULL DEFAULT '1',
    "partilhar_dados" BOOLEAN NOT NULL DEFAULT false,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ferramentas_lti_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ferramentas_lti_cliente_id_key" ON "ferramentas_lti"("cliente_id");

