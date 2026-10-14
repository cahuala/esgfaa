-- AlterTable
ALTER TABLE "materiais" ADD COLUMN     "disponivel_de" TIMESTAMPTZ(3),
ADD COLUMN     "requisitos" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "visivel" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "secoes_cadeira" ADD COLUMN     "disponivel_de" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "certificados" (
    "codigo" TEXT NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "emitido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" DECIMAL(4,2),

    CONSTRAINT "certificados_pkey" PRIMARY KEY ("codigo")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificados_estudante_id_cadeira_id_key" ON "certificados"("estudante_id", "cadeira_id");

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados" ADD CONSTRAINT "certificados_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

