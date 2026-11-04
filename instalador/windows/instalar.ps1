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
# corre um programa sem mostrar nada e sem parar por avisos que ele escreva (no PowerShell 5.1, o stderr de um
# programa redireccionado com $ErrorActionPreference = 'Stop' pára tudo); devolve o que ele escreveu
function Calado($exe, [string[]]$argumentos) {
  $ErrorActionPreference = 'Continue'
  $saida = & $exe @argumentos 2>&1 | ForEach-Object { "$_" }
  $global:LASTEXITCODE = 0
  $saida
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
# apaga uma pasta do programa; se o Windows recusar (permissões estragadas por uma tentativa interrompida, ou o
# antivírus a ler um ficheiro), os administradores retomam-na e tenta-se outra vez; se ainda assim não der, põe-se de lado
function LimparPasta($pasta) {
  if (-not (Test-Path $pasta)) { return }
  try { Remove-Item -Recurse -Force $pasta -ErrorAction Stop; return } catch { Write-Host "    (não se apagou à primeira: $($_.Exception.Message))" }
  Calado icacls @($pasta, '/setowner', '*S-1-5-32-544', '/T', '/C', '/Q') | Out-Null
  Calado icacls @($pasta, '/grant', '*S-1-5-32-544:(OI)(CI)F', '*S-1-5-18:(OI)(CI)F', '/T', '/C', '/Q') | Out-Null
  Get-ChildItem $pasta -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object { try { $_.Attributes = 'Normal' } catch { } }
  Start-Sleep 2
  try { Remove-Item -Recurse -Force $pasta -ErrorAction Stop; return } catch { Write-Host "    (ainda presa: $($_.Exception.Message))" }
  $lado = "$pasta.velha-$Carimbo"
  try { Rename-Item $pasta (Split-Path -Leaf $lado) -ErrorAction Stop } catch { Falha "Não foi possível apagar nem pôr de lado $pasta ($($_.Exception.Message)). Reinicie o computador e corra outra vez o instalador." }
  Write-Host "    a pasta antiga ficou em $lado (pode apagá-la depois de reiniciar)" -ForegroundColor Yellow
}
# descompacta um .zip para a pasta (se o .zip tiver uma só pasta lá dentro, tira esse nível)
function Descompactar($zip, $pasta) {
  $tmp = Join-Path $env:TEMP ("esg-" + [guid]::NewGuid())
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  $itens = @(Get-ChildItem $tmp)
  $origem = if ($itens.Count -eq 1 -and $itens[0].PSIsContainer) { $itens[0].FullName } else { $tmp }
  LimparPasta $pasta
  New-Item -ItemType Directory -Force $pasta | Out-Null
  Get-ChildItem $origem -Force | Move-Item -Destination $pasta
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

function Causas {
  switch ($script:Codigo) {
    'admin' { '- O instalador não correu como administrador. Use INSTALAR-WINDOWS.bat e aceite o pedido do Windows (Sim).' }
    'sistema' { '- Este instalador é para Windows 10/11 ou Windows Server 2016+ de 64 bits.' }
    'pendrive' { '- A cópia no pendrive está incompleta ou estragada (um ficheiro não confere com o MANIFESTO.txt).'; '- Volte a copiar a pasta ESG-PESSOAL para o pendrive (no computador onde foi preparada) e repita.' }
    'espaco' { '- Falta espaço no disco C:. São precisos pelo menos 3 GB livres.' }
    'portas' { "- Outro programa está a usar uma porta de que o sistema precisa (8085 aparelhos de ponto, $PortaBd, $PortaApi; para o HTTPS usa-se a 443 ou, se estiver ocupada, a 8443, 9443 ou 10443)."; '- O instalador não pára nenhum serviço do servidor. Veja quem usa as portas com:  netstat -ano | findstr LISTENING   e   netsh http show servicestate'; '- «System» é o HTTP.sys do Windows (VPN SSTP, IIS, Windows Admin Center…).' }
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

Write-Host "Sistema de Gestão de Pessoal e Quadros — instalação ($((Get-Content (Join-Path $Pen 'VERSAO.txt') -Encoding UTF8 -ErrorAction SilentlyContinue) -join ''))"
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
# a base também pára: os programas (postgres.exe) vão ser trocados; volta a arrancar no passo da base
$Servicos = 'ESG-Pessoal-Copias', 'ESG-Pessoal-Web', 'ESG-Pessoal', 'ESG-Pessoal-BD'
if ($Atualizar) {
  $texto = if (Test-Path (Join-Path $Conf 'INSTALACAO.txt')) { '>>> Já está instalado: vai ser ACTUALIZADO (os dados, as chaves e a configuração ficam).' } else { '>>> Uma instalação anterior ficou a meio: continua-se daí (a configuração e as chaves já criadas ficam).' }
  Write-Host ''; Write-Host $texto -ForegroundColor Yellow
  foreach ($s in $Servicos) { if (Get-Service $s -ErrorAction SilentlyContinue) { Stop-Service $s -Force -ErrorAction SilentlyContinue } }
}

Passo 'portas' 'A verificar as portas'
# quem está numa porta (para o registo). O processo «System» é o HTTP.sys do Windows: os serviços que lá
# registaram endereços (VPN SSTP, IIS, Windows Admin Center…) descobrem-se pelo netsh.
function Livre($p) { -not (Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue) }
function QuemUsa($porta) {
  $uso = Get-NetTCPConnection -State Listen -LocalPort $porta -ErrorAction SilentlyContinue
  $prog = @($uso | ForEach-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName } | Select-Object -Unique)
  if ($prog -notcontains 'System') { return ($prog -join ', ') }
  $pids = @(); $dentro = $false; $pidsGrupo = @(); $urlGrupo = $false; $urls = @()
  # cada fila começa numa linha sem recuo; dentro dela, os grupos de URL repetem «Request queue name» com recuo
  foreach ($l in @(Calado netsh @('http', 'show', 'servicestate', 'view=requestq', 'verbose=no')) + 'Request queue name:') {
    if ($l -match '^Request queue name:') { if ($urlGrupo) { $pids += $pidsGrupo }; $pidsGrupo = @(); $urlGrupo = $false; $dentro = $false; continue }
    if ($l -match 'Process IDs:') { $dentro = $true; continue }
    if ($dentro -and $l -match '^\s+(\d+)\s*$') { $pidsGrupo += [int]$Matches[1]; continue }
    $dentro = $false
    if ($l -match "^\s+(https?://[^/]*:$porta/\S*)") { $urlGrupo = $true; $urls += $Matches[1] }
  }
  $svc = @(Get-CimInstance Win32_Service -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Running' -and $pids -contains [int]$_.ProcessId } | ForEach-Object { "$($_.DisplayName) [$($_.Name)]" })
  $quem = if ($svc.Count) { $svc -join '; ' } else { 'HTTP.sys do Windows' }
  if ($urls.Count) { "$quem ($($urls -join ', '))" } else { $quem }
}
# o HTTPS fica na 443 se estiver livre; senão, na primeira livre destas. Nenhum serviço do servidor é parado.
$anterior = if ($Atualizar) { (Select-String -Path (Join-Path $Conf 'pessoal.env') -Pattern '^PORTA_WEB=(\d+)' -ErrorAction SilentlyContinue).Matches | ForEach-Object { [int]$_.Groups[1].Value } | Select-Object -First 1 }
$PortaWeb = $null
foreach ($c in @(@($anterior) + 443, 8443, 9443, 10443 | Where-Object { $_ } | Select-Object -Unique)) {
  if (Livre $c) { $PortaWeb = $c; break }
  Write-Host "    a porta $c está ocupada por: $(QuemUsa $c) — fica como está" -ForegroundColor Yellow
}
if (-not $PortaWeb) { Falha 'As portas 443, 8443, 9443 e 10443 estão todas ocupadas: não há porta para o HTTPS.' }
# a porta 80 (se estiver livre) só serve para levar quem escreve http://… ao endereço certo
$PortaHttp = if (Livre 80) { 80 } else { $null }
if (-not $PortaHttp) { Write-Host "    a porta 80 está ocupada por: $(QuemUsa 80) — fica como está (escreve-se o endereço completo)" -ForegroundColor Yellow }
foreach ($p in 8085, $PortaApi, $PortaBd) {
  if (-not (Livre $p)) {
    if ($Atualizar -and $p -eq $PortaBd) { continue }
    Falha "A porta $p já está ocupada por: $(QuemUsa $p)"
  }
}
Ok "HTTPS na porta $PortaWeb$(if ($PortaHttp) { ' (e 80 para encaminhar)' }); 8085, $PortaApi e $PortaBd livres"

# o sistema abre-se só pelo nome (nunca pelo IP)
$Dominio = if ($env:ESG_ENDERECO) { $env:ESG_ENDERECO } else { 'esg.emfaa.gov.ao' }
$Endereco = $Dominio
$Url = if ($PortaWeb -eq 443) { "https://$Endereco" } else { "https://${Endereco}:$PortaWeb" }
$Origens = (@("https://$Endereco", $Url) | Select-Object -Unique) -join ','
$ip = (Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress | Select-Object -First 1
if (-not $ip) { $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress }
# a conta de administrador do sistema: o nome, o e-mail com que entra e a palavra-passe (escolhida ou gerada)
$SenhaEscolhida = $false
if (-not $Atualizar) {
  Write-Host ''
  Write-Host 'CONTA DE ADMINISTRADOR DO SISTEMA (entra com o e-mail e a palavra-passe)' -ForegroundColor Cyan
  $AdminNome = if ($env:ESG_ADMIN_NOME) { $env:ESG_ADMIN_NOME } else { Read-Host '  Nome [Administrador do Pessoal]' }
  if (-not $AdminNome) { $AdminNome = 'Administrador do Pessoal' }
  $AdminNome = $AdminNome -replace '"', ''
  do {
    $AdminEmail = if ($env:ESG_ADMIN_EMAIL) { $env:ESG_ADMIN_EMAIL } else { Read-Host '  E-mail [pessoal@esgfaa.gov.ao]' }
    if (-not $AdminEmail) { $AdminEmail = 'pessoal@esgfaa.gov.ao' }
    $AdminEmail = $AdminEmail.Trim().ToLower()
    $bom = $AdminEmail -match '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    if (-not $bom) { if ($env:ESG_ADMIN_EMAIL) { Falha "E-mail inválido: $AdminEmail" }; Write-Host '  E-mail inválido.' -ForegroundColor Red }
  } until ($bom)
  $AdminSenha = $null
  if (-not $env:ESG_ADMIN_EMAIL) {
    Write-Host '  Palavra-passe: pelo menos 10 caracteres, com letras e números (sem espaços, aspas nem #).'
    Write-Host '  Deixe em branco para o instalador gerar uma (mostrada no fim).'
    while ($true) {
      $a = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR((Read-Host '  Palavra-passe' -AsSecureString)))
      if (-not $a) { break }
      $erroSenha = if ($a.Length -lt 10) { 'Tem de ter pelo menos 10 caracteres.' } elseif ($a -notmatch '[a-zA-Z]' -or $a -notmatch '\d') { 'Tem de ter letras e números.' } elseif ($a -match '[\s"''#\\]') { 'Sem espaços, aspas, # nem \.' } elseif ($a.ToLower().Contains($AdminEmail.Split('@')[0])) { 'Não pode conter o nome do e-mail.' } else { $null }
      if ($erroSenha) { Write-Host "  $erroSenha" -ForegroundColor Red; continue }
      $b = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR((Read-Host '  Repita a palavra-passe' -AsSecureString)))
      if ($a -ne $b) { Write-Host '  Não são iguais. Escreva outra vez.' -ForegroundColor Red; continue }
      $AdminSenha = $a; $SenhaEscolhida = $true; break
    }
  }
}

Passo 'copiar' "A instalar os componentes (Node.js, PostgreSQL, Caddy) em $Destino"
foreach ($d in $Destino, $Dados, $Conf, "$Dados\ficheiros", "$Dados\copias", "$Dados\caddy", "$Destino\servicos", "$Destino\certificado") { New-Item -ItemType Directory -Force $d | Out-Null }
# programas que tenham ficado a correr desta pasta (p. ex. de uma tentativa interrompida) prendem os ficheiros
Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path -like "$Destino\*" } | ForEach-Object { Write-Host "    a parar $($_.ProcessName) (PID $($_.Id)), que corria de $Destino"; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
$C = Join-Path $Pen 'componentes'
Descompactar "$C\node-windows.zip" "$Destino\node"
Descompactar "$C\postgresql-windows.zip" "$Destino\postgresql"
Descompactar "$C\caddy-windows.zip" "$Destino\caddy"
LimparPasta "$Destino\sistema.anterior"
if (Test-Path "$Destino\sistema") { try { Rename-Item "$Destino\sistema" 'sistema.anterior' -ErrorAction Stop } catch { LimparPasta "$Destino\sistema" } }
Copy-Item -Recurse (Join-Path $Pen 'sistema') "$Destino\sistema"
# só o sistema (SYSTEM) e os administradores entram na pasta (SID: os nomes mudam com a língua do Windows);
# aplica-se depois de copiar, para tudo o que lá está ficar igual
Calado icacls @($Destino, '/inheritance:r', '/grant:r', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F', '/T', '/C', '/Q') | Out-Null
# o initdb do PostgreSQL corre sem os direitos de administrador (mesmo lançado pelo administrador): fica só com
# a conta de quem instala, que precisa de ler o programa (e de escrever na pasta da base, abaixo)
$EuSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
Calado icacls @($Destino, '/grant', "*${EuSid}:(OI)(CI)RX", '*S-1-5-20:(OI)(CI)RX', '/T', '/C', '/Q') | Out-Null
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
  if (-not $AdminSenha) { $AdminSenha = Senha }
  $env_ = @(
    "# Sistema de Gestão de Pessoal e Quadros — criado pelo instalador em $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
    '# GUARDE UMA CÓPIA DESTE FICHEIRO NUM COFRE: sem DADOS_CHAVE os dados pessoais não se lêem; sem COPIAS_CHAVE as cópias não abrem.',
    'NODE_ENV=production', 'HOST=127.0.0.1', "PORT=$PortaApi", 'TRUST_PROXY=1',
    "ENDERECO=$Endereco", "PORTA_WEB=$PortaWeb", "CORS_ORIGINS=$Origens",
    "DATABASE_URL=postgresql://pessoal:$BdSenha@127.0.0.1:$PortaBd/esgfaa_pessoal", "BD_SENHA=$BdSenha",
    "JWT_SECRET=$(Aleatorio 64)", "DADOS_CHAVE=$(Aleatorio 64)", "COPIAS_CHAVE=$(Aleatorio 64)",
    "ADMIN_NOME=`"$AdminNome`"", "ADMIN_EMAIL=$AdminEmail", "ADMIN_PASSWORD=$AdminSenha",
    'REDES_INTERNAS=127.0.0.1/32,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16',
    "APP_DIR=$Destino\sistema\app", "DATA_DIR=$Dados\ficheiros",
    "PESSOAL_DATABASE_URL=postgresql://pessoal:$BdSenha@127.0.0.1:$PortaBd/esgfaa_pessoal", "PESSOAL_DADOS=$Dados\ficheiros", "COPIAS_DIR=$Dados\copias",
    "BI_API_KEY=$env:ESG_BI_API_KEY", 'PORTAL_API_URL=', 'INTEGRACAO_CHAVE=', 'TZ=Africa/Luanda'
  )
  [IO.File]::WriteAllLines($EnvFicheiro, [string[]]$env_, (New-Object Text.UTF8Encoding $false))
}
# numa actualização de uma instalação antiga (aberta pelo IP), passa a ser pelo nome
$linhasEnv = @((Get-Content $EnvFicheiro -Encoding UTF8) -replace '^ENDERECO=.*', "ENDERECO=$Dominio" -replace '^CORS_ORIGINS=.*', "CORS_ORIGINS=$Origens" -replace '^PORTA_WEB=.*', "PORTA_WEB=$PortaWeb")
if (-not ($linhasEnv -match '^PORTA_WEB=')) { $linhasEnv += "PORTA_WEB=$PortaWeb" }
[IO.File]::WriteAllLines($EnvFicheiro, [string[]]$linhasEnv, (New-Object Text.UTF8Encoding $false))
$Cfg = @{}
foreach ($l in Get-Content $EnvFicheiro) { if ($l -match '^([A-Z_]+)=(.*)$') { $Cfg[$Matches[1]] = $Matches[2] } }
$Endereco = $Cfg.ENDERECO; $AdminEmail = $Cfg.ADMIN_EMAIL

Passo 'bd' "A preparar a base de dados (PostgreSQL na porta $PortaBd, só nesta máquina)"
$BdDir = "$Dados\bd"
if (-not (Test-Path "$BdDir\PG_VERSION")) {
  # restos de uma tentativa falhada (ainda sem base): o initdb quer a pasta vazia
  LimparPasta $BdDir
  New-Item -ItemType Directory -Force $BdDir | Out-Null
  Calado icacls @($BdDir, '/grant', "*${EuSid}:(OI)(CI)F", '*S-1-5-20:(OI)(CI)F', '*S-1-5-18:(OI)(CI)F', '/T', '/C', '/Q') | Out-Null
  $pw = Join-Path $env:TEMP "esg-pw-$Carimbo.txt"
  [IO.File]::WriteAllText($pw, $Cfg.BD_SENHA)
  try { Correr "$PgBin\initdb.exe" @('-D', $BdDir, '-U', 'pessoal', "--pwfile=$pw", '-E', 'UTF8', '--no-locale', '--auth=scram-sha-256') } finally { Remove-Item $pw -Force -ErrorAction SilentlyContinue }
  Add-Content "$BdDir\postgresql.conf" "`nlisten_addresses = '127.0.0.1'`nport = $PortaBd`nlogging_collector = on`n"
}
# serviço do PostgreSQL (conta do sistema; o pg_ctl tira-lhe os privilégios de administrador ao arrancar)
if (-not (Get-Service 'ESG-Pessoal-BD' -ErrorAction SilentlyContinue)) {
  Correr "$PgBin\pg_ctl.exe" @('register', '-N', 'ESG-Pessoal-BD', '-D', $BdDir, '-S', 'auto')
}
# o que o PostgreSQL escreveu (para o ficheiro de erro, se não arrancar)
function RegistoBd {
  Write-Host '    --- fim do registo do PostgreSQL:'
  Get-ChildItem "$BdDir\log" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1 | ForEach-Object { Get-Content $_.FullName -Tail 25 | ForEach-Object { Write-Host "      $_" } }
  Get-WinEvent -FilterHashtable @{ LogName = 'Application'; ProviderName = 'PostgreSQL'; StartTime = (Get-Date).AddMinutes(-15) } -MaxEvents 5 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "      [eventos] $($_.Message)" }
}
try { Start-Service 'ESG-Pessoal-BD' -ErrorAction Stop } catch { RegistoBd; Falha "O serviço da base de dados (ESG-Pessoal-BD) não arrancou: $($_.Exception.Message)" }
$pronto = $false
for ($i = 0; $i -lt 60 -and -not $pronto; $i++) { & "$PgBin\pg_isready.exe" -h 127.0.0.1 -p $PortaBd -q; $pronto = ($LASTEXITCODE -eq 0); if (-not $pronto) { Start-Sleep 1 } }
if (-not $pronto) { RegistoBd; Falha 'O PostgreSQL não ficou pronto em 60 segundos.' }
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
@"
# HTTPS com a autoridade interna do Caddy (o certificado da raiz instala-se nos computadores da Repartição)
# so abre por ${Url}; pelo IP (ou outro nome) a ligacao e recusada
{
	storage file_system $storage
	skip_install_trust
	admin off
	https_port $PortaWeb
	# o encaminhamento do http:// faz-se abaixo (para a porta certa do HTTPS)
	auto_https disable_redirects
}
$Endereco {
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

$(if ($PortaHttp) { "http://$Endereco {`n`tredir $Url{uri} permanent`n}`n`nhttp:// {`n`tabort`n}" })

# aparelhos de ponto (impressão digital): só /iclock (os aparelhos ligam-se pelo IP)
:8085 {
	@ponto path /iclock/*
	reverse_proxy @ponto 127.0.0.1:$PortaApi
	respond 404
}
"@ | Set-Content -Path $Caddyfile -Encoding ASCII

# este computador encontra o nome sem esperar pelo DNS da Escola
$hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
$linhas = @(Get-Content $hosts -ErrorAction SilentlyContinue | Where-Object { $_ -notmatch '# esg-pessoal$' }) + "127.0.0.1 $Endereco # esg-pessoal"
try { [IO.File]::WriteAllLines($hosts, [string[]]$linhas, (New-Object Text.ASCIIEncoding)) }
catch { Write-Host "    (aviso: não foi possível escrever em $hosts — $($_.Exception.Message); neste computador use o DNS da Escola)" -ForegroundColor Yellow }

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
foreach ($s in 'ESG-Pessoal', 'ESG-Pessoal-Web', 'ESG-Pessoal-Copias') {
  try { Restart-Service $s -Force -ErrorAction Stop }
  catch {
    Write-Host "    --- fim do registo de ${s}:"
    Get-ChildItem "$Destino\servicos" -Filter "$s.*log" -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "    [$($_.Name)]"; Get-Content $_.FullName -Tail 20 | ForEach-Object { Write-Host "      $_" } }
    Falha "O serviço $s não arrancou: $($_.Exception.Message)"
  }
}

# firewall: HTTPS e os aparelhos de ponto, só nas redes do domínio e privadas
$regras = @(@('ESG Pessoal (HTTPS)', $PortaWeb), @('ESG Pessoal (aparelhos de ponto)', 8085))
if ($PortaHttp) { $regras += , @('ESG Pessoal (HTTP, encaminha)', $PortaHttp) }
foreach ($r in $regras) {
  # (re)cria-se: a porta do HTTPS pode ter mudado
  Remove-NetFirewallRule -DisplayName $r[0] -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName $r[0] -Direction Inbound -Protocol TCP -LocalPort $r[1] -Action Allow -Profile Domain, Private | Out-Null
}
Ok 'serviços ligados (services.msc: «ESG Pessoal»)'

Passo 'verificar' 'A verificar se o sistema responde'
$ok = $false
for ($i = 0; $i -lt 60 -and -not $ok; $i++) {
  try { $r = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$PortaApi/api/saude" -TimeoutSec 5; $ok = $r.Content -match '"ok":true' } catch { Start-Sleep 2 }
}
if (-not $ok) {
  Get-ChildItem "$Destino\servicos" -Filter 'ESG-Pessoal.*log' -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "    [$($_.Name)]"; Get-Content $_.FullName -Tail 30 | ForEach-Object { Write-Host "      $_" } }
  Falha "O sistema não respondeu em http://127.0.0.1:$PortaApi/api/saude"
}
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
# para preparar os outros computadores (PREPARAR-COMPUTADOR-*): o nome e o IP deste servidor
Set-Content -Path (Join-Path $Reg 'servidor.txt') -Value "$ip $Endereco $Url" -Encoding ASCII -ErrorAction SilentlyContinue

# a palavra-passe inicial já criou o administrador: não fica no ficheiro de configuração
$AdminSenha = $Cfg.ADMIN_PASSWORD
[IO.File]::WriteAllLines($EnvFicheiro, [string[]]((Get-Content $EnvFicheiro -Encoding UTF8) -replace '^ADMIN_PASSWORD=.*', 'ADMIN_PASSWORD='), (New-Object Text.UTF8Encoding $false))

$resumo = @(
  "SISTEMA DE GESTÃO DE PESSOAL E QUADROS — instalado em $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
  '',
  "Endereço:              $Url   (pelo IP não abre)",
  "No DNS da Escola:      $Endereco  ->  $ip   (registo A; peça ao responsável pela rede)",
  '                       Enquanto não houver, em cada computador corra PREPARAR-COMPUTADOR-WINDOWS.bat do pendrive.',
  "Administrador:         $AdminEmail"
)
if ($SenhaEscolhida) { $resumo += 'Palavra-passe:         a que escolheu na instalação   (na primeira entrada pede a verificação em dois passos)' }
elseif ($AdminSenha) { $resumo += "Palavra-passe inicial: $AdminSenha   (na primeira entrada pede a verificação em dois passos)" }
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
Start-Process $Url
