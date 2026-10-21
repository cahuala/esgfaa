-- AlterTable
ALTER TABLE "unidades_curriculares" ADD COLUMN     "bloco" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "creditos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "horas_contacto" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "horas_nao_contacto" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tii" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "planos_curso" (
    "id" SERIAL NOT NULL,
    "curso" TEXT NOT NULL,
    "ano_letivo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "termo" TEXT NOT NULL DEFAULT 'discente',
    "formula" TEXT NOT NULL DEFAULT 'ponderada',
    "blocos" JSONB NOT NULL DEFAULT '[]',
    "ajuste_maximo" DECIMAL(4,2) NOT NULL DEFAULT 0,
    "exigir_blocos" BOOLEAN NOT NULL DEFAULT true,
    "exigir_teste_escrito" BOOLEAN NOT NULL DEFAULT true,
    "faltas_maximas" INTEGER NOT NULL DEFAULT 10,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planos_curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "avaliacoes_uc" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "forma" TEXT NOT NULL DEFAULT 'teste',
    "titulo" TEXT NOT NULL,
    "data" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "publicada_em" TIMESTAMPTZ(3),
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avaliacoes_uc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_avaliacao_uc" (
    "avaliacao_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "nota" DECIMAL(4,2),
    "recuperacao" DECIMAL(4,2),
    "recuperacao_pedida_em" TIMESTAMPTZ(3),
    "atualizada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_avaliacao_uc_pkey" PRIMARY KEY ("avaliacao_id","estudante_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "planos_curso_curso_ano_letivo_key" ON "planos_curso"("curso", "ano_letivo");

-- CreateIndex
CREATE INDEX "avaliacoes_uc_cadeira_id_idx" ON "avaliacoes_uc"("cadeira_id");

-- CreateIndex
CREATE INDEX "notas_avaliacao_uc_estudante_id_idx" ON "notas_avaliacao_uc"("estudante_id");

-- AddForeignKey
ALTER TABLE "avaliacoes_uc" ADD CONSTRAINT "avaliacoes_uc_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_avaliacao_uc" ADD CONSTRAINT "notas_avaliacao_uc_avaliacao_id_fkey" FOREIGN KEY ("avaliacao_id") REFERENCES "avaliacoes_uc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_avaliacao_uc" ADD CONSTRAINT "notas_avaliacao_uc_estudante_id_fkey" FOREIGN KEY ("estudante_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

