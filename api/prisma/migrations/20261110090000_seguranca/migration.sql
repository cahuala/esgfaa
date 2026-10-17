-- CreateTable
CREATE TABLE "eventos_seguranca" (
    "id" SERIAL NOT NULL,
    "minuto" TIMESTAMPTZ(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "contagem" INTEGER NOT NULL DEFAULT 1,
    "exemplo" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "eventos_seguranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloqueios_ip" (
    "ip" TEXT NOT NULL,
    "ate" TIMESTAMPTZ(3) NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT '',
    "automatico" BOOLEAN NOT NULL DEFAULT false,
    "criado_por" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bloqueios_ip_pkey" PRIMARY KEY ("ip")
);

-- CreateIndex
CREATE INDEX "eventos_seguranca_minuto_idx" ON "eventos_seguranca"("minuto");

-- CreateIndex
CREATE INDEX "eventos_seguranca_ip_minuto_idx" ON "eventos_seguranca"("ip", "minuto");

