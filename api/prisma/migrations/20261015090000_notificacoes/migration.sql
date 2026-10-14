-- AlterTable
ALTER TABLE "contas_portal" ADD COLUMN     "notificar_email" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "trabalhos" ADD COLUMN     "lembrete_em" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "notificacoes" (
    "id" SERIAL NOT NULL,
    "conta_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL DEFAULT '',
    "ligacao" TEXT NOT NULL DEFAULT '',
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" SERIAL NOT NULL,
    "de_id" INTEGER NOT NULL,
    "para_id" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "lida_em" TIMESTAMPTZ(3),
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificacoes_conta_id_lida_criada_em_idx" ON "notificacoes"("conta_id", "lida", "criada_em");

-- CreateIndex
CREATE INDEX "mensagens_de_id_para_id_criada_em_idx" ON "mensagens"("de_id", "para_id", "criada_em");

-- CreateIndex
CREATE INDEX "mensagens_para_id_lida_em_idx" ON "mensagens"("para_id", "lida_em");

-- AddForeignKey
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_de_id_fkey" FOREIGN KEY ("de_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_para_id_fkey" FOREIGN KEY ("para_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

