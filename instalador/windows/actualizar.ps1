#Requires -Version 5.1
<#
  Actualização do Sistema de Gestão de Pessoal e Quadros (ESG) já instalado neste Windows, a partir do pendrive.
  Só troca o código e actualiza a base de dados: não pergunta nada (portas, IP, conta, chaves) e não mexe na
  configuração, nos programas (Node, PostgreSQL, Caddy) nem noutros serviços do servidor.
    1. confere os ficheiros do sistema no pendrive (MANIFESTO);
    2. faz uma cópia de segurança da base e dos ficheiros (C:\ESG-Pessoal\dados\copias);
    3. pára o sistema, troca a pasta sistema (a antiga fica em sistema.anterior) e actualiza as tabelas;
    4. volta a ligar o sistema e confirma que responde. Se falhar, volta a versão anterior.
  Corre como administrador (o ACTUALIZAR-WINDOWS.bat pede). Erros: registos\ERRO-ACTUALIZACAO-<data>.txt no pendrive.
#>
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Pen = Split-Path -Parent $PSScriptRoot
$Destino = 'C:\ESG-Pessoal'
$Dados = Join-Path $Destino 'dados'
$Conf = Join-Path $Destino 'config'
$EnvFicheiro = Join-Path $Conf 'pessoal.env'
$Carimbo = Get-Date -Format 'yyyyMMdd-HHmmss'
$Reg = Join-Path $Pen 'registos'
try { New-Item -ItemType Directory -Force $Reg | Out-Null; [IO.File]::WriteAllText((Join-Path $Reg '.escrita'), 'x'); Remove-Item (Join-Path $Reg '.escrita') }
catch { $Reg = Join-Path $env:PUBLIC 'Documents\ESG-Pessoal-registos'; New-Item -ItemType Directory -Force $Reg | Out-Null }
$Log = Join-Path $Reg "actualizacao-$Carimbo.log"
$script:Passo = 'início'
$script:Trocado = $false
Start-Transcript -Path $Log -Force | Out-Null

function Passo($texto) { $script:Passo = $texto; Write-Host ''; Write-Host "=== [$(Get-Date -Format HH:mm:ss)] $texto" -ForegroundColor Cyan }
function Ok($t) { Write-Host "    v $t" -ForegroundColor Green }
function Falha($t) { throw $t }
function Correr($exe, [string[]]$argumentos) {
  & $exe @argumentos
  if ($LASTEXITCODE -ne 0) { Falha "$([IO.Path]::GetFileName($exe)) terminou com o código $LASTEXITCODE" }
}
function Responde {
  for ($i = 0; $i -lt 60; $i++) {
    try { if ((Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$($Cfg.PORT)/api/saude" -TimeoutSec 5).Content -match '"ok":true') { return $true } } catch { Start-Sleep 2 }
  }
  $false
}

trap {
  $erro = $_
  # se o código novo já estava no lugar, volta o anterior (a base fica como está: a cópia feita antes repõe-na)
  if ($script:Trocado -and (Test-Path "$Destino\sistema.anterior")) {
    Write-Host '    a voltar à versão anterior…' -ForegroundColor Yellow
    Stop-Service 'ESG-Pessoal-Copias', 'ESG-Pessoal' -Force -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force "$Destino\sistema" -ErrorAction SilentlyContinue
    Rename-Item "$Destino\sistema.anterior" 'sistema' -ErrorAction SilentlyContinue
    Start-Service 'ESG-Pessoal', 'ESG-Pessoal-Copias' -ErrorAction SilentlyContinue
  }
  try { Stop-Transcript | Out-Null } catch {}
  $f = Join-Path $Reg "ERRO-ACTUALIZACAO-$Carimbo.txt"
  $linhas = @(
    'ERRO NA ACTUALIZAÇÃO DO SISTEMA DE PESSOAL E QUADROS (Windows)',
    "Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')   Computador: $env:COMPUTERNAME",
    '',
    "Passo que falhou: $script:Passo",
    "Erro: $($erro.Exception.Message)",
    '',
    $(if ($script:Trocado) { 'O sistema voltou à versão anterior e continua a funcionar.' } else { 'Nada foi mudado: o sistema continua como estava.' }),
    "A cópia de segurança feita antes de actualizar está em $Dados\copias.",
    '',
    "ÚLTIMAS LINHAS DO REGISTO ($Log):"
  ) + @(Get-Content $Log -Tail 60 -ErrorAction SilentlyContinue)
  [IO.File]::WriteAllLines($f, [string[]]$linhas, (New-Object Text.UTF8Encoding $true))
  Write-Host ''
  Write-Host "!!! A actualização falhou no passo: $script:Passo" -ForegroundColor Red
  Write-Host "!!! $($erro.Exception.Message)" -ForegroundColor Red
  Write-Host "!!! Veja: $f" -ForegroundColor Yellow
  try { Start-Process notepad.exe $f } catch {}
  exit 1
}

Write-Host "Sistema de Gestão de Pessoal e Quadros — actualização para $((Get-Content (Join-Path $Pen 'VERSAO.txt') -Encoding UTF8 -ErrorAction SilentlyContinue) -join '')"
Write-Host "Registo: $Log"

Passo 'A verificar a instalação'
$eu = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $eu.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { Falha 'Tem de correr como administrador (use ACTUALIZAR-WINDOWS.bat).' }
if (-not (Test-Path $EnvFicheiro) -or -not (Test-Path "$Destino\sistema")) { Falha "O sistema não está instalado neste computador ($Destino). Para a primeira vez use INSTALAR-WINDOWS.bat." }
$Cfg = @{}
foreach ($l in Get-Content $EnvFicheiro -Encoding UTF8) { if ($l -match '^([A-Z_]+)=(.*)$') { $Cfg[$Matches[1]] = $Matches[2] } }
$Node = "$Destino\node\node.exe"
$PgBin = "$Destino\postgresql\bin"
Ok "instalado em $Destino (endereço: https://$($Cfg.ENDERECO))"

Passo 'A conferir os ficheiros do sistema no pendrive'
if (-not (Test-Path (Join-Path $Pen 'MANIFESTO.txt'))) { Falha 'Falta o MANIFESTO.txt: use a pasta ESG-PESSOAL preparada para o pendrive.' }
$maus = @()
foreach ($l in Get-Content (Join-Path $Pen 'MANIFESTO.txt')) {
  if (-not $l.Trim()) { continue }
  $rel = $l.Substring(66)
  if (-not $rel.StartsWith('sistema/')) { continue }
  $f = Join-Path $Pen ($rel -replace '/', '\')
  if (-not (Test-Path -LiteralPath $f) -or (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash -ne $l.Substring(0, 64).ToUpper()) { $maus += $rel }
}
if ($maus.Count) { Falha "Ficheiros em falta ou estragados no pendrive: $($maus -join ', ')" }
Ok 'todos os ficheiros conferem'

Passo 'A fazer uma cópia de segurança (base de dados e ficheiros)'
if ((Get-Service 'ESG-Pessoal-BD').Status -ne 'Running') { Start-Service 'ESG-Pessoal-BD' }
$env:PATH = "$PgBin;$env:PATH"
Push-Location "$Destino\sistema"
try { Correr $Node @("--env-file=$EnvFicheiro", 'scripts\copias.mjs', 'copiar', '--sistema', 'pessoal') } finally { Pop-Location }
Ok "cópia em $Dados\copias"

Passo 'A trocar o código do sistema'
Stop-Service 'ESG-Pessoal-Copias', 'ESG-Pessoal' -Force -ErrorAction SilentlyContinue
Start-Sleep 2
Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path -like "$Destino\node\*" } | Stop-Process -Force -ErrorAction SilentlyContinue
if (Test-Path "$Destino\sistema.anterior") { Remove-Item -Recurse -Force "$Destino\sistema.anterior" }
Rename-Item "$Destino\sistema" 'sistema.anterior'
$script:Trocado = $true
Copy-Item -Recurse (Join-Path $Pen 'sistema') "$Destino\sistema"
Ok 'código novo no lugar (o anterior ficou em sistema.anterior)'

Passo 'A actualizar as tabelas da base de dados'
Push-Location "$Destino\sistema"
try {
  Correr $Node @("--env-file=$EnvFicheiro", 'scripts\migrar.js')
  Correr $Node @("--env-file=$EnvFicheiro", 'scripts\instalar-organica.js', "$Destino\sistema\organica.json")
} finally { Pop-Location }
Ok 'base de dados actualizada'

# acertos da configuração que versões novas precisam (sem perguntar nada): a página /certificado
$raiz = "$Dados\caddy\pki\authorities\local\root.crt"
if (Test-Path $raiz) { New-Item -ItemType Directory -Force "$Destino\certificado" | Out-Null; Copy-Item $raiz "$Destino\certificado\esg-pessoal-raiz.crt" -Force }
$linhas = @(Get-Content $EnvFicheiro -Encoding UTF8)
if (-not ($linhas -match '^CERTIFICADO_RAIZ=')) { $linhas += "CERTIFICADO_RAIZ=$Destino\certificado\esg-pessoal-raiz.crt" }
if (-not ($linhas -match '^SERVIDOR_IP=')) {
  $ip = if ($Cfg.IP_SISTEMA) { $Cfg.IP_SISTEMA } else { (Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress | Select-Object -First 1 }
  $linhas += "SERVIDOR_IP=$ip"
}
[IO.File]::WriteAllLines($EnvFicheiro, [string[]]$linhas, (New-Object Text.UTF8Encoding $false))
$Caddyfile = Join-Path $Conf 'Caddyfile'
$caddyMudou = $false
if ((Test-Path $Caddyfile) -and -not (Select-String -Path $Caddyfile -Pattern '/certificado' -Quiet)) {
  (Get-Content $Caddyfile) -replace '^(\s*@ponto path /iclock/\*)\s*$', '$1 /certificado /certificado/*' | Set-Content -Path $Caddyfile -Encoding ASCII
  $caddyMudou = $true
}

Passo 'A ligar o sistema'
Start-Service 'ESG-Pessoal'
if (-not (Responde)) {
  Get-ChildItem "$Destino\servicos" -Filter 'ESG-Pessoal.*log' -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "    [$($_.Name)]"; Get-Content $_.FullName -Tail 30 | ForEach-Object { Write-Host "      $_" } }
  Falha 'O sistema não respondeu depois de actualizar.'
}
Start-Service 'ESG-Pessoal-Copias' -ErrorAction SilentlyContinue
if ($caddyMudou) { Restart-Service 'ESG-Pessoal-Web' -Force -ErrorAction SilentlyContinue }
$script:Trocado = $false
Ok 'o sistema responde'

$versao = (Get-Content (Join-Path $Pen 'VERSAO.txt') -Encoding UTF8 -ErrorAction SilentlyContinue) -join ''
$resumo = "Actualizado para $versao em $(Get-Date -Format 'yyyy-MM-dd HH:mm'). Endereço: https://$($Cfg.ENDERECO)$(if ($Cfg.PORTA_WEB -and $Cfg.PORTA_WEB -ne '443') { ":$($Cfg.PORTA_WEB)" })"
[IO.File]::WriteAllLines((Join-Path $Reg "ACTUALIZACAO-CONCLUIDA-$Carimbo.txt"), [string[]]@($resumo), (New-Object Text.UTF8Encoding $true))
Stop-Transcript | Out-Null
Write-Host ''
Write-Host '==============================================================' -ForegroundColor Green
Write-Host $resumo
Write-Host 'Os dados, as contas e a configuração ficaram como estavam.'
Write-Host '==============================================================' -ForegroundColor Green
