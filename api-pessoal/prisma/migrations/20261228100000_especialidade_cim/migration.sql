-- especialidade «Contra-Inteligência Militar (CIM)»: se a Repartição já mudou a lista das especialidades
-- (Configurações › Listas do sistema), acrescenta-se lá também (uma só vez)
UPDATE "definicoes"
SET "valor" = jsonb_set("valor", '{especialidades}', ("valor"->'especialidades') || '["Contra-Inteligência Militar (CIM)"]'::jsonb)
WHERE "chave" = 'listas' AND jsonb_typeof("valor"->'especialidades') = 'array'
  AND NOT (("valor"->'especialidades') @> '["Contra-Inteligência Militar (CIM)"]'::jsonb);
