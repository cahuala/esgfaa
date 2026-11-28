-- os anos lectivos em que cada docente leccionou (vêm do Sistema de Pessoal): os docentes por ano lectivo
ALTER TABLE "contas_portal" ADD COLUMN IF NOT EXISTS "anos_docente" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
