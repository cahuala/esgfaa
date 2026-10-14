-- Capítulos das cadeiras (secções, como no Moodle). Os "tópicos" dos materiais passam a capítulos.

CREATE TABLE "secoes_cadeira" (
    "id" SERIAL NOT NULL,
    "cadeira_id" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "titulo" TEXT NOT NULL,
    "resumo" TEXT NOT NULL DEFAULT '',
    "visivel" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "secoes_cadeira_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "secoes_cadeira_cadeira_id_ordem_idx" ON "secoes_cadeira"("cadeira_id", "ordem");
ALTER TABLE "secoes_cadeira" ADD CONSTRAINT "secoes_cadeira_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "materiais" ADD COLUMN "secao_id" INTEGER;
ALTER TABLE "trabalhos" ADD COLUMN "secao_id" INTEGER;
ALTER TABLE "questionarios" ADD COLUMN "secao_id" INTEGER;

-- um capítulo por tópico já usado, pela ordem em que apareceram
INSERT INTO "secoes_cadeira" ("cadeira_id", "titulo", "ordem")
SELECT "cadeira_id", "topico", ROW_NUMBER() OVER (PARTITION BY "cadeira_id" ORDER BY MIN("publicado_em"))
FROM "materiais" WHERE "topico" <> '' GROUP BY "cadeira_id", "topico";

UPDATE "materiais" m SET "secao_id" = s."id"
FROM "secoes_cadeira" s WHERE s."cadeira_id" = m."cadeira_id" AND s."titulo" = m."topico" AND m."topico" <> '';

ALTER TABLE "materiais" DROP COLUMN "topico";

ALTER TABLE "materiais" ADD CONSTRAINT "materiais_secao_id_fkey" FOREIGN KEY ("secao_id") REFERENCES "secoes_cadeira"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trabalhos" ADD CONSTRAINT "trabalhos_secao_id_fkey" FOREIGN KEY ("secao_id") REFERENCES "secoes_cadeira"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "questionarios" ADD CONSTRAINT "questionarios_secao_id_fkey" FOREIGN KEY ("secao_id") REFERENCES "secoes_cadeira"("id") ON DELETE SET NULL ON UPDATE CASCADE;
