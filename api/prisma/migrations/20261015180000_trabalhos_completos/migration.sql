-- Trabalhos completos: vários ficheiros, texto, correção em ficheiro, grelha e prorrogações
-- AlterTable (a coluna ficheiro_id sai no fim, depois de migrada)
ALTER TABLE "entregas" ADD COLUMN     "correcao_ficheiro_id" TEXT,
ADD COLUMN     "grelha" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "texto" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "trabalhos" ADD COLUMN     "grelha" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "max_ficheiros" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "tipo_entrega" TEXT NOT NULL DEFAULT 'ficheiro';

-- CreateTable
CREATE TABLE "entregas_ficheiros" (
    "entrega_id" INTEGER NOT NULL,
    "ficheiro_id" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "entregas_ficheiros_pkey" PRIMARY KEY ("entrega_id","ficheiro_id")
);

-- CreateTable
CREATE TABLE "prorrogacoes" (
    "trabalho_id" INTEGER NOT NULL,
    "estudante_id" INTEGER NOT NULL,
    "prazo" TIMESTAMPTZ(3) NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT '',
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prorrogacoes_pkey" PRIMARY KEY ("trabalho_id","estudante_id")
);

-- CreateIndex
CREATE INDEX "entregas_ficheiros_ficheiro_id_idx" ON "entregas_ficheiros"("ficheiro_id");

-- AddForeignKey
ALTER TABLE "entregas_ficheiros" ADD CONSTRAINT "entregas_ficheiros_entrega_id_fkey" FOREIGN KEY ("entrega_id") REFERENCES "entregas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prorrogacoes" ADD CONSTRAINT "prorrogacoes_trabalho_id_fkey" FOREIGN KEY ("trabalho_id") REFERENCES "trabalhos"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- as entregas antigas tinham um só ficheiro: passa para a tabela nova
INSERT INTO "entregas_ficheiros" ("entrega_id", "ficheiro_id", "ordem") SELECT "id", "ficheiro_id", 0 FROM "entregas" WHERE "ficheiro_id" IS NOT NULL;
ALTER TABLE "entregas" DROP COLUMN "ficheiro_id";
