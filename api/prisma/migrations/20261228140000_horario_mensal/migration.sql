-- horário mensal da turma: a cadeira (ou um texto) em cada dia útil e em cada tempo
CREATE TABLE "horarios_mensais" (
    "id" SERIAL NOT NULL,
    "turma_id" INTEGER NOT NULL,
    "data" DATE NOT NULL,
    "bloco" TEXT NOT NULL,
    "cadeira_id" INTEGER,
    "texto" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "horarios_mensais_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "horarios_mensais_turma_id_data_bloco_key" ON "horarios_mensais"("turma_id", "data", "bloco");
CREATE INDEX "horarios_mensais_turma_id_data_idx" ON "horarios_mensais"("turma_id", "data");
ALTER TABLE "horarios_mensais" ADD CONSTRAINT "horarios_mensais_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
