-- AlterTable
ALTER TABLE "biblioteca_obras" ADD COLUMN     "capa" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "biblioteca_reservas" (
    "id" SERIAL NOT NULL,
    "obra_id" INTEGER NOT NULL,
    "conta_id" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'pendente',
    "criada_em" TIMESTAMPTZ(3) NOT NULL,
    "pronta_em" TIMESTAMPTZ(3),
    "levantar_ate" TIMESTAMPTZ(3),
    "fechada_em" TIMESTAMPTZ(3),
    "aberta" TEXT,

    CONSTRAINT "biblioteca_reservas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "biblioteca_reservas_aberta_key" ON "biblioteca_reservas"("aberta");

-- CreateIndex
CREATE INDEX "biblioteca_reservas_estado_idx" ON "biblioteca_reservas"("estado");

-- CreateIndex
CREATE INDEX "biblioteca_reservas_conta_id_idx" ON "biblioteca_reservas"("conta_id");

-- AddForeignKey
ALTER TABLE "biblioteca_reservas" ADD CONSTRAINT "biblioteca_reservas_obra_id_fkey" FOREIGN KEY ("obra_id") REFERENCES "biblioteca_obras"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biblioteca_reservas" ADD CONSTRAINT "biblioteca_reservas_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

