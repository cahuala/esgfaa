-- ano lectivo fechado / reaberto por ordem do Comandante (os anos existentes ficam abertos)
ALTER TABLE "anos_letivos" ADD COLUMN "fechado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "anos_letivos" ADD COLUMN "fechado_em" TIMESTAMPTZ(3);
ALTER TABLE "anos_letivos" ADD COLUMN "fechado_por" TEXT NOT NULL DEFAULT '';
ALTER TABLE "anos_letivos" ADD COLUMN "pedido_reabertura" JSONB;
ALTER TABLE "anos_letivos" ADD COLUMN "reabertura" JSONB;
ALTER TABLE "anos_letivos" ADD COLUMN "recusa_reabertura" JSONB;
