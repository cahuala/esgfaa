-- fechar o ano lectivo também é por ordem do Comandante (pedido da Administração Escolar)
ALTER TABLE "anos_letivos" ADD COLUMN "pedido_fecho" JSONB;
ALTER TABLE "anos_letivos" ADD COLUMN "recusa_fecho" JSONB;
