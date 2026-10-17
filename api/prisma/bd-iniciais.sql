-- bases de dados extra criadas no primeiro arranque do contentor (testes automáticos e ponta-a-ponta)
CREATE DATABASE esgfaa_teste OWNER esgfaa;
CREATE DATABASE esgfaa_e2e OWNER esgfaa;

-- Sistema de Gestão de Pessoal (interno): utilizador e bases próprios; o utilizador da API pública não lhes acede
CREATE USER pessoal WITH PASSWORD 'pessoal_dev';
CREATE DATABASE esgfaa_pessoal OWNER pessoal;
CREATE DATABASE esgfaa_pessoal_teste OWNER pessoal;
REVOKE ALL ON DATABASE esgfaa_pessoal FROM PUBLIC;
REVOKE ALL ON DATABASE esgfaa_pessoal_teste FROM PUBLIC;
