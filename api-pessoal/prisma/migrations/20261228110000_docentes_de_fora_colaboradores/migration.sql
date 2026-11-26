-- os docentes que não pertencem à Escola (só são docentes) são colaboradores; o funcionário que dá aulas é efectivo
UPDATE "pessoas" SET "tipo_docente" = 'colaborador' WHERE "vinculo" = 'docente' AND "tipo_docente" IS DISTINCT FROM 'colaborador';
UPDATE "pessoas" SET "tipo_docente" = 'efectivo' WHERE "vinculo" = 'funcionario' AND 'docente' = ANY("outros_vinculos") AND "tipo_docente" IS DISTINCT FROM 'efectivo';
UPDATE "anos_academicos" a SET "tipo_docente" = 'colaborador' FROM "pessoas" p
WHERE a."pessoa_id" = p."id" AND a."papel" = 'docente' AND p."vinculo" = 'docente' AND a."tipo_docente" IS DISTINCT FROM 'colaborador';
