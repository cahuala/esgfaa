-- AddForeignKey
ALTER TABLE "entregas_ficheiros" ADD CONSTRAINT "entregas_ficheiros_ficheiro_id_fkey" FOREIGN KEY ("ficheiro_id") REFERENCES "ficheiros_privados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

