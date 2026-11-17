@echo off
rem Duplo clique, no servidor: o sistema passa a abrir em https://esg.emfaa.gov.ao (sem a porta 8443).
rem A porta 443 do IP do servidor e da VPN do Windows (nao se desliga): o sistema fica num segundo IP, so dele.
chcp 65001 >NUL
title Endereco sem porta - Sistema de Pessoal e Quadros
cd /d "%~dp0"
net session >NUL 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
echo.
echo  Para o sistema abrir em https://esg.emfaa.gov.ao (sem :8443) precisa de um IP LIVRE da rede da Escola,
echo  so para o sistema (peca-o ao responsavel pela rede). Os dados, as contas e as chaves ficam como estao.
echo  Depois: no DNS da Escola, esg.emfaa.gov.ao passa a apontar para esse IP; e em cada computador ja
echo  preparado corre-se outra vez PREPARAR-COMPUTADOR-WINDOWS.bat (o IP mudou).
echo.
set /p ESG_IP_SISTEMA=IP livre para o sistema (Enter = cancelar): 
if "%ESG_IP_SISTEMA%"=="" (
  echo Cancelado: nada mudou.
  pause
  exit /b
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\instalar.ps1"
if %errorlevel% neq 0 (
  echo.
  echo Nao foi possivel. Veja o ficheiro ERRO-INSTALACAO-*.txt na pasta registos do pendrive.
) else (
  echo.
  echo Pronto. Veja acima o endereco e o registo a pedir no DNS da Escola.
)
pause
