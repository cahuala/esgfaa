-- as cadeiras pertencem a um departamento de ensino; as contas do painel de quem lá trabalha também
ALTER TABLE "unidades_curriculares" ADD COLUMN "departamento" TEXT NOT NULL DEFAULT '';
ALTER TABLE "utilizadores" ADD COLUMN "departamento" TEXT NOT NULL DEFAULT '';
