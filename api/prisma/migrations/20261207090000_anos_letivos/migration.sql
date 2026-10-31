-- anos letivos configurados pela Administração Escolar: datas do ano e dos dois semestres; um é o atual
CREATE TABLE "anos_letivos" (
  "id" TEXT NOT NULL,
  "inicio" DATE NOT NULL,
  "fim" DATE NOT NULL,
  "semestre1_inicio" DATE NOT NULL,
  "semestre1_fim" DATE NOT NULL,
  "semestre2_inicio" DATE NOT NULL,
  "semestre2_fim" DATE NOT NULL,
  "atual" BOOLEAN NOT NULL DEFAULT false,
  "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anos_letivos_pkey" PRIMARY KEY ("id")
);

-- os anos das turmas que já existem ficam registados com datas habituais (outubro a julho), que se corrigem no painel
INSERT INTO "anos_letivos" ("id", "inicio", "fim", "semestre1_inicio", "semestre1_fim", "semestre2_inicio", "semestre2_fim")
SELECT DISTINCT t."ano_letivo",
  make_date(split_part(t."ano_letivo", '/', 1)::int, 10, 1),
  make_date(split_part(t."ano_letivo", '/', 2)::int, 7, 31),
  make_date(split_part(t."ano_letivo", '/', 1)::int, 10, 1),
  make_date(split_part(t."ano_letivo", '/', 2)::int, 2, 15),
  make_date(split_part(t."ano_letivo", '/', 2)::int, 2, 16),
  make_date(split_part(t."ano_letivo", '/', 2)::int, 7, 31)
FROM "turmas" t
WHERE t."ano_letivo" ~ '^\d{4}/\d{4}$';

-- o atual: o mais recente
UPDATE "anos_letivos" SET "atual" = true WHERE "id" = (SELECT max("id") FROM "anos_letivos");
