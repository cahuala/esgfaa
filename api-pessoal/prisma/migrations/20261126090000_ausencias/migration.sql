-- CreateTable
CREATE TABLE "ausencias" (
    "id" SERIAL NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "motivo" TEXT NOT NULL DEFAULT '',
    "documento" TEXT NOT NULL DEFAULT '',
    "criado_por" TEXT NOT NULL DEFAULT '',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ausencias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ausencias_pessoa_id_inicio_idx" ON "ausencias"("pessoa_id", "inicio");

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

