-- CreateTable
CREATE TABLE "videos_curtos" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "autor_id" INTEGER,
    "ficheiro_id" TEXT NOT NULL,
    "capa_id" TEXT,
    "legenda" TEXT NOT NULL DEFAULT '',
    "duracao" INTEGER,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "videos_curtos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "videos_curtos_ficheiro_id_key" ON "videos_curtos"("ficheiro_id");

-- CreateIndex
CREATE UNIQUE INDEX "videos_curtos_capa_id_key" ON "videos_curtos"("capa_id");

-- CreateIndex
CREATE INDEX "videos_curtos_cadeira_id_criado_em_idx" ON "videos_curtos"("cadeira_id", "criado_em");

-- AddForeignKey
ALTER TABLE "videos_curtos" ADD CONSTRAINT "videos_curtos_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
