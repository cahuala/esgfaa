-- CreateTable
CREATE TABLE "workshops" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "secao_id" INTEGER,
    "titulo" TEXT NOT NULL,
    "enunciado" TEXT NOT NULL DEFAULT '',
    "grelha" JSONB NOT NULL,
    "fim_submissao" TIMESTAMPTZ(3) NOT NULL,
    "fim_avaliacao" TIMESTAMPTZ(3) NOT NULL,
    "avaliacoes_por_par" INTEGER NOT NULL DEFAULT 3,
    "anonimo" BOOLEAN NOT NULL DEFAULT true,
    "distribuido_em" TIMESTAMPTZ(3),
    "visivel" BOOLEAN NOT NULL DEFAULT true,
    "disponivel_de" TIMESTAMPTZ(3),
    "requisitos" JSONB NOT NULL DEFAULT '[]',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workshops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissoes_workshop" (
    "id" SERIAL NOT NULL,
    "workshop_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "texto" TEXT NOT NULL DEFAULT '',
    "ficheiro_id" TEXT,
    "entregue_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota_final" DECIMAL(4,2),
    "comentario" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "submissoes_workshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes_pares" (
    "id" SERIAL NOT NULL,
    "submissao_id" INTEGER NOT NULL,
    "avaliador_id" INTEGER NOT NULL,
    "pontos" JSONB NOT NULL DEFAULT '{}',
    "comentario" TEXT NOT NULL DEFAULT '',
    "nota" DECIMAL(4,2),
    "feita_em" TIMESTAMPTZ(3),

    CONSTRAINT "avaliacoes_pares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workshops_cadeira_id_idx" ON "workshops"("cadeira_id");

-- CreateIndex
CREATE UNIQUE INDEX "submissoes_workshop_workshop_id_estudante_id_key" ON "submissoes_workshop"("workshop_id", "estudante_id");

-- CreateIndex
CREATE UNIQUE INDEX "avaliacoes_pares_submissao_id_avaliador_id_key" ON "avaliacoes_pares"("submissao_id", "avaliador_id");

-- AddForeignKey
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshops" ADD CONSTRAINT "workshops_secao_id_fkey" FOREIGN KEY ("secao_id") REFERENCES "secoes_cadeira"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissoes_workshop" ADD CONSTRAINT "submissoes_workshop_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissoes_workshop" ADD CONSTRAINT "submissoes_workshop_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissoes_workshop" ADD CONSTRAINT "submissoes_workshop_ficheiro_id_fkey" FOREIGN KEY ("ficheiro_id") REFERENCES "ficheiros_privados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_pares" ADD CONSTRAINT "avaliacoes_pares_submissao_id_fkey" FOREIGN KEY ("submissao_id") REFERENCES "submissoes_workshop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacoes_pares" ADD CONSTRAINT "avaliacoes_pares_avaliador_id_fkey" FOREIGN KEY ("avaliador_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

