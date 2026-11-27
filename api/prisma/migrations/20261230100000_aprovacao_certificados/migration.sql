-- os diplomas e certificados de curso só ficam disponíveis com a aprovação do Comandante (os já emitidos ficam aprovados)
ALTER TABLE "certificados_curso" ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'aprovado';
ALTER TABLE "certificados_curso" ADD COLUMN "aprovacao" JSONB;
CREATE INDEX "certificados_curso_estado_idx" ON "certificados_curso"("estado");
