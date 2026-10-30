-- contas do painel e mudanças de papel à espera do Comandante: { tipo: 'criar'|'papel', papel, de?, pedidoPor, pedidoEm }
ALTER TABLE "utilizadores" ADD COLUMN "aprovacao" JSONB;

-- avisos gerais do portal: só chegam aos estudantes quando o Comandante aprova (os que já existem ficam publicados)
ALTER TABLE "avisos_gerais" ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'publicado';
ALTER TABLE "avisos_gerais" ADD COLUMN "aprovacao" JSONB;
CREATE INDEX "avisos_gerais_estado_idx" ON "avisos_gerais"("estado");

-- inquéritos institucionais: o lançamento espera o Comandante { estado: 'pendente'|'recusado', pedidoPor, pedidoEm, motivo? }
ALTER TABLE "inqueritos_institucionais" ADD COLUMN "aprovacao" JSONB;
