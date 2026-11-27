#Requires -Version 5.1
<#
  Instalação de um sistema interno da Escola, num servidor Windows 10/11 ou Windows Server (64 bits), a partir do
  pendrive, sem internet (o .bat pede para correr como administrador):
    -Sistema escolar  Sistema de Gestão Escolar: Administração Escolar, Direcção de Ensino e departamentos, Comando,
                      Biblioteca, registo dos estudantes e docentes (recebe-os do Sistema de Pessoal);
    -Sistema site     Sistema de Gestão do Site: notícias, páginas, cursos, eventos, comentários e mensagens do site;
    -Sistema biblioteca  Sistema de Biblioteca: catálogo, exemplares, empréstimos (os livros leem-se no portal).
  Cada um tem a sua pasta, a sua base de dados e as suas portas (podem ficar no mesmo servidor) e troca os dados com o
  servidor online (o site público e o Portal dos estudantes e docentes) — REPLICACAO_URL e REPLICACAO_CHAVE.
  Se já estiver instalado, actualiza (os dados, as chaves e a configuração ficam).
  Em caso de falha escreve no pendrive registos\ERRO-INSTALACAO-<SISTEMA>-<data>.txt com a causa e o que fazer.
#>
param([ValidateSet('escolar', 'site', 'biblioteca')][string]$Sistema = 'escolar')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Pen = Split-Path -Parent $PSScriptRoot
$N = @{
  escolar = @{ titulo = 'Sistema de Gestão Escolar'; pasta = 'C:\ESG-Gestao-Escolar'; svc = 'ESG-Escolar'; bd = 5434; api = 3001; dominio = 'escolar.esg.emfaa.gov.ao'; outro = 'site' }
  site = @{ titulo = 'Sistema de Gestão do Site'; pasta = 'C:\ESG-Gestao-Site'; svc = 'ESG-Site'; bd = 5435; api = 3003; dominio = 'gestao-site.esg.emfaa.gov.ao'; outro = 'escolar' }
  biblioteca = @{ titulo = 'Sistema de Biblioteca'; pasta = 'C:\ESG-Biblioteca'; svc = 'ESG-Biblioteca'; bd = 5436; api = 3004; dominio = 'biblioteca.esg.emfaa.gov.ao'; outro = 'escolar' }
}[$Sistema]
$Titulo = $N.titulo
$Svc = $N.svc
$Destino = $N.pasta
$Dados = Join-Path $Destino 'dados'
$Conf = Join-Path $Destino 'config'
$PortaBd = $N.bd
$PortaApi = $N.api
$PessoalEnv = 'C:\ESG-Pessoal\config\pessoal.env'
$Carimbo = Get-Date -Format 'yyyyMMdd-HHmmss'
$Reg = Join-Path $Pen 'registos'
try { New-Item -ItemType Directory -Force $Reg | Out-Null; [IO.File]::WriteAllText((Join-Path $Reg '.escrita'), 'x'); Remove-Item (Join-Path $Reg '.escrita') }
catch { $Reg = Join-Path $env:PUBLIC "Documents\$Svc-registos"; New-Item -ItemType Directory -Force $Reg | Out-Null }
$Log = Join-Path $Reg "instalacao-$Sistema-$Carimbo.log"
$script:Passo = 'início'
$script:Codigo = 'inicio'
Start-Transcript -Path $Log -Force | Out-Null

function Passo($codigo, $texto) { $script:Codigo = $codigo; $script:Passo = $texto; Write-Host ''; Write-Host "=== [$(Get-Date -Format HH:mm:ss)] $texto" -ForegroundColor Cyan }
function Ok($t) { Write-Host "    v $t" -ForegroundColor Green }
function Falha($t) { throw $t }
function Correr($exe, [string[]]$argumentos) {
  & $exe @argumentos
  if ($LASTEXITCODE -ne 0) { Falha "$([IO.Path]::GetFileName($exe)) terminou com o código $LASTEXITCODE" }
}
# corre um programa sem parar por avisos que ele escreva no stderr; devolve o que escreveu
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
    'admin' { '- O instalador não correu como administrador. Use o INSTALAR-*.bat e aceite o pedido do Windows (Sim).' }
    'sistema' { '- Este instalador é para Windows 10/11 ou Windows Server 2016+ de 64 bits.' }
    'pendrive' { '- A cópia no pendrive está incompleta ou estragada (um ficheiro não confere com o MANIFESTO.txt).'; '- Volte a copiar a pasta ESG-GESTAO para o pendrive e repita.' }
    'espaco' { '- Falta espaço no disco C:. São precisos pelo menos 5 GB livres (os vídeos e os materiais das aulas ocupam espaço).' }
    'portas' { "- Outro programa está a usar uma porta de que o sistema precisa ($PortaBd, $PortaApi; para o HTTPS usa-se a 443 ou, se estiver ocupada, a 8443, 9443 ou 10443)."; '- O instalador não pára nenhum serviço do servidor. Veja quem usa as portas com:  netstat -ano | findstr LISTENING' }
    'copiar' { "- Não foi possível descompactar os componentes. O antivírus pode ter bloqueado (permita a pasta $Destino) ou o pendrive está estragado." }
    'bd' { "- O PostgreSQL não arrancou. Veja o registo em $Dados\bd\log e no Visualizador de Eventos (Aplicação, origem PostgreSQL)."; '- Causas comuns: antivírus a bloquear postgres.exe, porta ocupada, o Visual C++ Redistributable não instalou.' }
    'migrar' { '- A base de dados não aceitou a estrutura do sistema. Veja a mensagem acima. Numa actualização: reponha a última cópia de segurança.' }
    'servicos' { "- Um serviço não arrancou. Veja os registos em $Destino\servicos\*.log e em Serviços (services.msc), «$Svc»." }
    'carregar' { '- Um ficheiro de CARREGAR não entrou: veja o relatório CARGA-GESTAO-ESCOLAR-*.txt nos registos. O sistema fica instalado; pode carregar o ficheiro depois no painel (Administração Escolar › Arquivo e arranque do ano).' }
    'verificar' { "- O sistema não respondeu. Veja $Destino\servicos\$Svc.out.log e $Svc.err.log." }
    default { "- Veja a mensagem de erro acima e o registo completo: $Log" }
  }
}

trap {
  $erro = $_
  try { Stop-Transcript | Out-Null } catch {}
  $f = Join-Path $Reg "ERRO-INSTALACAO-$($Sistema.ToUpper())-$Carimbo.txt"
  $os = (Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue)
  $linhas = @(
    "ERRO NA INSTALAÇÃO DO $($Titulo.ToUpper()) (Windows)",
    "Data: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')   Computador: $env:COMPUTERNAME   Sistema: $($os.Caption) $($os.Version)",
    '',
    "Passo que falhou: $script:Passo",
    "Erro: $($erro.Exception.Message)",
    "Onde: $($erro.InvocationInfo.PositionMessage)",
    '',
    'CAUSAS PROVÁVEIS E O QUE FAZER:'
  ) + @(Causas) + @(
    '',
    'Depois de corrigir, volte a correr o mesmo INSTALAR-*.bat: continua e não apaga dados.',
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

Write-Host "$Titulo da ESG — instalação ($((Get-Content (Join-Path $Pen 'VERSAO.txt') -Encoding UTF8 -ErrorAction SilentlyContinue) -join ''))"
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
if (-not (Test-Path (Join-Path $Pen 'MANIFESTO.txt'))) { Falha 'Falta o MANIFESTO.txt: instale a partir da pasta ESG-GESTAO preparada (node instalador/preparar-gestao.mjs).' }
$maus = @()
foreach ($l in Get-Content (Join-Path $Pen 'MANIFESTO.txt')) {
  if (-not $l.Trim()) { continue }
  $soma = $l.Substring(0, 64); $rel = $l.Substring(66)
  $f = Join-Path $Pen ($rel -replace '/', '\')
  if (-not (Test-Path -LiteralPath $f) -or (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash -ne $soma.ToUpper()) { $maus += $rel }
}
if ($maus.Count) { Falha "Ficheiros em falta ou estragados no pendrive: $(($maus | Select-Object -First 20) -join ', ')$(if ($maus.Count -gt 20) { " (e mais $($maus.Count - 20))" })" }
Ok 'todos os ficheiros conferem'

Passo 'espaco' 'A verificar o espaço em disco'
$livre = [Math]::Floor((Get-PSDrive C).Free / 1MB)
if ($livre -lt 5000) { Falha "Só há $livre MB livres no disco C:." }
Ok "$livre MB livres"

$EnvFicheiro = Join-Path $Conf "$Sistema.env"
$Atualizar = Test-Path $EnvFicheiro
$Servicos = "$Svc-Copias", "$Svc-Web", $Svc, "$Svc-BD"
if ($Atualizar) {
  Write-Host ''; Write-Host ">>> O $Titulo já está instalado: vai ser ACTUALIZADO (os dados, as chaves e a configuração ficam)." -ForegroundColor Yellow
  foreach ($s in $Servicos) { if (Get-Service $s -ErrorAction SilentlyContinue) { Stop-Service $s -Force -ErrorAction SilentlyContinue } }
}
function Guardado($nome) { if ($Atualizar) { (Select-String -Path $EnvFicheiro -Pattern "^$nome=(.*)$" -ErrorAction SilentlyContinue).Matches | ForEach-Object { $_.Groups[1].Value.Trim() } | Select-Object -First 1 } }

Passo 'portas' 'A verificar as portas'
function Livre($p) { -not (Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue) }
function QuemUsa($p) { (@(Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue | ForEach-Object { (Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName }) | Select-Object -Unique) -join ', ' }
# o HTTPS fica na 443; se estiver ocupada (p. ex. pela VPN ou pelo Sistema de Pessoal), na primeira livre de
# 8443, 9443, 10443. Nenhum serviço do servidor é desligado.
$PortaWeb = $null
foreach ($c in @(@(Guardado 'PORTA_WEB') + 443, 8443, 9443, 10443 | Where-Object { $_ } | Select-Object -Unique)) {
  if (Livre $c) { $PortaWeb = [int]$c; break }
  Write-Host "    a porta $c está ocupada por: $(QuemUsa $c) — fica como está" -ForegroundColor Yellow
}
if (-not $PortaWeb) { Falha 'As portas 443, 8443, 9443 e 10443 estão todas ocupadas: não há porta para o HTTPS.' }
$PortaHttp = if (Livre 80) { 80 } else { $null }
if (-not $PortaHttp) { Write-Host "    a porta 80 está ocupada por: $(QuemUsa 80) — fica como está (escreve-se o endereço completo, https://…)" -ForegroundColor Yellow }
foreach ($p in $PortaApi, $PortaBd) { if (-not (Livre $p)) { Falha "A porta $p já está ocupada por: $(QuemUsa $p)" } }
Ok "HTTPS na porta $PortaWeb$(if ($PortaHttp) { ' (e 80 para encaminhar)' }); $PortaApi e $PortaBd livres"

# o endereço do sistema (nome no DNS da Escola)
$Endereco = if ($env:ESG_ENDERECO) { $env:ESG_ENDERECO } else { Guardado 'ENDERECO' }
# os sistemas internos usam o certificado da autoridade interna (só a rede da Escola)
$Tls = 'interno'
if (-not $Atualizar) {
  Write-Host ''
  Write-Host "ENDEREÇO DO $($Titulo.ToUpper()) (nome no DNS da Escola)" -ForegroundColor Cyan
  if (-not $Endereco) { $Endereco = "$(Read-Host "  Nome no DNS [$($N.dominio)]")".Trim() }
  if (-not $Endereco) { $Endereco = $N.dominio }
}
$Endereco = $Endereco.Trim().ToLower()
if ($Endereco -notmatch '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$') { Falha "Endereço inválido: $Endereco (ex.: $($N.dominio))" }

<#
  A ligação ao servidor online (o site público e o Portal): o endereço, a chave da troca e a chave dos dados pessoais
  — as duas chaves são as MESMAS nos três sistemas (os dados viajam cifrados). Vêm, por esta ordem: do outro sistema
  interno já instalado neste servidor, do ficheiro ligacao-online.txt do pendrive, ou criam-se agora (e ficam em
  config\ligacao-online.txt, para configurar o servidor online e o outro sistema interno).
#>
function LerEnv($f) { $h = @{}; if (Test-Path $f) { foreach ($l in Get-Content $f -Encoding UTF8) { if ($l -match '^([A-Z_]+)=(.*)$') { $h[$Matches[1]] = $Matches[2].Trim() } } }; $h }
# os outros sistemas internos que já estejam neste servidor
$Outros = @('C:\ESG-Gestao-Escolar\config\escolar.env', 'C:\ESG-Gestao-Site\config\site.env', 'C:\ESG-Biblioteca\config\biblioteca.env') | Where-Object { $_ -ne (Join-Path $N.pasta "config\$Sistema.env") }
$Lig = @{}
foreach ($fonte in @(($Outros | ForEach-Object { LerEnv $_ }) + @(LerEnv (Join-Path $Pen 'ligacao-online.txt')))) {
  foreach ($k in 'REPLICACAO_URL', 'REPLICACAO_CHAVE', 'DADOS_CHAVE') { if (-not $Lig[$k] -and $fonte[$k]) { $Lig[$k] = $fonte[$k] } }
}
if (-not $Atualizar -and -not $Lig.REPLICACAO_URL) {
  Write-Host ''
  Write-Host 'SERVIDOR ONLINE (o site público e o Portal dos estudantes e docentes)' -ForegroundColor Cyan
  $Lig.REPLICACAO_URL = "$(Read-Host '  Endereço (ex.: https://portal.esg.emfaa.gov.ao; Enter = indicar depois)')".Trim().TrimEnd('/')
}
if ($Lig.REPLICACAO_URL -and $Lig.REPLICACAO_URL -notmatch '^https?://[^\s/]+') { Falha "Endereço do servidor online inválido: $($Lig.REPLICACAO_URL)" }
$Url = if ($PortaWeb -eq 443) { "https://$Endereco" } else { "https://${Endereco}:$PortaWeb" }
$Origens = (@("https://$Endereco", $Url) | Select-Object -Unique) -join ','
$ip = (Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | Select-Object -First 1).IPv4Address.IPAddress | Select-Object -First 1
if (-not $ip) { $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1).IPAddress }

$SenhaEscolhida = $false
if (-not $Atualizar) {
  Write-Host ''
  Write-Host 'CONTA DE ADMINISTRADOR DO PAINEL (entra com o e-mail e a palavra-passe; na 1.ª entrada liga a verificação em dois passos)' -ForegroundColor Cyan
  $AdminNome = if ($env:ESG_ADMIN_NOME) { $env:ESG_ADMIN_NOME } else { Read-Host "  Nome [Administrador do $Titulo]" }
  if (-not $AdminNome) { $AdminNome = "Administrador do $Titulo" }
  $AdminNome = $AdminNome -replace '"', ''
  do {
    $AdminEmail = if ($env:ESG_ADMIN_EMAIL) { $env:ESG_ADMIN_EMAIL } else { Read-Host '  E-mail [admin@esgfaa.gov.ao]' }
    if (-not $AdminEmail) { $AdminEmail = 'admin@esgfaa.gov.ao' }
    $AdminEmail = $AdminEmail.Trim().ToLower()
    $bom = $AdminEmail -match '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    if (-not $bom) { if ($env:ESG_ADMIN_EMAIL) { Falha "E-mail inválido: $AdminEmail" }; Write-Host '  E-mail inválido.' -ForegroundColor Red }
  } until ($bom)
  $AdminSenha = $null
  if (-not $env:ESG_ADMIN_EMAIL) {
    Write-Host '  Palavra-passe: pelo menos 12 caracteres, com letras e números (sem espaços, aspas nem #).'
    Write-Host '  Deixe em branco para o instalador gerar uma (mostrada no fim; muda-se na 1.ª entrada).'
    while ($true) {
      $a = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR((Read-Host '  Palavra-passe' -AsSecureString)))
      if (-not $a) { break }
      $erroSenha = if ($a.Length -lt 12) { 'Tem de ter pelo menos 12 caracteres.' } elseif ($a -notmatch '[a-zA-Z]' -or $a -notmatch '\d') { 'Tem de ter letras e números.' } elseif ($a -match '[\s"''#\\]') { 'Sem espaços, aspas, # nem \.' } elseif ($a.ToLower().Contains($AdminEmail.Split('@')[0])) { 'Não pode conter o nome do e-mail.' } else { $null }
      if ($erroSenha) { Write-Host "  $erroSenha" -ForegroundColor Red; continue }
      $b = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR((Read-Host '  Repita a palavra-passe' -AsSecureString)))
      if ($a -ne $b) { Write-Host '  Não são iguais. Escreva outra vez.' -ForegroundColor Red; continue }
      $AdminSenha = $a; $SenhaEscolhida = $true; break
    }
  }
}

Passo 'copiar' "A instalar os componentes (Node.js, PostgreSQL, Caddy) em $Destino"
foreach ($d in $Destino, $Dados, $Conf, "$Dados\ficheiros", "$Dados\copias", "$Dados\caddy", "$Destino\servicos", "$Destino\certificado") { New-Item -ItemType Directory -Force $d | Out-Null }
Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path -like "$Destino\*" } | ForEach-Object { Write-Host "    a parar $($_.ProcessName) (PID $($_.Id)), que corria de $Destino"; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
$C = Join-Path $Pen 'componentes'
Descompactar "$C\node-windows.zip" "$Destino\node"
Descompactar "$C\postgresql-windows.zip" "$Destino\postgresql"
Descompactar "$C\caddy-windows.zip" "$Destino\caddy"
LimparPasta "$Destino\sistema.anterior"
if (Test-Path "$Destino\sistema") { try { Rename-Item "$Destino\sistema" 'sistema.anterior' -ErrorAction Stop } catch { LimparPasta "$Destino\sistema" } }
Copy-Item -Recurse (Join-Path $Pen 'sistema') "$Destino\sistema"
# só o sistema (SYSTEM) e os administradores entram na pasta; quem instala e o NETWORK SERVICE (PostgreSQL) lêem
Calado icacls @($Destino, '/inheritance:r', '/grant:r', '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F', '/T', '/C', '/Q') | Out-Null
$EuSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
Calado icacls @($Destino, '/grant', "*${EuSid}:(OI)(CI)RX", '*S-1-5-20:(OI)(CI)RX', '/T', '/C', '/Q') | Out-Null
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

if (-not $Atualizar) {
  $BdSenha = Aleatorio 40
  if (-not $AdminSenha) { $AdminSenha = Senha }
  # a chave da ligação ao Sistema de Pessoal: a mesma dos dois lados (se o Pessoal já estiver neste servidor e
  # tiver uma, usa-se essa; senão cria-se e o Pessoal fica ligado abaixo)
  $ChaveIntegracao = $null
  if (Test-Path $PessoalEnv) { $ChaveIntegracao = (Select-String -Path $PessoalEnv -Pattern '^INTEGRACAO_CHAVE=(.{32,})$' -ErrorAction SilentlyContinue).Matches | ForEach-Object { $_.Groups[1].Value.Trim() } | Select-Object -First 1 }
  if (-not $ChaveIntegracao) { $ChaveIntegracao = Aleatorio 64 }
  $env_ = @(
    "# $Titulo da ESG — criado pelo instalador em $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
    '# GUARDE UMA CÓPIA DESTE FICHEIRO NUM COFRE: sem DADOS_CHAVE os dados pessoais não se lêem; sem COPIAS_CHAVE as cópias não abrem.',
    'NODE_ENV=production', 'HOST=127.0.0.1', "PORT=$PortaApi", 'TRUST_PROXY=1', "SISTEMA=$Sistema",
    '# a troca com o servidor online: o endereço e a chave (as mesmas chaves REPLICACAO_CHAVE e DADOS_CHAVE nos três sistemas)',
    "REPLICACAO_URL=$($Lig.REPLICACAO_URL)", "REPLICACAO_CHAVE=$(if ($Lig.REPLICACAO_CHAVE) { $Lig.REPLICACAO_CHAVE } else { Aleatorio 64 })",
    "ENDERECO=$Endereco", "TLS=$Tls", "PORTA_WEB=$PortaWeb",
    "PUBLIC_URL=$Url", "PORTAL_URL=$Url/portal/", "PAINEL_URL=$Url/painel/", "CORS_ORIGINS=$Origens",
    "DATABASE_URL=postgresql://esgfaa:$BdSenha@127.0.0.1:$PortaBd/esgfaa", "BD_SENHA=$BdSenha",
    "JWT_SECRET=$(Aleatorio 64)", "DADOS_CHAVE=$(if ($Lig.DADOS_CHAVE) { $Lig.DADOS_CHAVE } else { Aleatorio 64 })", "COPIAS_CHAVE=$(Aleatorio 64)", "INTEGRACAO_CHAVE=$ChaveIntegracao",
    "ADMIN_NAME=$AdminNome", "ADMIN_EMAIL=$AdminEmail", "ADMIN_PASSWORD=$AdminSenha",
    '# o painel só abre a partir da rede interna da Escola',
    'PAINEL_REDES=127.0.0.1/32,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16',
    'APROVACAO_COMANDANTE=sim', '# e-mails de acesso dos docentes e estudantes (criados no Sistema de Pessoal: nome.apelido@portal.esg.emfaa.gov.ao)', 'EMAIL_DOMINIO_ESCOLA=portal.esg.emfaa.gov.ao,esg.emfaa.gov.ao',
    '# serviços fora de Angola (IA, pesquisa na internet do anti-plágio): só com autorização da Escola (Lei n.º 22/11)',
    'DADOS_FORA_DE_ANGOLA=nao', 'FONTES_CIENTIFICAS=nao',
    '# e-mail das notificações (smtps://utilizador:senha@servidor:465); vazio = sem e-mail',
    'SMTP_URL=',
    "DATA_DIR=$Dados\ficheiros",
    "PORTAL_DATABASE_URL=postgresql://esgfaa:$BdSenha@127.0.0.1:$PortaBd/esgfaa", "PORTAL_DADOS=$Dados\ficheiros", "COPIAS_DIR=$Dados\copias",
    'FUSO_HORARIO=Africa/Luanda', 'TZ=Africa/Luanda'
  )
  [IO.File]::WriteAllLines($EnvFicheiro, [string[]]$env_, (New-Object Text.UTF8Encoding $false))
  $ChaveIntegracao = $null
}
# numa actualização: a porta do HTTPS pode ter mudado
$linhasEnv = @(Get-Content $EnvFicheiro -Encoding UTF8)
$linhasEnv = @($linhasEnv -replace '^PORTA_WEB=.*', "PORTA_WEB=$PortaWeb" -replace '^PUBLIC_URL=.*', "PUBLIC_URL=$Url" -replace '^PORTAL_URL=.*', "PORTAL_URL=$Url/portal/" -replace '^PAINEL_URL=.*', "PAINEL_URL=$Url/painel/" -replace '^CORS_ORIGINS=.*', "CORS_ORIGINS=$Origens")
if (-not ($linhasEnv -match '^SISTEMA=')) { $linhasEnv += "SISTEMA=$Sistema" }
if (-not ($linhasEnv -match '^REPLICACAO_CHAVE=.{32,}')) { $linhasEnv = @($linhasEnv | Where-Object { $_ -notmatch '^REPLICACAO_CHAVE=' }) + "REPLICACAO_CHAVE=$(if ($Lig.REPLICACAO_CHAVE) { $Lig.REPLICACAO_CHAVE } else { Aleatorio 64 })" }
# o endereço do servidor online: o que se indicou (ou veio do pendrive) se ainda não havia
if ($Lig.REPLICACAO_URL -and -not ($linhasEnv -match '^REPLICACAO_URL=.+')) { $linhasEnv = @($linhasEnv | Where-Object { $_ -notmatch '^REPLICACAO_URL=' }) + "REPLICACAO_URL=$($Lig.REPLICACAO_URL)" }
[IO.File]::WriteAllLines($EnvFicheiro, [string[]]$linhasEnv, (New-Object Text.UTF8Encoding $false))
$Cfg = @{}
foreach ($l in Get-Content $EnvFicheiro) { if ($l -match '^([A-Z_]+)=(.*)$') { $Cfg[$Matches[1]] = $Matches[2] } }
# a ligação, para o servidor online e o outro sistema interno (só os administradores lêem esta pasta)
$FicheiroLigacao = Join-Path $Conf 'ligacao-online.txt'
[IO.File]::WriteAllLines($FicheiroLigacao, [string[]]@(
  '# Ligação ao servidor online — as mesmas chaves nos três sistemas (Gestão Escolar, Gestão do Site, servidor online).',
  '# No servidor online: SISTEMA=online, REPLICACAO_CHAVE e DADOS_CHAVE iguais a estas. NÃO ENVIE POR E-MAIL.',
  "REPLICACAO_URL=$($Cfg.REPLICACAO_URL)", "REPLICACAO_CHAVE=$($Cfg.REPLICACAO_CHAVE)", "DADOS_CHAVE=$($Cfg.DADOS_CHAVE)"), (New-Object Text.UTF8Encoding $false))
$AdminEmail = $Cfg.ADMIN_EMAIL

Passo 'bd' "A preparar a base de dados (PostgreSQL na porta $PortaBd, só nesta máquina)"
$BdDir = "$Dados\bd"
if (-not (Test-Path "$BdDir\PG_VERSION")) {
  LimparPasta $BdDir
  New-Item -ItemType Directory -Force $BdDir | Out-Null
  Calado icacls @($BdDir, '/grant', "*${EuSid}:(OI)(CI)F", '*S-1-5-20:(OI)(CI)F', '*S-1-5-18:(OI)(CI)F', '/T', '/C', '/Q') | Out-Null
  $pw = Join-Path $env:TEMP "esg-pw-$Carimbo.txt"
  [IO.File]::WriteAllText($pw, $Cfg.BD_SENHA)
  try { Correr "$PgBin\initdb.exe" @('-D', $BdDir, '-U', 'esgfaa', "--pwfile=$pw", '-E', 'UTF8', '--no-locale', '--auth=scram-sha-256') } finally { Remove-Item $pw -Force -ErrorAction SilentlyContinue }
  Add-Content "$BdDir\postgresql.conf" "`nlisten_addresses = '127.0.0.1'`nport = $PortaBd`nlogging_collector = on`n"
}
if (-not (Get-Service "$Svc-BD" -ErrorAction SilentlyContinue)) {
  Correr "$PgBin\pg_ctl.exe" @('register', '-N', "$Svc-BD", '-D', $BdDir, '-S', 'auto')
}
function RegistoBd {
  Write-Host '    --- fim do registo do PostgreSQL:'
  Get-ChildItem "$BdDir\log" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 1 | ForEach-Object { Get-Content $_.FullName -Tail 25 | ForEach-Object { Write-Host "      $_" } }
}
try { Start-Service "$Svc-BD" -ErrorAction Stop } catch { RegistoBd; Falha "O serviço da base de dados ($Svc-BD) não arrancou: $($_.Exception.Message)" }
$pronto = $false
for ($i = 0; $i -lt 60 -and -not $pronto; $i++) { & "$PgBin\pg_isready.exe" -h 127.0.0.1 -p $PortaBd -q; $pronto = ($LASTEXITCODE -eq 0); if (-not $pronto) { Start-Sleep 1 } }
if (-not $pronto) { RegistoBd; Falha 'O PostgreSQL não ficou pronto em 60 segundos.' }
$env:PGPASSWORD = $Cfg.BD_SENHA
$existe = & "$PgBin\psql.exe" -h 127.0.0.1 -p $PortaBd -U esgfaa -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='esgfaa'"
if ("$existe".Trim() -ne '1') { Correr "$PgBin\createdb.exe" @('-h', '127.0.0.1', '-p', "$PortaBd", '-U', 'esgfaa', 'esgfaa') }
Ok 'base de dados pronta'

Passo 'migrar' 'A criar/actualizar as tabelas'
Push-Location "$Destino\sistema\api"
Correr $Node @("--env-file=$EnvFicheiro", 'scripts\migrar.js')
Pop-Location

Passo 'servicos' 'A ligar os serviços (sistema, HTTPS, cópias de segurança diárias e troca com o servidor online)'
$Caddyfile = Join-Path $Conf 'Caddyfile'
$storage = ("$Dados\caddy" -replace '\\', '/')
$App = ("$Destino\sistema\app" -replace '\\', '/')
$global_ = if ($Tls -eq 'interno') { "`tskip_install_trust" } else { '' }
$tlsLinha = if ($Tls -eq 'interno') { "`ttls internal" } else { '' }
@"
# $Titulo da ESG: o painel (/painel/, só da rede interna) e a API (/api, /uploads)$(if ($Sistema -eq 'site') { '; o site em pré-visualização (/)' })
# e a API (/api, /uploads). Certificado: $Tls
{
	storage file_system $storage
$global_
	admin off
	https_port $PortaWeb
	auto_https disable_redirects
}
$Endereco {
$tlsLinha
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options nosniff
		Referrer-Policy strict-origin-when-cross-origin
		X-Frame-Options DENY
		Permissions-Policy "camera=(self), microphone=(self), geolocation=()"
		-Server
	}
	@construidos path /assets/*
	header @construidos Cache-Control "public, max-age=31536000, immutable"
	@paginas path / /index.html /portal/ /portal/index.html /painel/ /painel/index.html
	header @paginas Cache-Control "no-cache"

$(if ($Sistema -ne 'site') { "`t@raiz path /`n`tredir @raiz /painel/`n" })	handle /api/* {
		reverse_proxy 127.0.0.1:$PortaApi
	}
	handle /uploads/* {
		reverse_proxy 127.0.0.1:$PortaApi
	}
	handle /portal/* {
		root * $App
		try_files {path} {path}index.html /portal/index.html
		file_server
	}
	handle /painel/* {
		root * $App
		try_files {path} /painel/index.html
		file_server
	}
	handle {
		root * $App
		try_files {path} {path}/ /index.html
		file_server
	}
}
$(if ($PortaHttp) { "`nhttp://$Endereco {`n`tredir $Url{uri} permanent`n}" })
"@ | Set-Content -Path $Caddyfile -Encoding ASCII

# este computador encontra o nome sem esperar pelo DNS da Escola
$hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
$linhas = @(Get-Content $hosts -ErrorAction SilentlyContinue | Where-Object { $_ -notmatch "# esg-$Sistema`$" }) + "127.0.0.1 $Endereco # esg-$Sistema"
try { [IO.File]::WriteAllLines($hosts, [string[]]$linhas, (New-Object Text.ASCIIEncoding)) }
catch { Write-Host "    (aviso: não foi possível escrever em $hosts — $($_.Exception.Message))" -ForegroundColor Yellow }

function Servico($id, $nome, $exe, $argumentos, $extra = '', $pasta = "$Destino\sistema\api") {
  $dir = "$Destino\servicos"
  Copy-Item (Join-Path $Pen 'componentes\winsw.exe') "$dir\$id.exe" -Force
  @"
<service>
  <id>$id</id>
  <name>$nome</name>
  <description>$Titulo da Escola Superior de Guerra</description>
  <executable>$exe</executable>
  <arguments>$argumentos</arguments>
  <workingdirectory>$pasta</workingdirectory>
  <startmode>Automatic</startmode>
  <depend>$Svc-BD</depend>
  <onfailure action="restart" delay="10 sec"/>
  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>5</keepFiles></log>
  <logpath>$dir</logpath>
  <env name="TZ" value="Africa/Luanda"/>
$extra
</service>
"@ | Set-Content -Path "$dir\$id.xml" -Encoding UTF8
  if (-not (Get-Service $id -ErrorAction SilentlyContinue)) { Correr "$dir\$id.exe" @('install') }
}
Servico $Svc "ESG — $Titulo" $Node "--env-file=&quot;$EnvFicheiro&quot; src\server.js"
Servico "$Svc-Web" "ESG — $Titulo — HTTPS (Caddy)" "$Destino\caddy\caddy.exe" "run --config &quot;$Caddyfile&quot; --adapter caddyfile" "  <env name=`"AppData`" value=`"$Dados\caddy`"/>" "$Destino\caddy"
Servico "$Svc-Copias" "ESG — $Titulo — cópias de segurança diárias" $Node "--env-file=&quot;$EnvFicheiro&quot; scripts\copias.mjs agendar --sistema portal" "  <env name=`"PATH`" value=`"$PgBin;%PATH%`"/>" "$Destino\sistema"
foreach ($s in $Svc, "$Svc-Web", "$Svc-Copias") {
  try { Restart-Service $s -Force -ErrorAction Stop }
  catch {
    Write-Host "    --- fim do registo de ${s}:"
    Get-ChildItem "$Destino\servicos" -Filter "$s.*log" -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "    [$($_.Name)]"; Get-Content $_.FullName -Tail 20 | ForEach-Object { Write-Host "      $_" } }
    Falha "O serviço $s não arrancou: $($_.Exception.Message)"
  }
}
# firewall do Windows: só o HTTPS (e a 80, que encaminha). A abertura à internet (estudantes e docentes em
# casa) decide-se na firewall da Escola, não aqui.
$regras = @(, @("$Svc (HTTPS)", $PortaWeb))
if ($PortaHttp) { $regras += , @("$Svc (HTTP, encaminha)", $PortaHttp) }
foreach ($r in $regras) {
  Remove-NetFirewallRule -DisplayName $r[0] -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName $r[0] -Direction Inbound -Protocol TCP -LocalPort $r[1] -Action Allow -Profile Domain, Private | Out-Null
}
Ok "serviços ligados (services.msc: «$Svc»)"

Passo 'verificar' 'A verificar se o sistema responde'
$ok = $false
# o 1.º arranque carrega os conteúdos do site e cria o administrador: pode demorar
for ($i = 0; $i -lt 90 -and -not $ok; $i++) {
  try { $r = Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$PortaApi/api/saude" -TimeoutSec 5; $ok = $r.Content -match '"ok":true' } catch { Start-Sleep 2 }
}
if (-not $ok) {
  Get-ChildItem "$Destino\servicos" -Filter "$Svc.*log" -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "    [$($_.Name)]"; Get-Content $_.FullName -Tail 30 | ForEach-Object { Write-Host "      $_" } }
  Falha "O sistema não respondeu em http://127.0.0.1:$PortaApi/api/saude"
}
Ok 'o sistema responde'

# a Gestão Escolar: os dados reais que vêm no pendrive (o arranque do ano lectivo e as pautas do arquivo) entram já;
# repetir não duplica nada e o que já está no sistema não muda
$Carregar = Join-Path $Pen 'CARREGAR'
if ($Sistema -eq 'escolar' -and (Test-Path $Carregar)) {
  Passo 'carregar' 'A carregar os dados da Escola (turmas do ano lectivo, cadeiras, docentes, pautas do arquivo)'
  $RelCarga = Join-Path $Reg "CARGA-GESTAO-ESCOLAR-$Carimbo.txt"
  Push-Location "$Destino\sistema\api"
  try { Correr $Node @("--env-file=$EnvFicheiro", 'scripts\carregar-inicial.js', $Carregar, $RelCarga) } finally { Pop-Location }
  Ok "dados carregados (o relatório: $RelCarga)"
}
if ($Tls -eq 'interno') {
  $raiz = "$Dados\caddy\pki\authorities\local\root.crt"
  for ($i = 0; $i -lt 30 -and -not (Test-Path $raiz); $i++) { Start-Sleep 1 }
  if (Test-Path $raiz) {
    Copy-Item $raiz "$Destino\certificado\esg-$Sistema-raiz.crt" -Force
    Copy-Item $raiz (Join-Path $Reg "esg-$Sistema-raiz.crt") -Force -ErrorAction SilentlyContinue
    Import-Certificate -FilePath $raiz -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
    Ok 'certificado HTTPS criado e instalado neste computador'
  }
}

# o Sistema de Pessoal neste servidor: passa a enviar os docentes e os estudantes à Gestão Escolar (que os passa ao portal)
$Ligado = $false
if ($Sistema -eq 'escolar' -and (Test-Path $PessoalEnv)) {
  $lp = @(Get-Content $PessoalEnv -Encoding UTF8 | Where-Object { $_ -notmatch '^(PORTAL_API_URL|INTEGRACAO_CHAVE)=' }) + "PORTAL_API_URL=http://127.0.0.1:$PortaApi" + "INTEGRACAO_CHAVE=$($Cfg.INTEGRACAO_CHAVE)"
  [IO.File]::WriteAllLines($PessoalEnv, [string[]]$lp, (New-Object Text.UTF8Encoding $false))
  if (Get-Service 'ESG-Pessoal' -ErrorAction SilentlyContinue) { Restart-Service 'ESG-Pessoal' -Force -ErrorAction SilentlyContinue }
  $Ligado = $true
  Ok 'Sistema de Pessoal deste servidor ligado à Gestão Escolar (envia os docentes e os estudantes)'
}

# a palavra-passe inicial já criou o administrador: não fica no ficheiro de configuração
$AdminSenha = $Cfg.ADMIN_PASSWORD
[IO.File]::WriteAllLines($EnvFicheiro, [string[]]((Get-Content $EnvFicheiro -Encoding UTF8) -replace '^ADMIN_PASSWORD=.*', 'ADMIN_PASSWORD='), (New-Object Text.UTF8Encoding $false))

$resumo = @(
  "$($Titulo.ToUpper()) DA ESCOLA SUPERIOR DE GUERRA — instalado em $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
  '',
  "Painel:                $Url/painel/   (só da rede interna)$(if ($Sistema -eq 'site') { "  ·  pré-visualização do site: $Url/" })",
  "No DNS da Escola:      $Endereco  ->  $ip   (registo A; peça ao responsável pela rede)",
  "Administrador:         $AdminEmail"
)
if ($SenhaEscolhida) { $resumo += 'Palavra-passe:         a que escolheu na instalação' }
elseif ($AdminSenha) { $resumo += "Palavra-passe inicial: $AdminSenha   (muda-se na 1.ª entrada)" }
$resumo += @(
  '',
  "Servidor online:       $(if ($Cfg.REPLICACAO_URL) { "$($Cfg.REPLICACAO_URL) (troca de 15 em 15 segundos)" } else { 'AINDA SEM ENDEREÇO: ponha REPLICACAO_URL em ' + $EnvFicheiro + ' e reinicie o serviço ' + $Svc })",
  "Ligação (chaves):      $FicheiroLigacao — leve-o (sem e-mail) para o servidor online (SISTEMA=online, as mesmas REPLICACAO_CHAVE e DADOS_CHAVE) e, para instalar o outro sistema interno noutro servidor, para a raiz do pendrive",
  "Certificado:           $Destino\certificado\esg-$Sistema-raiz.crt (cópia no pendrive: registos\esg-$Sistema-raiz.crt) — instale-o nos computadores da Escola"
)
if ($Sistema -eq 'escolar') { $resumo += $(if ($Ligado) { 'Sistema de Pessoal:    ligado (neste servidor)' } else { "Sistema de Pessoal:    noutro servidor — a chave da ligação (INTEGRACAO_CHAVE) está em $EnvFicheiro" }) }
$resumo += @(
  "Configuração e chaves: $EnvFicheiro — GUARDE UMA CÓPIA NUM COFRE (fora deste computador)",
  "Cópias de segurança:   $Dados\copias (todos os dias às 2h)",
  "Serviços:              services.msc — $Svc, $Svc-BD, $Svc-Web, $Svc-Copias"
)
$fResumo = Join-Path $Conf 'INSTALACAO.txt'
[IO.File]::WriteAllLines($fResumo, [string[]]$resumo, (New-Object Text.UTF8Encoding $true))
[IO.File]::WriteAllLines((Join-Path $Reg "INSTALACAO-$($Sistema.ToUpper())-CONCLUIDA-$Carimbo.txt"), [string[]]($resumo | Where-Object { $_ -notlike 'Palavra-passe inicial*' }), (New-Object Text.UTF8Encoding $true))

Write-Host 'Instalação concluída.'
# o registo (no pendrive) fecha antes de mostrar a palavra-passe: ela não fica escrita no pendrive
Stop-Transcript | Out-Null
Write-Host ''
Write-Host '==============================================================' -ForegroundColor Green
$resumo | ForEach-Object { Write-Host $_ }
Write-Host '==============================================================' -ForegroundColor Green
Write-Host "O resumo (com a palavra-passe) fica em $fResumo (só os administradores o lêem)."
Start-Process "$Url/painel/"
