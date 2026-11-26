-- militar das listas sem o ramo (ficou Exército): por confirmar na ficha
ALTER TABLE "pessoas" ADD COLUMN "ramo_por_confirmar" BOOLEAN NOT NULL DEFAULT false;
