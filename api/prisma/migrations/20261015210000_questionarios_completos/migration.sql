-- AlterTable
ALTER TABLE "questionarios" ADD COLUMN     "baralhar" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "perguntas_por_tentativa" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tentativas" ADD COLUMN     "comentario" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "manuais" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "ordem" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "permutacoes" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "por_corrigir" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "banco_perguntas" (
    "id" SERIAL NOT NULL,
    "docente_id" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'Geral',
    "tipo" TEXT NOT NULL,
    "enunciado" TEXT NOT NULL,
    "opcoes" JSONB NOT NULL,
    "pontos" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banco_perguntas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "banco_perguntas_docente_id_categoria_idx" ON "banco_perguntas"("docente_id", "categoria");

-- AddForeignKey
ALTER TABLE "banco_perguntas" ADD CONSTRAINT "banco_perguntas_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

