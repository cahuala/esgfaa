@echo off
rem Duplo clique: instala (ou actualiza) o Sistema de Gestao do Site neste servidor (rede interna).
chcp 65001 >NUL
title Instalacao - Sistema de Gestao do Site
cd /d "%~dp0"
net session >NUL 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\instalar-gestao.ps1" -Sistema site
if %errorlevel% neq 0 (
  echo.
  echo A instalacao falhou. Veja o ficheiro ERRO-INSTALACAO-SITE-*.txt na pasta registos do pendrive.
) else (
  echo.
  echo Pronto. Pode fechar esta janela.
)
pause
