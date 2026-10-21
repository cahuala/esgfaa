-- CreateTable
CREATE TABLE "conselhos_curso" (
    "turma_id" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'aberto',
    "acta" TEXT NOT NULL DEFAULT '',
    "data_conselho" TEXT,
    "proposta_por" TEXT NOT NULL DEFAULT '',
    "proposta_em" TIMESTAMPTZ(3),
    "confirmada_por" TEXT NOT NULL DEFAULT '',
    "confirmada_em" TIMESTAMPTZ(3),
    "homologada_por" TEXT NOT NULL DEFAULT '',
    "homologada_em" TIMESTAMPTZ(3),
    "observacoes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "conselhos_curso_pkey" PRIMARY KEY ("turma_id")
);

-- CreateTable
CREATE TABLE "classificacoes_curso" (
    "turma_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "juizo" JSONB NOT NULL DEFAULT '{}',
    "ajuste" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "distinto" BOOLEAN NOT NULL DEFAULT false,
    "fixado" JSONB,
    "atualizada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classificacoes_curso_pkey" PRIMARY KEY ("turma_id","estudante_id")
);

