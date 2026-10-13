-- CreateTable
CREATE TABLE "contas_portal" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "dados" JSONB NOT NULL DEFAULT '{}',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_acesso" TIMESTAMPTZ(3),
    "tentativas_falhadas" INTEGER NOT NULL DEFAULT 0,
    "bloqueado_ate" TIMESTAMPTZ(3),
    "versao_token" INTEGER NOT NULL DEFAULT 0,
    "deve_mudar_senha" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "contas_portal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turmas" (
    "id" SERIAL NOT NULL,
    "curso" TEXT NOT NULL,
    "ano_letivo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matriculas" (
    "id" SERIAL NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "turma_id" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ativa',
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matriculas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades_curriculares" (
    "id" SERIAL NOT NULL,
    "turma_id" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "semestre" INTEGER NOT NULL DEFAULT 1,
    "horas" INTEGER NOT NULL DEFAULT 0,
    "docente_id" INTEGER,
    "descricao" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "unidades_curriculares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ficheiros_privados" (
    "id" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "dono_id" INTEGER,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ficheiros_privados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materiais" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "topico" TEXT NOT NULL DEFAULT '',
    "tipo" TEXT NOT NULL,
    "ficheiro_id" TEXT,
    "url" TEXT NOT NULL DEFAULT '',
    "autor_id" INTEGER,
    "publicado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materiais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avisos_cadeira" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "autor_id" INTEGER,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avisos_cadeira_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avisos_gerais" (
    "id" SERIAL NOT NULL,
    "turma_id" INTEGER,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avisos_gerais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'teste',
    "peso" INTEGER NOT NULL,
    "data" TEXT NOT NULL DEFAULT '',
    "publicada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "avaliacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas" (
    "avaliacao_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "valor" DECIMAL(4,2) NOT NULL,
    "observacao" TEXT NOT NULL DEFAULT '',
    "atualizada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_pkey" PRIMARY KEY ("avaliacao_id","estudante_id")
);

-- CreateTable
CREATE TABLE "trabalhos" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "enunciado" TEXT NOT NULL DEFAULT '',
    "prazo" TIMESTAMPTZ(3) NOT NULL,
    "aceita_atraso" BOOLEAN NOT NULL DEFAULT false,
    "ficheiro_id" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trabalhos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregas" (
    "id" SERIAL NOT NULL,
    "trabalho_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "ficheiro_id" TEXT NOT NULL,
    "comentario" TEXT NOT NULL DEFAULT '',
    "entregue_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" DECIMAL(4,2),
    "correcao" TEXT NOT NULL DEFAULT '',
    "corrigida_em" TIMESTAMPTZ(3),

    CONSTRAINT "entregas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horarios" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "inicio" TEXT NOT NULL,
    "fim" TEXT NOT NULL,
    "sala" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "horarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aulas" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "sumario" TEXT NOT NULL DEFAULT '',
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aulas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presencas" (
    "aula_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "estado" TEXT NOT NULL,

    CONSTRAINT "presencas_pkey" PRIMARY KEY ("aula_id","estudante_id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" SERIAL NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT '',
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "resposta" TEXT NOT NULL DEFAULT '',
    "ficheiro_id" TEXT,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contas_portal_numero_key" ON "contas_portal"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "contas_portal_email_key" ON "contas_portal"("email");

-- CreateIndex
CREATE INDEX "contas_portal_tipo_idx" ON "contas_portal"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "turmas_curso_ano_letivo_nome_key" ON "turmas"("curso", "ano_letivo", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "matriculas_estudante_id_turma_id_key" ON "matriculas"("estudante_id", "turma_id");

-- CreateIndex
CREATE INDEX "unidades_curriculares_docente_id_idx" ON "unidades_curriculares"("docente_id");

-- CreateIndex
CREATE UNIQUE INDEX "unidades_curriculares_turma_id_codigo_key" ON "unidades_curriculares"("turma_id", "codigo");

-- CreateIndex
CREATE INDEX "materiais_cadeira_id_idx" ON "materiais"("cadeira_id");

-- CreateIndex
CREATE INDEX "avisos_cadeira_cadeira_id_idx" ON "avisos_cadeira"("cadeira_id");

-- CreateIndex
CREATE INDEX "avaliacoes_cadeira_id_idx" ON "avaliacoes"("cadeira_id");

-- CreateIndex
CREATE INDEX "trabalhos_cadeira_id_idx" ON "trabalhos"("cadeira_id");

-- CreateIndex
CREATE UNIQUE INDEX "entregas_trabalho_id_estudante_id_key" ON "entregas"("trabalho_id", "estudante_id");

-- CreateIndex
CREATE INDEX "horarios_cadeira_id_idx" ON "horarios"("cadeira_id");

-- CreateIndex
CREATE INDEX "aulas_cadeira_id_idx" ON "aulas"("cadeira_id");

-- CreateIndex
CREATE INDEX "pedidos_estudante_id_idx" ON "pedidos"("estudante_id");

-- CreateIndex
CREATE INDEX "pedidos_estado_idx" ON "pedidos"("estado");

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriculas" ADD CONSTRAINT "matriculas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_curriculares" ADD CONSTRAINT "unidades_curriculares_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidades_curriculares" ADD CONSTRAINT "unidades_curriculares_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "contas_portal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materiais" ADD CONSTRAINT "materiais_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos_cadeira" ADD CONSTRAINT "avisos_cadeira_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avisos_gerais" ADD CONSTRAINT "avisos_gerais_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes" ADD CONSTRAINT "avaliacoes_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_avaliacao_id_fkey" FOREIGN KEY ("avaliacao_id") REFERENCES "avaliacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas" ADD CONSTRAINT "notas_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trabalhos" ADD CONSTRAINT "trabalhos_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_trabalho_id_fkey" FOREIGN KEY ("trabalho_id") REFERENCES "trabalhos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios" ADD CONSTRAINT "horarios_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas" ADD CONSTRAINT "aulas_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_aula_id_fkey" FOREIGN KEY ("aula_id") REFERENCES "aulas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presencas" ADD CONSTRAINT "presencas_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
