-- o documento do plano do curso (PDF)
ALTER TABLE "planos_curso" ADD COLUMN "ficheiro_id" TEXT;
-- os planos de curso organizam as UC por blocos e não indicam semestres: as UC das turmas com plano são anuais
UPDATE "unidades_curriculares" u SET "periodo" = 'anual'
  FROM "turmas" t JOIN "planos_curso" p ON p."curso" = t."curso" AND p."ano_letivo" = t."ano_letivo"
  WHERE u."turma_id" = t."id" AND u."bloco" <> '';
