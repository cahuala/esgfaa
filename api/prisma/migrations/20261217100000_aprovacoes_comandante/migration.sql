-- O Comandante aprova a distribuição dos docentes pelas cadeiras e cada publicação de notas.
-- As alocações que já existem ficam aprovadas.
ALTER TABLE "docencias" ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'aprovada';
ALTER TABLE "turmas" ADD COLUMN "distribuicao" JSONB;
ALTER TABLE "unidades_curriculares" ADD COLUMN "publicacao_pedida" JSONB;
ALTER TABLE "avaliacoes_uc" ADD COLUMN "publicacao_pedida" JSONB;
