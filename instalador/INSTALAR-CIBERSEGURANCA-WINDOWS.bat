@echo off
rem Duplo clique: instala (ou actualiza) o Sistema de Ciberseguranca neste servidor (rede interna): vigia todos os sistemas.
chcp 65001 >NUL
title Instalacao - Sistema de Ciberseguranca
cd /d "%~dp0"
net session >NUL 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\instalar-gestao.ps1" -Sistema ciberseguranca
if %errorlevel% neq 0 (
  echo.
  echo A instalacao falhou. Veja o ficheiro ERRO-INSTALACAO-CIBERSEGURANCA-*.txt na pasta registos do pendrive.
) else (
  echo.
  echo Pronto. Pode fechar esta janela.
)
pause
