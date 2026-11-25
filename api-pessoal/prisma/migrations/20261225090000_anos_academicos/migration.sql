-- o posto de quem não é das FAA (Polícia Nacional, forças estrangeiras)
ALTER TABLE "pessoas" ADD COLUMN "posto_externo" TEXT NOT NULL DEFAULT '';

-- cada ano lectivo em que a pessoa foi docente ou estudante da Escola
CREATE TABLE "anos_academicos" (
    "id" SERIAL NOT NULL,
    "pessoa_id" INTEGER NOT NULL,
    "ano_letivo" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "curso" TEXT NOT NULL DEFAULT '',
    "tipo_docente" TEXT,
    "concluido" BOOLEAN,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "anos_academicos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "anos_academicos_pessoa_id_ano_letivo_papel_curso_key" ON "anos_academicos"("pessoa_id", "ano_letivo", "papel", "curso");
CREATE INDEX "anos_academicos_ano_letivo_idx" ON "anos_academicos"("ano_letivo");
ALTER TABLE "anos_academicos" ADD CONSTRAINT "anos_academicos_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
