-- AlterTable
ALTER TABLE "documentos_emitidos" ADD COLUMN     "impressoes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultima_impressao" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "pessoas" ADD COLUMN     "data_entrada_escola" DATE,
ADD COLUMN     "data_saida_escola" DATE,
ADD COLUMN     "destino_saida" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "motivo_saida" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "outros_vinculos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AddForeignKey
ALTER TABLE "documentos_emitidos" ADD CONSTRAINT "documentos_emitidos_pessoa_id_fkey" FOREIGN KEY ("pessoa_id") REFERENCES "pessoas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

