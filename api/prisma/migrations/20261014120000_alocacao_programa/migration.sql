-- Alocação de docentes (regente + assistentes), período (1.º/2.º semestre ou anual),
-- programa da cadeira e ano curricular da turma. Os dados existentes são preservados.

-- ano curricular da turma
ALTER TABLE "turmas" ADD COLUMN "ano_curricular" INTEGER NOT NULL DEFAULT 1;

-- alocação de docentes
CREATE TABLE "docencias" (
    "cadeira_id" INTEGER NOT NULL,
    "docente_id" INTEGER NOT NULL,
    "papel" TEXT NOT NULL DEFAULT 'regente',
    "horas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "docencias_pkey" PRIMARY KEY ("cadeira_id","docente_id")
);
CREATE INDEX "docencias_docente_id_idx" ON "docencias"("docente_id");
ALTER TABLE "docencias" ADD CONSTRAINT "docencias_cadeira_id_fkey" FOREIGN KEY ("cadeira_id") REFERENCES "unidades_curriculares"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "docencias" ADD CONSTRAINT "docencias_docente_id_fkey" FOREIGN KEY ("docente_id") REFERENCES "contas_portal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- o docente de cada cadeira passa a regente, com as horas da cadeira
INSERT INTO "docencias" ("cadeira_id", "docente_id", "papel", "horas")
SELECT "id", "docente_id", 'regente', "horas" FROM "unidades_curriculares" WHERE "docente_id" IS NOT NULL;

-- período: semestres ímpares → 1.º semestre, pares → 2.º semestre
ALTER TABLE "unidades_curriculares"
ADD COLUMN "periodo" TEXT NOT NULL DEFAULT '1',
ADD COLUMN "programa" TEXT NOT NULL DEFAULT '',
ADD COLUMN "programa_ficheiro_id" TEXT;
UPDATE "unidades_curriculares" SET "periodo" = CASE WHEN "semestre" % 2 = 0 THEN '2' ELSE '1' END;

ALTER TABLE "unidades_curriculares" DROP CONSTRAINT "unidades_curriculares_docente_id_fkey";
DROP INDEX "unidades_curriculares_docente_id_idx";
ALTER TABLE "unidades_curriculares" DROP COLUMN "docente_id", DROP COLUMN "semestre";

-- a Secretaria passa a Repartição de Administração Escolar e também lança notas
UPDATE "papeis"
SET "nome" = 'Repartição de Administração Escolar',
    "descricao" = 'Matrículas, turmas, cadeiras, alocação de docentes, programas, pautas, horários e pedidos de documentos.',
    "permissoes" = CASE WHEN "permissoes" @> '["academico.notas"]'::jsonb THEN "permissoes" ELSE "permissoes" || '["academico.notas"]'::jsonb END
WHERE "id" = 'secretaria';
