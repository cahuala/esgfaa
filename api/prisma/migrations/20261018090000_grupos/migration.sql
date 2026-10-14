-- AlterTable
ALTER TABLE "entregas" ADD COLUMN     "grupo_id" INTEGER;

-- AlterTable
ALTER TABLE "trabalhos" ADD COLUMN     "em_grupo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "grupos_cadeira" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupos_cadeira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membros_grupos" (
    "grupo_id" INTEGER NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,

    CONSTRAINT "membros_grupos_pkey" PRIMARY KEY ("grupo_id","estudante_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "grupos_cadeira_cadeira_id_nome_key" ON "grupos_cadeira"("cadeira_id", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "membros_grupos_cadeira_id_estudante_id_key" ON "membros_grupos"("cadeira_id", "estudante_id");

-- CreateIndex
CREATE UNIQUE INDEX "entregas_trabalho_id_grupo_id_key" ON "entregas"("trabalho_id", "grupo_id");

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_cadeira"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos_cadeira" ADD CONSTRAINT "grupos_cadeira_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membros_grupos" ADD CONSTRAINT "membros_grupos_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos_cadeira"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membros_grupos" ADD CONSTRAINT "membros_grupos_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membros_grupos" ADD CONSTRAINT "membros_grupos_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

