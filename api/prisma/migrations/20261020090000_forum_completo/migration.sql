-- AlterTable
ALTER TABLE "forum_respostas" ADD COLUMN     "editado_em" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "forum_topicos" ADD COLUMN     "editado_em" TIMESTAMPTZ(3),
ADD COLUMN     "resposta_certa_id" INTEGER,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'discussao';

-- CreateTable
CREATE TABLE "forum_anexos" (
    "id" SERIAL NOT NULL,
    "ficheiro_id" TEXT NOT NULL,
    "topico_id" INTEGER,
    "resposta_id" INTEGER,

    CONSTRAINT "forum_anexos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscricoes_topicos" (
    "topico_id" INTEGER NOT NULL,
    "conta_id" INTEGER NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "subscricoes_topicos_pkey" PRIMARY KEY ("topico_id","conta_id")
);

-- CreateTable
CREATE TABLE "subscricoes_foruns" (
    "cadeira_id" INTEGER NOT NULL,
    "conta_id" INTEGER NOT NULL,

    CONSTRAINT "subscricoes_foruns_pkey" PRIMARY KEY ("cadeira_id","conta_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "forum_anexos_ficheiro_id_key" ON "forum_anexos"("ficheiro_id");

-- AddForeignKey
ALTER TABLE "forum_anexos" ADD CONSTRAINT "forum_anexos_ficheiro_id_fkey" FOREIGN KEY ("ficheiro_id") REFERENCES "ficheiros_privados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_anexos" ADD CONSTRAINT "forum_anexos_topico_id_fkey" FOREIGN KEY ("topico_id") REFERENCES "forum_topicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_anexos" ADD CONSTRAINT "forum_anexos_resposta_id_fkey" FOREIGN KEY ("resposta_id") REFERENCES "forum_respostas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscricoes_topicos" ADD CONSTRAINT "subscricoes_topicos_topico_id_fkey" FOREIGN KEY ("topico_id") REFERENCES "forum_topicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscricoes_topicos" ADD CONSTRAINT "subscricoes_topicos_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscricoes_foruns" ADD CONSTRAINT "subscricoes_foruns_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscricoes_foruns" ADD CONSTRAINT "subscricoes_foruns_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

