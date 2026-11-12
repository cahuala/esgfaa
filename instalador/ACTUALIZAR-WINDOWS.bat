@echo off
rem Duplo clique: actualiza o Sistema de Gestao de Pessoal e Quadros ja instalado (so o codigo e a base de dados; nao pergunta nada).
chcp 65001 >NUL
title Actualizacao - Sistema de Pessoal e Quadros
cd /d "%~dp0"
net session >NUL 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\actualizar.ps1"
if %errorlevel% neq 0 (
  echo.
  echo A actualizacao falhou. Veja o ficheiro ERRO-ACTUALIZACAO-*.txt na pasta registos do pendrive.
) else (
  echo.
  echo Pronto. Pode fechar esta janela.
)
pause
