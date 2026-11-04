@echo off
rem Duplo clique, em cada computador da Reparticao: passa a abrir https://esg.emfaa.gov.ao sem avisos.
chcp 65001 >NUL
title Preparar este computador - Sistema de Pessoal e Quadros
cd /d "%~dp0"
net session >NUL 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\preparar-computador.ps1"
pause
