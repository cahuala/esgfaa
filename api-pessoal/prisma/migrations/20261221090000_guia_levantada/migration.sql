-- Guias de férias (e outras): o dia em que o próprio a veio levantar e quem o registou.
ALTER TABLE "documentos_emitidos" ADD COLUMN "levantada_em" DATE;
ALTER TABLE "documentos_emitidos" ADD COLUMN "levantada_por" TEXT;
