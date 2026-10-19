-- AlterTable
ALTER TABLE "pessoas" ADD COLUMN     "agregado" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bairro" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bi_emitido_em" DATE,
ADD COLUMN     "bi_local_emissao" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "bi_validade" DATE,
ADD COLUMN     "caixa_postal" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "casa" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "conjuge" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "conjuge_local_servico" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "grupo_sanguineo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "inss" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "local_incorporacao" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "municipio" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "rua" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "telefone_alternativo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vencimento" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "voluntario" BOOLEAN;

-- CreateTable
CREATE TABLE "documentos_emitidos" (
    "id" SERIAL NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "serie" TEXT NOT NULL DEFAULT '',
    "ano" INTEGER NOT NULL,
    "numero" INTEGER,
    "dados" JSONB NOT NULL DEFAULT '{}',
    "emitido_por" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_emitidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "definicoes" (
    "chave" TEXT NOT NULL,
    "valor" JSONB NOT NULL,

    CONSTRAINT "definicoes_pkey" PRIMARY KEY ("chave")
);

-- CreateIndex
CREATE INDEX "documentos_emitidos_pessoa_id_idx" ON "documentos_emitidos"("pessoa_id");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_emitidos_serie_ano_numero_key" ON "documentos_emitidos"("serie", "ano", "numero");

