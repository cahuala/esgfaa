-- AlterTable
ALTER TABLE "turmas" ADD COLUMN     "ano_final" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "trabalhos_fim_curso" (
    "id" SERIAL NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "turma_id" INTEGER NOT NULL,
    "tema" TEXT NOT NULL,
    "orientador" TEXT NOT NULL DEFAULT '',
    "juri" TEXT NOT NULL DEFAULT '',
    "data_defesa" TEXT,
    "nota" DECIMAL(4,2),
    "observacao" TEXT NOT NULL DEFAULT '',
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trabalhos_fim_curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificados_curso" (
    "codigo" TEXT NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "turma_id" INTEGER NOT NULL,
    "curso" TEXT NOT NULL,
    "media" DECIMAL(4,2) NOT NULL,
    "nota_tfc" DECIMAL(4,2),
    "emitido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificados_curso_pkey" PRIMARY KEY ("codigo")
);

-- CreateIndex
CREATE UNIQUE INDEX "trabalhos_fim_curso_estudante_id_turma_id_key" ON "trabalhos_fim_curso"("estudante_id", "turma_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificados_curso_estudante_id_turma_id_key" ON "certificados_curso"("estudante_id", "turma_id");

-- AddForeignKey
ALTER TABLE "trabalhos_fim_curso" ADD CONSTRAINT "trabalhos_fim_curso_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabalhos_fim_curso" ADD CONSTRAINT "trabalhos_fim_curso_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados_curso" ADD CONSTRAINT "certificados_curso_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificados_curso" ADD CONSTRAINT "certificados_curso_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

