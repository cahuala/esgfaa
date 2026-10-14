-- CreateTable
CREATE TABLE "registos_acesso" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "conta_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "alvo_id" INTEGER,
    "em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registos_acesso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registos_acesso_cadeira_id_em_idx" ON "registos_acesso"("cadeira_id", "em");

-- CreateIndex
CREATE INDEX "registos_acesso_cadeira_id_conta_id_idx" ON "registos_acesso"("cadeira_id", "conta_id");

-- AddForeignKey
ALTER TABLE "registos_acesso" ADD CONSTRAINT "registos_acesso_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registos_acesso" ADD CONSTRAINT "registos_acesso_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

