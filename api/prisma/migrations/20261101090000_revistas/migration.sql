-- Revista da Escola: o editor-chefe (que já publica artigos) passa a gerir também os números da revista.
-- Só papéis com artigos.publicar e ainda sem permissões da revista; os papéis editados à mão mantêm-se.
UPDATE "papeis"
SET "permissoes" = "permissoes" || '["revistas.ver", "revistas.criar", "revistas.editar", "revistas.apagar", "revistas.publicar"]'::jsonb
WHERE "id" = 'editor_chefe'
  AND "permissoes" ? 'artigos.publicar'
  AND NOT ("permissoes" ? 'revistas.ver');
