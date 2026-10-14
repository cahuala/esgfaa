-- CreateTable
CREATE TABLE "inqueritos_institucionais" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "perguntas" JSONB NOT NULL,
    "publico" TEXT NOT NULL,
    "turma_ids" JSONB NOT NULL DEFAULT '[]',
    "fecha" TIMESTAMPTZ(3) NOT NULL,
    "lancado_em" TIMESTAMPTZ(3),
    "autor" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inqueritos_institucionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_institucionais" (
    "id" SERIAL NOT NULL,
    "inquerito_id" INTEGER NOT NULL,
    "respostas" JSONB NOT NULL,
    "criada_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "respostas_institucionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participacoes_institucionais" (
    "inquerito_id" INTEGER NOT NULL,
    "conta_id" INTEGER NOT NULL,
    "em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "participacoes_institucionais_pkey" PRIMARY KEY ("inquerito_id","conta_id")
);

-- CreateIndex
CREATE INDEX "respostas_institucionais_inquerito_id_idx" ON "respostas_institucionais"("inquerito_id");

-- AddForeignKey
ALTER TABLE "respostas_institucionais" ADD CONSTRAINT "respostas_institucionais_inquerito_id_fkey" FOREIGN KEY ("inquerito_id") REFERENCES "inqueritos_institucionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacoes_institucionais" ADD CONSTRAINT "participacoes_institucionais_inquerito_id_fkey" FOREIGN KEY ("inquerito_id") REFERENCES "inqueritos_institucionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participacoes_institucionais" ADD CONSTRAINT "participacoes_institucionais_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

