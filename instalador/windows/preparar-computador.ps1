# Prepara um computador da Repartição para abrir o sistema: o nome do servidor (enquanto o DNS da Escola
# não o tiver) e o certificado HTTPS (para o navegador confiar). Lê o que o instalador deixou em «registos».
$ErrorActionPreference = 'Stop'
$Pen = Split-Path -Parent $PSScriptRoot
$Reg = Join-Path $Pen 'registos'
try {
  $crt = Join-Path $Reg 'esg-pessoal-raiz.crt'
  if (-not (Test-Path $crt)) { throw 'Falta registos\esg-pessoal-raiz.crt: instale primeiro o sistema no servidor com este pendrive.' }
  $ip, $nome, $url = (Get-Content (Join-Path $Reg 'servidor.txt') -ErrorAction SilentlyContinue | Select-Object -First 1) -split ' '
  if (-not $nome) { $nome = 'esg.emfaa.gov.ao' }
  if (-not $url) { $url = "https://$nome" }
  $r = Read-Host "IP do servidor do sistema [$ip]"
  if ($r) { $ip = $r.Trim() }
  if ($ip -notmatch '^\d{1,3}(\.\d{1,3}){3}$') { throw "IP inválido: $ip" }
  $hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
  $linhas = @(Get-Content $hosts -ErrorAction SilentlyContinue | Where-Object { $_ -notmatch '# esg-pessoal$' }) + "$ip $nome # esg-pessoal"
  [IO.File]::WriteAllLines($hosts, [string[]]$linhas, (New-Object Text.ASCIIEncoding))
  Write-Host "[ok] $nome -> $ip (ficheiro hosts)" -ForegroundColor Green
  Import-Certificate -FilePath $crt -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
  Write-Host '[ok] certificado instalado (Chrome e Edge passam a confiar; no Firefox: Definições > Certificados > Importar)' -ForegroundColor Green
  ipconfig /flushdns | Out-Null
  Write-Host ''
  Write-Host "Pronto. Abra $url"
  Start-Process $url
} catch {
  Write-Host ''
  Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
