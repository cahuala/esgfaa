-- Quadro orgânico: a 6.ª Repartição pertence ao Comando da Escola (não à Direcção dos Serviços Gerais).
-- Só muda se estiver dentro da Direcção dos Serviços Gerais. As pessoas e os lugares ficam como estão.
UPDATE "unidades" u SET "pai_id" = c."id"
FROM "unidades" c, "unidades" dsg
WHERE u."nome" = '6.ª Repartição' AND u."pai_id" = dsg."id" AND dsg."nome" = 'Direcção dos Serviços Gerais'
  AND c."id" = (SELECT "id" FROM "unidades" WHERE "nome" = 'Comando' AND "pai_id" IS NULL ORDER BY "id" LIMIT 1);

-- os cargos da 6.ª Repartição deixam de dizer «da Direcção dos Serviços Gerais»
UPDATE "cargos" SET "nome" = REPLACE("nome", ' da 6.ª Repartição da Direcção dos Serviços Gerais ', ' da 6.ª Repartição ')
WHERE "nome" LIKE '% da 6.ª Repartição da Direcção dos Serviços Gerais %';
