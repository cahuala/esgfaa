-- CreateTable
CREATE TABLE "subscricoes_push" (
    "id" SERIAL NOT NULL,
    "conta_id" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "aparelho" TEXT NOT NULL DEFAULT '',
    "criada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscricoes_push_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscricoes_push_endpoint_key" ON "subscricoes_push"("endpoint");

-- CreateIndex
CREATE INDEX "subscricoes_push_conta_id_idx" ON "subscricoes_push"("conta_id");

-- AddForeignKey
ALTER TABLE "subscricoes_push" ADD CONSTRAINT "subscricoes_push_conta_id_fkey" FOREIGN KEY ("conta_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

