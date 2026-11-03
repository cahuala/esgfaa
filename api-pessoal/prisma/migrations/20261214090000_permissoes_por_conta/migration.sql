-- o que cada conta pode fazer, ecrã a ecrã (vazio = as do papel)
ALTER TABLE "utilizadores" ADD COLUMN "permissoes" JSONB;
