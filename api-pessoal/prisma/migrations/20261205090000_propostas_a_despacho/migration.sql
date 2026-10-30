-- antes de seguir para o escalão superior, a proposta vai a despacho do Comandante (Secretária digital)
-- { estado: pendente|despachado, pedidoPor, pedidoEm, documento, decisao?, texto?, despachadoPor?, despachadoEm? }
ALTER TABLE "propostas" ADD COLUMN "despacho" JSONB;
