-- o que cada conta pode fazer, escolhido pelo Comandante (vazio = as do papel)
ALTER TABLE "utilizadores" ADD COLUMN "permissoes" JSONB;
