@echo off
rem Duplo clique: instala o Sistema de Gestao de Pessoal e Quadros (ESG) neste computador.
chcp 65001 >NUL
title Instalacao - Sistema de Pessoal e Quadros
cd /d "%~dp0"
rem pede para correr como administrador (o Windows pergunta: Sim)
net session >NUL 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\instalar.ps1"
if %errorlevel% neq 0 (
  echo.
  echo A instalacao falhou. Veja o ficheiro ERRO-INSTALACAO-*.txt na pasta registos do pendrive.
) else (
  echo.
  echo Pronto. Pode fechar esta janela.
)
pause
