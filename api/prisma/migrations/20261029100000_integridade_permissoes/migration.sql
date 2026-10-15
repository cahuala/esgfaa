-- A Repartição de Administração Escolar (papel "secretaria") passa a ver e gerir a integridade académica (anti-plágio).
-- Só acrescenta o que falta; não mexe noutras permissões que o papel tenha.
UPDATE "papeis"
SET "permissoes" = "permissoes" || '["integridade.ver", "integridade.gerir"]'::jsonb
WHERE "id" = 'secretaria'
  AND NOT ("permissoes" @> '["integridade.ver"]'::jsonb);
