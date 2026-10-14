-- AlterTable
ALTER TABLE "materiais" ADD COLUMN     "conteudo" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "duracao" INTEGER,
ADD COLUMN     "inicio" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "materiais_ficheiros" (
    "material_id" INTEGER NOT NULL,
    "ficheiro_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "materiais_ficheiros_pkey" PRIMARY KEY ("material_id","ficheiro_id")
);

-- CreateTable
CREATE TABLE "inqueritos" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "secao_id" INTEGER,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "perguntas" JSONB NOT NULL,
    "anonimo" BOOLEAN NOT NULL DEFAULT false,
    "resultados" TEXT NOT NULL DEFAULT 'apos_responder',
    "fecha" TIMESTAMPTZ(3),
    "docente_id" INTEGER,
    "visivel" BOOLEAN NOT NULL DEFAULT true,
    "disponivel_de" TIMESTAMPTZ(3),
    "requisitos" JSONB NOT NULL DEFAULT '[]',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inqueritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_inqueritos" (
    "id" SERIAL NOT NULL,
    "inquerito_id" INTEGER NOT NULL,
    "estudante_id" INTEGER,
    "respostas" JSONB NOT NULL,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respostas_inqueritos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participacoes_inqueritos" (
    "inquerito_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participacoes_inqueritos_pkey" PRIMARY KEY ("inquerito_id","estudante_id")
);

-- CreateIndex
CREATE INDEX "inqueritos_cadeira_id_idx" ON "inqueritos"("cadeira_id");

-- CreateIndex
CREATE UNIQUE INDEX "respostas_inqueritos_inquerito_id_estudante_id_key" ON "respostas_inqueritos"("inquerito_id", "estudante_id");

-- AddForeignKey
ALTER TABLE "materiais_ficheiros" ADD CONSTRAINT "materiais_ficheiros_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materiais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiais_ficheiros" ADD CONSTRAINT "materiais_ficheiros_ficheiro_id_fkey" FOREIGN KEY ("ficheiro_id") REFERENCES "ficheiros_privados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inqueritos" ADD CONSTRAINT "inqueritos_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inqueritos" ADD CONSTRAINT "inqueritos_secao_id_fkey" FOREIGN KEY ("secao_id") REFERENCES "secoes_cadeira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inqueritos" ADD CONSTRAINT "inqueritos_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "contas_portal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_inqueritos" ADD CONSTRAINT "respostas_inqueritos_inquerito_id_fkey" FOREIGN KEY ("inquerito_id") REFERENCES "inqueritos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacoes_inqueritos" ADD CONSTRAINT "participacoes_inqueritos_inquerito_id_fkey" FOREIGN KEY ("inquerito_id") REFERENCES "inqueritos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacoes_inqueritos" ADD CONSTRAINT "participacoes_inqueritos_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

