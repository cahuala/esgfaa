@echo off
rem Duplo clique: ACTUALIZA o Sistema de Gestao Escolar ja instalado neste servidor (os dados, as chaves e a
rem configuracao ficam; antes de trocar faz uma copia da base de dados e, se falhar, volta a versao anterior).
chcp 65001 >NUL
title Actualizacao - Sistema de Gestao Escolar
cd /d "%~dp0"
net session >NUL 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\instalar-gestao.ps1" -Sistema escolar -SoActualizar
if %errorlevel% neq 0 (
  echo.
  echo A actualizacao falhou. Veja o ficheiro ERRO-INSTALACAO-ESCOLAR-*.txt na pasta registos.
) else (
  echo.
  echo Pronto: o Sistema de Gestao Escolar esta actualizado. Pode fechar esta janela.
)
pause
