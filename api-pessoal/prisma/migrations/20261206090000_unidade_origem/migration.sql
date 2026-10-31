-- estudantes e docentes colaboradores militares que vêm de outra unidade das FAA (fora da orgânica da ESG);
-- os civis colaboradores não têm unidade
ALTER TABLE "pessoas" ADD COLUMN "unidade_origem" TEXT NOT NULL DEFAULT '';
