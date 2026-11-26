@echo off
rem Duplo clique: instala (ou actualiza) o Portal da ESG neste servidor: site, Portal Academico, painel de gestao.
chcp 65001 >NUL
title Instalacao - Portal da ESG
cd /d "%~dp0"
net session >NUL 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\instalar-portal.ps1"
if %errorlevel% neq 0 (
  echo.
  echo A instalacao falhou. Veja o ficheiro ERRO-INSTALACAO-PORTAL-*.txt na pasta registos do pendrive.
) else (
  echo.
  echo Pronto. Pode fechar esta janela.
)
pause
