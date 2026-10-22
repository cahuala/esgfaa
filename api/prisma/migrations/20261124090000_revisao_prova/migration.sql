-- AlterTable
ALTER TABLE "notas_avaliacao_uc" ADD COLUMN     "revisao_decidida_em" TIMESTAMPTZ(3),
ADD COLUMN     "revisao_decisao" TEXT,
ADD COLUMN     "revisao_decisor" TEXT,
ADD COLUMN     "revisao_fundamento" TEXT,
ADD COLUMN     "revisao_motivo" TEXT,
ADD COLUMN     "revisao_nota_anterior" DECIMAL(4,2),
ADD COLUMN     "revisao_pedida_em" TIMESTAMPTZ(3);

