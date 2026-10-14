-- CreateTable
CREATE TABLE "forum_topicos" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "fixado" BOOLEAN NOT NULL DEFAULT false,
    "fechado" BOOLEAN NOT NULL DEFAULT false,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atividade_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_topicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forum_respostas" (
    "id" SERIAL NOT NULL,
    "topico_id" INTEGER NOT NULL,
    "autor_id" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "forum_respostas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_academicos" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER,
    "turma_id" INTEGER,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "inicio" TEXT NOT NULL DEFAULT '',
    "fim" TEXT NOT NULL DEFAULT '',
    "local" TEXT NOT NULL DEFAULT '',
    "descricao" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_academicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conclusoes" (
    "material_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "concluido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conclusoes_pkey" PRIMARY KEY ("material_id","estudante_id")
);

-- CreateTable
CREATE TABLE "questionarios" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "abre" TIMESTAMPTZ(3),
    "fecha" TIMESTAMPTZ(3),
    "duracao" INTEGER NOT NULL DEFAULT 0,
    "tentativas" INTEGER NOT NULL DEFAULT 1,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "mostrar_respostas" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questionarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perguntas" (
    "id" SERIAL NOT NULL,
    "questionario_id" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "enunciado" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "opcoes" JSONB NOT NULL,
    "pontos" DECIMAL(5,2) NOT NULL DEFAULT 1,

    CONSTRAINT "perguntas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tentativas" (
    "id" SERIAL NOT NULL,
    "questionario_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL DEFAULT 1,
    "iniciada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "limite" TIMESTAMPTZ(3),
    "entregue_em" TIMESTAMPTZ(3),
    "respostas" JSONB NOT NULL DEFAULT '{}',
    "nota" DECIMAL(4,2),

    CONSTRAINT "tentativas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "forum_topicos_cadeira_id_atividade_em_idx" ON "forum_topicos"("cadeira_id", "atividade_em");

-- CreateIndex
CREATE INDEX "forum_respostas_topico_id_criado_em_idx" ON "forum_respostas"("topico_id", "criado_em");

-- CreateIndex
CREATE INDEX "eventos_academicos_data_idx" ON "eventos_academicos"("data");

-- CreateIndex
CREATE INDEX "conclusoes_estudante_id_idx" ON "conclusoes"("estudante_id");

-- CreateIndex
CREATE INDEX "questionarios_cadeira_id_idx" ON "questionarios"("cadeira_id");

-- CreateIndex
CREATE INDEX "perguntas_questionario_id_ordem_idx" ON "perguntas"("questionario_id", "ordem");

-- CreateIndex
CREATE INDEX "tentativas_estudante_id_idx" ON "tentativas"("estudante_id");

-- CreateIndex
CREATE UNIQUE INDEX "tentativas_questionario_id_estudante_id_numero_key" ON "tentativas"("questionario_id", "estudante_id", "numero");

-- AddForeignKey
ALTER TABLE "forum_topicos" ADD CONSTRAINT "forum_topicos_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_topicos" ADD CONSTRAINT "forum_topicos_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_respostas" ADD CONSTRAINT "forum_respostas_topico_id_fkey" FOREIGN KEY ("topico_id") REFERENCES "forum_topicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forum_respostas" ADD CONSTRAINT "forum_respostas_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_academicos" ADD CONSTRAINT "eventos_academicos_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_academicos" ADD CONSTRAINT "eventos_academicos_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conclusoes" ADD CONSTRAINT "conclusoes_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materiais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conclusoes" ADD CONSTRAINT "conclusoes_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questionarios" ADD CONSTRAINT "questionarios_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perguntas" ADD CONSTRAINT "perguntas_questionario_id_fkey" FOREIGN KEY ("questionario_id") REFERENCES "questionarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentativas" ADD CONSTRAINT "tentativas_questionario_id_fkey" FOREIGN KEY ("questionario_id") REFERENCES "questionarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentativas" ADD CONSTRAINT "tentativas_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

