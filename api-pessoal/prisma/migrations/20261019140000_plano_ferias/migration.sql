-- CreateTable
CREATE TABLE "plano_ferias" (
    "id" SERIAL NOT NULL,
    "ano" INTEGER NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "criado_por" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plano_ferias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plano_ferias_ano_pessoa_id_key" ON "plano_ferias"("ano", "pessoa_id");

-- AddForeignKey
ALTER TABLE "plano_ferias" ADD CONSTRAINT "plano_ferias_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

