-- comentários do site: a equipa de comunicação revê (pendente → revisto) e o Comandante aprova (→ publicado);
-- os que já existem ficam publicados
ALTER TABLE "comentarios" ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'publicado';
ALTER TABLE "comentarios" ADD COLUMN "revisto_por" TEXT;
ALTER TABLE "comentarios" ADD COLUMN "revisto_em" TIMESTAMPTZ(3);
CREATE INDEX "comentarios_estado_idx" ON "comentarios"("estado");

-- quem já apagava comentários (Editor-chefe, Moderador…) passa também a revê-los
UPDATE "papeis"
SET "permissoes" = "permissoes" || '["comentarios.aprovar"]'::jsonb
WHERE "permissoes" @> '["comentarios.apagar"]'::jsonb
  AND NOT ("permissoes" @> '["comentarios.aprovar"]'::jsonb);
