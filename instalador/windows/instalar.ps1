#Requires -Version 5.1
<#
  Instalação do Sistema de Gestão de Pessoal e Quadros (ESG) em Windows 10/11 ou Windows Server (64 bits),
  a partir do pendrive, sem internet. Corre como administrador (o INSTALAR-WINDOWS.bat pede).
  Se já estiver instalado, actualiza (os dados, as chaves e a configuração ficam).
  Em caso de falha escreve no pendrive registos\ERRO-INSTALACAO-<data>.txt com a causa e o que fazer.
#>
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Pen = Split-Path -Parent $PSScriptRoot
$Destino = 'C:\ESG-Pessoal'
$Dados = Join-Path $Destino 'dados'
$Conf = Join-Path $Destino 'config'
$PortaBd = 5433
$PortaApi = 3002
$Carimbo = Get-Date -Format 'yyyyMMdd-HHmmss'
$Reg = Join-Path $Pen 'registos'
try { New-Item -ItemType Directory -Force $Reg | Out-Null; [IO.File]::WriteAllText((Join-Path $Reg '.escrita'), 'x'); Remove-Item (Join-Path $Reg '.escrita') }
catch { $Reg = Join-Path $env:PUBLIC 'Documents\ESG-Pessoal-registos'; New-Item -ItemType Directory -Force $Reg | Out-Null }
$Log = Join-Path $Reg "instalacao-$Carimbo.log"
$script:Passo = 'início'
$script:Codigo = 'inicio'
Start-Transcript -Path $Log -Force | Out-Null

function Passo($codigo, $texto) { $script:Codigo = $codigo; $script:Passo = $texto; Write-Host ''; Write-Host "=== [$(Get-Date -Format HH:mm:ss)] $texto" -ForegroundColor Cyan }
function Ok($t) { Write-Host "    v $t" -ForegroundColor Green }
function Falha($t) { throw $t }
# corre um programa e pára se terminar com erro
function Correr($exe, [string[]]$argumentos) {
  & $exe @argumentos
  if ($LASTEXITCODE -ne 0) { Falha "$([IO.Path]::GetFileName($exe)) terminou com o código $LASTEXITCODE" }
}
function Aleatorio([int]$n = 64) {
  $b = New-Object byte[] ([Math]::Ceiling($n / 2)); [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  (($b | ForEach-Object { $_.ToString('x2') }) -join '').Substring(0, $n)
}
function Senha() {
  $alf = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'.ToCharArray()
  do {
    $b = New-Object byte[] 14; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    $s = -join ($b | ForEach-Object { $alf[$_ % $alf.Length] })
  } until ($s -match '\d' -and $s -match '[a-zA-Z]')
  $s
}
# descompacta um .zip para a pasta (se o .zip tiver uma só pasta lá dentro, tira esse nível)
function Descompactar($zip, $pasta) {
  $tmp = Join-Path $env:TEMP ("esg-" + [guid]::NewGuid())
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $itens = @(Get-ChildItem $tmp)
  $origem = if ($itens.Count -eq 1 -and $itens[0].PSIsContainer) { $itens[0].FullName } else { $tmp }
  if (Test-Path $pasta) { Remove-Item -Recurse -Force $pasta }
  New-Item -ItemType Directory -Force $pasta | Out-Null
  Get-ChildItem $origem -Force | Move-Item -Destination $pasta
  Remove-Item -Recurse -Force $tmp
}

function Causas {
  switch ($script:Codigo) {
    'admin' { '- O instalador não correu como administrador. Use INSTALAR-WINDOWS.bat e aceite o pedido do Windows (Sim).' }
    'sistema' { '- Este instalador é para Windows 10/11 ou Windows Server 2016+ de 64 bits.' }
    'pendrive' { '- A cópia no pendrive está incompleta ou estragada (um ficheiro não confere com o MANIFESTO.txt).'; '- Volte a copiar a pasta ESG-PESSOAL para o pendrive (no computador onde foi preparada) e repita.' }
    'espaco' { '- Falta espaço no disco C:. São precisos pelo menos 3 GB livres.' }
    'portas' { "- Outro programa está a usar uma porta de que o sistema precisa (443 HTTPS, 8085 aparelhos de ponto, $PortaBd, $PortaApi)."; '- Muitas vezes é o IIS, o Skype antigo ou outro servidor web. Veja qual com:  netstat -ano | findstr LISTENING  e pare-o.' }
    'copiar' { '- Não foi possível descompactar os componentes. O antivírus pode ter bloqueado (permita a pasta C:\ESG-Pessoal) ou o pendrive está estragado.' }
    'bd' { "- O PostgreSQL não arrancou. Veja o registo em $Dados\bd\log e no Visualizador de Eventos (Aplicação, origem PostgreSQL)."; '- Causas comuns: antivírus a bloquear postgres.exe, porta ocupada, o Visual C++ Redistributable (vem no pendrive, componentes\vcredist-windows.exe) não instalou.' }
    'migrar' { '- A base de dados não aceitou a estrutura do sistema. Veja a mensagem acima. Numa actualização: reponha a última cópia de segurança.' }
    'organica' { '- O Quadro Orgânico tem uma linha que o sistema não aceita. Carregue a orgânica depois em Orgânica > Importar.' }
    'servicos' { "- Um serviço não arrancou. Veja os registos em $Destino\servicos\*.log e em Serviços (services.msc), «ESG Pessoal»." }
    'verificar' { "- O sistema não respondeu. Veja $Destino\servicos\esg-pessoal.out.log e esg-pessoal.err.log." }
    default { "- Veja a mensagem de erro acima e o registo completo: $Log" }
  }
}

trap {
  $erro = $_
  try { Stop-Transcript | Out-Null } catch {}
  $f = Join-Path $Reg "ERRO-INSTALACAO-$Carimbo.txt"
  $os = (Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue)
  $linhas = @(
    'ERRO NA INSTALAÇÃO DO SISTEMA DE PESSOAL E QUADROS (Windows)',
    "Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')   Computador: $env:COMPUTERNAME   Sistema: $($os.Caption) $($os.Version)",
    '',
    "Passo que falhou: $script:Passo",
    "Erro: $($erro.Exception.Message)",
    "Onde: $($erro.InvocationInfo.PositionMessage)",
    '',
    'CAUSAS PROVÁVEIS E O QUE FAZER:'
  ) + @(Causas) + @(
    '',
    'Depois de corrigir, volte a correr o INSTALAR-WINDOWS.bat: continua e não apaga dados.',
    '',
    "ÚLTIMAS LINHAS DO REGISTO ($Log):"
  ) + @(Get-Content $Log -Tail 60 -ErrorAction SilentlyContinue)
  [IO.File]::WriteAllLines($f, [string[]]$linhas, (New-Object Text.UTF8Encoding $true))
  Write-Host ''
  Write-Host "!!! A instalação falhou no passo: $script:Passo" -ForegroundColor Red
  Write-Host "!!! $($erro.Exception.Message)" -ForegroundColor Red
  Write-Host "!!! As causas e o que fazer estão em: $f" -ForegroundColor Yellow
  try { Start-Process notepad.exe $f } catch {}
  exit 1
}

Write-Host "Sistema de Gestão de Pessoal e Quadros — instalação ($((Get-Content (Join-Path $Pen 'VERSAO.txt') -ErrorAction SilentlyContinue) -join ''))"
Write-Host "Registo: $Log"

Passo 'admin' 'A verificar as permissões'
$eu = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $eu.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { Falha 'Tem de correr como administrador.' }
Ok 'administrador'

Passo 'sistema' 'A verificar o computador'
if (-not [Environment]::Is64BitOperatingSystem) { Falha 'O Windows não é de 64 bits.' }
$ver = [Environment]::OSVersion.Version
if ($ver.Major -lt 10) { Falha "Windows demasiado antigo ($ver): é preciso o Windows 10/11 ou Server 2016 ou mais recente." }
Ok "$((Get-CimInstance Win32_OperatingSystem).Caption) ($ver)"

Passo 'pendrive' 'A conferir os ficheiros do pendrive (MANIFESTO)'
$maus = @()
foreach ($l in Get-Content (Join-Path $Pen 'MANIFESTO.txt')) {
  if (-not $l.Trim()) { continue }
  $soma = $l.Substring(0, 64); $rel = $l.Substring(66)
  $f = Join-Path $Pen ($rel -replace '/', '\')
  if (-not (Test-Path -LiteralPath $f) -or (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash -ne $soma.ToUpper()) { $maus += $rel }
}
if ($maus.Count) { Falha "Ficheiros em falta ou estragados no pendrive: $($maus -join ', ')" }
Ok 'todos os ficheiros conferem'

Passo 'espaco' 'A verificar o espaço em disco'
$livre = [Math]::Floor((Get-PSDrive C).Free / 1MB)
if ($livre -lt 3000) { Falha "Só há $livre MB livres no disco C:." }
Ok "$livre MB livres"

$Atualizar = Test-Path (Join-Path $Conf 'pessoal.env')
$Servicos = 'ESG-Pessoal-Copias', 'ESG-Pessoal-Web', 'ESG-Pessoal'
if ($Atualizar) {
  Write-Host ''; Write-Host '>>> Já está instalado: vai ser ACTUALIZADO (os dados, as chaves e a configuração ficam).' -ForegroundColor Yellow
  foreach ($s in $Servicos) { if (Get-Service $s -ErrorAction SilentlyContinue) { Stop-Service $s -Force -ErrorAction SilentlyContinue } }
}

Passo 'portas' 'A verificar as portas'
foreach ($p in 443, 8085, $PortaApi, $PortaBd) {
  $uso = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
  if ($uso) {
    if ($Atualizar -and $p -eq $PortaBd) { continue }
    $prog = ($uso | ForEach-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName }) -join ', '
    Falha "A porta $p já está ocupada por: $prog"
  }
}
Ok "443, 8085, $PortaApi e $PortaBd livres"

if (-not $Atualizar) {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress
  if (-not $ip) { $ip = 'localhost' }
  $Endereco = if ($env:ESG_ENDERECO) { $env:ESG_ENDERECO } else { Read-Host "Endereço do sistema na rede da Escola (nome ou IP) [$ip]" }
  if (-not $Endereco) { $Endereco = $ip }
  $AdminEmail = if ($env:ESG_ADMIN_EMAIL) { $env:ESG_ADMIN_EMAIL } else { Read-Host 'E-mail do administrador do sistema [pessoal@esgfaa.gov.ao]' }
  if (-not $AdminEmail) { $AdminEmail = 'pessoal@esgfaa.gov.ao' }
}

Passo 'copiar' "A instalar os componentes (Node.js, PostgreSQL, Caddy) em $Destino"
foreach ($d in $Destino, $Dados, $Conf, "$Dados\ficheiros", "$Dados\copias", "$Dados\caddy", "$Destino\servicos", "$Destino\certificado") { New-Item -ItemType Directory -Force $d | Out-Null }
# só o sistema (SYSTEM) e os administradores entram na pasta (SID: os nomes mudam com a língua do Windows)
& icacls $Destino /inheritance:r /grant:r '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' /T /Q | Out-Null
$C = Join-Path $Pen 'componentes'
Descompactar "$C\node-windows.zip" "$Destino\node"
Descompactar "$C\postgresql-windows.zip" "$Destino\postgresql"
Descompactar "$C\caddy-windows.zip" "$Destino\caddy"
if (Test-Path "$Destino\sistema.anterior") { Remove-Item -Recurse -Force "$Destino\sistema.anterior" }
if (Test-Path "$Destino\sistema") { Rename-Item "$Destino\sistema" 'sistema.anterior' }
Copy-Item -Recurse (Join-Path $Pen 'sistema') "$Destino\sistema"
# o PostgreSQL precisa do Visual C++ 2015-2022 (x64); se faltar, instala-se o que vem no pendrive
if (-not (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64' -ErrorAction SilentlyContinue).Installed) {
  Write-Host '    a instalar o Visual C++ Redistributable (x64)…'
  $p = Start-Process -FilePath "$C\vcredist-windows.exe" -ArgumentList '/install', '/quiet', '/norestart' -Wait -PassThru
  if ($p.ExitCode -notin 0, 1638, 3010) { Falha "O Visual C++ Redistributable não instalou (código $($p.ExitCode))." }
}
$Node = "$Destino\node\node.exe"
$PgBin = "$Destino\postgresql\bin"
Correr $Node @('-v')
Correr "$PgBin\postgres.exe" @('--version')
Ok 'componentes no lugar'

$EnvFicheiro = Join-Path $Conf 'pessoal.env'
if (-not $Atualizar) {
  $BdSenha = Aleatorio 40
  $AdminSenha = Senha
  $env_ = @(
    "# Sistema de Gestão de Pessoal e Quadros — criado pelo instalador em $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
    '# GUARDE UMA CÓPIA DESTE FICHEIRO NUM COFRE: sem DADOS_CHAVE os dados pessoais não se lêem; sem COPIAS_CHAVE as cópias não abrem.',
    'NODE_ENV=production', 'HOST=127.0.0.1', "PORT=$PortaApi", 'TRUST_PROXY=1',
    "ENDERECO=$Endereco", "CORS_ORIGINS=https://$Endereco",
    "DATABASE_URL=postgresql://pessoal:$BdSenha@127.0.0.1:$PortaBd/esgfaa_pessoal", "BD_SENHA=$BdSenha",
    "JWT_SECRET=$(Aleatorio 64)", "DADOS_CHAVE=$(Aleatorio 64)", "COPIAS_CHAVE=$(Aleatorio 64)",
    "ADMIN_EMAIL=$AdminEmail", "ADMIN_PASSWORD=$AdminSenha",
    'REDES_INTERNAS=127.0.0.1/32,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16',
    "APP_DIR=$Destino\sistema\app", "DATA_DIR=$Dados\ficheiros",
    "PESSOAL_DATABASE_URL=postgresql://pessoal:$BdSenha@127.0.0.1:$PortaBd/esgfaa_pessoal", "PESSOAL_DADOS=$Dados\ficheiros", "COPIAS_DIR=$Dados\copias",
    "BI_API_KEY=$env:ESG_BI_API_KEY", 'PORTAL_API_URL=', 'INTEGRACAO_CHAVE=', 'TZ=Africa/Luanda'
  )
  [IO.File]::WriteAllLines($EnvFicheiro, [string[]]$env_, (New-Object Text.UTF8Encoding $false))
}
$Cfg = @{}
foreach ($l in Get-Content $EnvFicheiro) { if ($l -match '^([A-Z_]+)=(.*)$') { $Cfg[$Matches[1]] = $Matches[2] } }
$Endereco = $Cfg.ENDERECO; $AdminEmail = $Cfg.ADMIN_EMAIL

Passo 'bd' "A preparar a base de dados (PostgreSQL na porta $PortaBd, só nesta máquina)"
$BdDir = "$Dados\bd"
if (-not (Test-Path "$BdDir\PG_VERSION")) {
  $pw = Join-Path $env:TEMP "esg-pw-$Carimbo.txt"
  [IO.File]::WriteAllText($pw, $Cfg.BD_SENHA)
  try { Correr "$PgBin\initdb.exe" @('-D', $BdDir, '-U', 'pessoal', "--pwfile=$pw", '-E', 'UTF8', '--no-locale', '--auth=scram-sha-256') } finally { Remove-Item $pw -Force -ErrorAction SilentlyContinue }
  Add-Content "$BdDir\postgresql.conf" "`nlisten_addresses = '127.0.0.1'`nport = $PortaBd`nlogging_collector = on`n"
}
# serviço do PostgreSQL (conta do sistema; o pg_ctl tira-lhe os privilégios de administrador ao arrancar)
if (-not (Get-Service 'ESG-Pessoal-BD' -ErrorAction SilentlyContinue)) {
  Correr "$PgBin\pg_ctl.exe" @('register', '-N', 'ESG-Pessoal-BD', '-D', $BdDir, '-S', 'auto')
}
Start-Service 'ESG-Pessoal-BD'
$pronto = $false
for ($i = 0; $i -lt 60 -and -not $pronto; $i++) { & "$PgBin\pg_isready.exe" -h 127.0.0.1 -p $PortaBd -q; $pronto = ($LASTEXITCODE -eq 0); if (-not $pronto) { Start-Sleep 1 } }
if (-not $pronto) { Falha 'O PostgreSQL não ficou pronto em 60 segundos.' }
$env:PGPASSWORD = $Cfg.BD_SENHA
$existe = & "$PgBin\psql.exe" -h 127.0.0.1 -p $PortaBd -U pessoal -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='esgfaa_pessoal'"
if ("$existe".Trim() -ne '1') { Correr "$PgBin\createdb.exe" @('-h', '127.0.0.1', '-p', "$PortaBd", '-U', 'pessoal', 'esgfaa_pessoal') }
Ok 'base de dados pronta'

Push-Location "$Destino\sistema"
Passo 'migrar' 'A criar/actualizar as tabelas'
Correr $Node @("--env-file=$EnvFicheiro", 'scripts\migrar.js')

Passo 'organica' 'A carregar o Quadro Orgânico (unidades e cargos)'
Correr $Node @("--env-file=$EnvFicheiro", 'scripts\instalar-organica.js', "$Destino\sistema\organica.json")
Pop-Location

Passo 'servicos' 'A ligar os serviços (sistema, HTTPS e cópias de segurança diárias)'
$Caddyfile = Join-Path $Conf 'Caddyfile'
$storage = ("$Dados\caddy" -replace '\\', '/')
$sites = if ($Endereco -eq 'localhost') { 'localhost' } else { "$Endereco, localhost" }
@"
# HTTPS com a autoridade interna do Caddy (o certificado da raiz instala-se nos computadores da Repartição)
{
	storage file_system $storage
	skip_install_trust
}
$sites {
	tls internal
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options nosniff
		Referrer-Policy no-referrer
		X-Frame-Options DENY
		-Server
	}
	reverse_proxy 127.0.0.1:$PortaApi
}

# aparelhos de ponto (impressão digital): só /iclock
:8085 {
	@ponto path /iclock/*
	reverse_proxy @ponto 127.0.0.1:$PortaApi
	respond 404
}
"@ | Set-Content -Path $Caddyfile -Encoding ASCII

# cada serviço é o WinSW com um .xml ao lado (arranca com o Windows e volta a arrancar se cair)
function Servico($id, $nome, $exe, $argumentos, $extra = '') {
  $dir = "$Destino\servicos"
  Copy-Item (Join-Path $Pen 'componentes\winsw.exe') "$dir\$id.exe" -Force
  @"
<service>
  <id>$id</id>
  <name>$nome</name>
  <description>Sistema de Gestão de Pessoal e Quadros da ESG</description>
  <executable>$exe</executable>
  <arguments>$argumentos</arguments>
  <workingdirectory>$Destino\sistema</workingdirectory>
  <startmode>Automatic</startmode>
  <depend>ESG-Pessoal-BD</depend>
  <onfailure action="restart" delay="10 sec"/>
  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>5</keepFiles></log>
  <logpath>$dir</logpath>
  <env name="TZ" value="Africa/Luanda"/>
$extra
</service>
"@ | Set-Content -Path "$dir\$id.xml" -Encoding UTF8
  if (-not (Get-Service $id -ErrorAction SilentlyContinue)) { Correr "$dir\$id.exe" @('install') }
}
Servico 'ESG-Pessoal' 'ESG Pessoal — sistema' $Node "--env-file=&quot;$EnvFicheiro&quot; src\servidor.js"
Servico 'ESG-Pessoal-Web' 'ESG Pessoal — HTTPS (Caddy)' "$Destino\caddy\caddy.exe" "run --config &quot;$Caddyfile&quot; --adapter caddyfile" "  <env name=`"AppData`" value=`"$Dados\caddy`"/>"
Servico 'ESG-Pessoal-Copias' 'ESG Pessoal — cópias de segurança diárias' $Node "--env-file=&quot;$EnvFicheiro&quot; scripts\copias.mjs agendar --sistema pessoal" "  <env name=`"PATH`" value=`"$PgBin;%PATH%`"/>"
foreach ($s in 'ESG-Pessoal', 'ESG-Pessoal-Web', 'ESG-Pessoal-Copias') { Restart-Service $s -Force }

# firewall: HTTPS e os aparelhos de ponto, só nas redes do domínio e privadas
foreach ($r in @(@('ESG Pessoal (HTTPS)', 443), @('ESG Pessoal (aparelhos de ponto)', 8085))) {
  if (-not (Get-NetFirewallRule -DisplayName $r[0] -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName $r[0] -Direction Inbound -Protocol TCP -LocalPort $r[1] -Action Allow -Profile Domain, Private | Out-Null }
}
Ok 'serviços ligados (services.msc: «ESG Pessoal»)'

Passo 'verificar' 'A verificar se o sistema responde'
$ok = $false
for ($i = 0; $i -lt 60 -and -not $ok; $i++) {
  try { $r = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$PortaApi/api/saude" -TimeoutSec 5; $ok = $r.Content -match '"ok":true' } catch { Start-Sleep 2 }
}
if (-not $ok) { Falha "O sistema não respondeu em http://127.0.0.1:$PortaApi/api/saude" }
Ok 'o sistema responde'
$raiz = "$Dados\caddy\pki\authorities\local\root.crt"
for ($i = 0; $i -lt 30 -and -not (Test-Path $raiz); $i++) { Start-Sleep 1 }
if (Test-Path $raiz) {
  Copy-Item $raiz "$Destino\certificado\esg-pessoal-raiz.crt" -Force
  Copy-Item $raiz (Join-Path $Reg 'esg-pessoal-raiz.crt') -Force -ErrorAction SilentlyContinue
  # este computador confia no certificado (os outros: instalar o .crt em «Autoridades de certificação de raiz fidedignas»)
  Import-Certificate -FilePath $raiz -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
  Ok 'certificado HTTPS criado e instalado neste computador'
}

# a palavra-passe inicial já criou o administrador: não fica no ficheiro de configuração
$AdminSenha = $Cfg.ADMIN_PASSWORD
[IO.File]::WriteAllLines($EnvFicheiro, [string[]]((Get-Content $EnvFicheiro -Encoding UTF8) -replace '^ADMIN_PASSWORD=.*', 'ADMIN_PASSWORD='), (New-Object Text.UTF8Encoding $false))

$resumo = @(
  "SISTEMA DE GESTÃO DE PESSOAL E QUADROS — instalado em $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
  '',
  "Endereço:              https://$Endereco",
  "Administrador:         $AdminEmail"
)
if (-not $Atualizar -and $AdminSenha) { $resumo += "Palavra-passe inicial: $AdminSenha   (na primeira entrada pede a verificação em dois passos)" }
$resumo += @(
  '',
  'Certificado (instale nos outros computadores da Repartição para o navegador confiar):',
  "   $Destino\certificado\esg-pessoal-raiz.crt   (cópia no pendrive: registos\esg-pessoal-raiz.crt)",
  "Configuração e chaves: $EnvFicheiro — GUARDE UMA CÓPIA NUM COFRE (fora deste computador)",
  "Cópias de segurança:   $Dados\copias (todos os dias às 2h)",
  'Serviços:              services.msc — ESG-Pessoal, ESG-Pessoal-BD, ESG-Pessoal-Web, ESG-Pessoal-Copias'
)
$fResumo = Join-Path $Conf 'INSTALACAO.txt'
[IO.File]::WriteAllLines($fResumo, [string[]]$resumo, (New-Object Text.UTF8Encoding $true))
[IO.File]::WriteAllLines((Join-Path $Reg "INSTALACAO-CONCLUIDA-$Carimbo.txt"), [string[]]($resumo | Where-Object { $_ -notlike 'Palavra-passe inicial*' }), (New-Object Text.UTF8Encoding $true))

Write-Host 'Instalação concluída.'
# o registo (no pendrive) fecha antes de mostrar a palavra-passe: ela não fica escrita no pendrive
Stop-Transcript | Out-Null
Write-Host ''
Write-Host '==============================================================' -ForegroundColor Green
$resumo | ForEach-Object { Write-Host $_ }
Write-Host '==============================================================' -ForegroundColor Green
Write-Host "O resumo (com a palavra-passe) fica em $fResumo (só os administradores o lêem)."
Start-Process "https://localhost"
