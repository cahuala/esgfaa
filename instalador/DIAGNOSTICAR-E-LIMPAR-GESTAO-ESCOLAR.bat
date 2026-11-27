@echo off
rem Duplo clique (como administrador): diagnostico da pasta C:\ESG-Gestao-Escolar e, se o sistema nunca chegou a
rem ser instalado, limpa-a para o instalador comecar do zero. Nao mexe no Sistema de Pessoal.
chcp 65001 >NUL
title Diagnostico - Sistema de Gestao Escolar
cd /d "%~dp0"
net session >NUL 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\diagnostico-gestao.ps1" -Sistema escolar
echo.
echo Pronto. O ficheiro DIAGNOSTICO-ESCOLAR-*.txt esta na pasta registos. Pode fechar esta janela.
pause
