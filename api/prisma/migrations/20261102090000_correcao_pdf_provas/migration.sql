-- AlterTable
ALTER TABLE "entregas" ADD COLUMN     "anotacoes" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "questionarios" ADD COLUMN     "comentarios" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "por_pagina" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "senha" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sequencial" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tentativas" ADD COLUMN     "pagina" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "excecoes_questionario" (
    "id" SERIAL NOT NULL,
    "questionario_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "fecha" TIMESTAMPTZ(3),
    "duracao" INTEGER,
    "tentativas" INTEGER,
    "motivo" TEXT NOT NULL DEFAULT '',
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excecoes_questionario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "excecoes_questionario_questionario_id_estudante_id_key" ON "excecoes_questionario"("questionario_id", "estudante_id");

-- AddForeignKey
ALTER TABLE "excecoes_questionario" ADD CONSTRAINT "excecoes_questionario_questionario_id_fkey" FOREIGN KEY ("questionario_id") REFERENCES "questionarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "excecoes_questionario" ADD CONSTRAINT "excecoes_questionario_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

