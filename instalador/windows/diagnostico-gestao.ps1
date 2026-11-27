#Requires -Version 5.1
<#
  Diagnóstico (e limpeza) de uma instalação de um sistema interno que falhou com «Access is denied».
  1) Escreve num ficheiro tudo o que pode impedir o administrador de escrever ou de correr programas na pasta do
     sistema: os direitos da conta, as permissões da pasta, o Windows Defender (estado, pastas permitidas, detecções,
     acesso controlado a pastas, regras ASR, eventos recentes) e o AppLocker.
  2) Só se o sistema NUNCA chegou a ser instalado (sem config\<sistema>.env e sem base de dados), retoma a pasta
     para os administradores e apaga-a, para o instalador começar do zero. Num sistema instalado não apaga nada.
  Não mexe no Sistema de Pessoal (C:\ESG-Pessoal) nem em nenhum serviço.
#>
param([ValidateSet('escolar', 'site', 'biblioteca', 'ciberseguranca')][string]$Sistema = 'escolar')
$ErrorActionPreference = 'Continue'
$Pen = Split-Path -Parent $PSScriptRoot
$Destino = @{ escolar = 'C:\ESG-Gestao-Escolar'; site = 'C:\ESG-Gestao-Site'; biblioteca = 'C:\ESG-Biblioteca'; ciberseguranca = 'C:\ESG-Ciberseguranca' }[$Sistema]
$Carimbo = Get-Date -Format 'yyyyMMdd-HHmmss'
$Reg = Join-Path $Pen 'registos'
New-Item -ItemType Directory -Force $Reg | Out-Null
$F = Join-Path $Reg "DIAGNOSTICO-$($Sistema.ToUpper())-$Carimbo.txt"
$linhas = New-Object System.Collections.Generic.List[string]
function L($t) { $linhas.Add("$t"); Write-Host $t }
function Cmd($titulo, [scriptblock]$b) { L ''; L "--- $titulo"; try { & $b 2>&1 | ForEach-Object { L "    $_" } } catch { L "    (erro: $($_.Exception.Message))" } }

L "DIAGNÓSTICO DA PASTA $Destino ($Sistema) — $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') — $env:COMPUTERNAME"
$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
L "Windows: $($os.Caption) $($os.Version)"
$eu = [Security.Principal.WindowsIdentity]::GetCurrent()
$adm = (New-Object Security.Principal.WindowsPrincipal($eu)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
L "Conta: $($eu.Name) ($($eu.User.Value)) · administrador (elevado): $adm"
if (-not $adm) { L '!!! Corra este .bat com o botão direito › Executar como administrador.' }
Cmd 'Grupos da conta (administradores e nível)' { whoami /groups | Select-String -Pattern 'S-1-5-32-544|S-1-16-|Mandatory Label|Administrators|Administradores' }
Cmd 'Privilégios da conta (dono e restauro)' { whoami /priv | Select-String -Pattern 'SeTakeOwnership|SeRestore|SeBackup|SeSecurity' }
Cmd 'Domínio / controlador de domínio' { $cs = Get-CimInstance Win32_ComputerSystem; "Domínio: $($cs.Domain) · papel: $($cs.DomainRole) (4/5 = controlador de domínio)" }

$instalado = (Test-Path "$Destino\config\$Sistema.env") -or (Test-Path "$Destino\dados\bd\PG_VERSION")
L ''
L "Instalado (config ou base de dados): $instalado"
if (Test-Path $Destino) {
  Cmd "Permissões de $Destino" { icacls $Destino }
  Cmd 'Dono da pasta' { (Get-Acl $Destino).Owner }
  foreach ($f in "$Destino\node\node.exe", "$Destino\postgresql\bin\postgres.exe") { if (Test-Path $f) { Cmd "Permissões de $f" { icacls $f } } }
  Cmd 'O que está na pasta' { Get-ChildItem $Destino -Force | ForEach-Object { "$($_.Mode) $($_.Name)" } }
  Cmd 'Programas a correr desta pasta' { Get-Process | Where-Object { $_.Path -and $_.Path -like "$Destino\*" } | ForEach-Object { "$($_.Id) $($_.Path)" } }
  Cmd 'Teste: criar um ficheiro na pasta' { $t = Join-Path $Destino "teste-escrita-$Carimbo.txt"; try { [IO.File]::WriteAllText($t, 'x'); Remove-Item $t -Force; 'consegue escrever' } catch { "NÃO consegue escrever: $($_.Exception.Message)" } }
} else { L "A pasta $Destino não existe." }

Cmd 'Windows Defender: estado' { Get-MpComputerStatus | Select-Object AMRunningMode, AntivirusEnabled, RealTimeProtectionEnabled, IsTamperProtected | Format-List | Out-String -Stream | Where-Object { $_ } }
Cmd 'Windows Defender: pastas permitidas, acesso controlado a pastas, regras ASR' { $m = Get-MpPreference; "Pastas permitidas: $(@($m.ExclusionPath) -join ', ')"; "Acesso controlado a pastas: $($m.EnableControlledFolderAccess)"; "Regras ASR: $(@($m.AttackSurfaceReductionRules_Ids).Count) · acções: $(@($m.AttackSurfaceReductionRules_Actions) -join ',')" }
Cmd 'Windows Defender: detecções' { Get-MpThreatDetection | Sort-Object InitialDetectionTime -Descending | Select-Object -First 10 | ForEach-Object { "$($_.InitialDetectionTime) · $($_.Resources -join ', ') · acção $($_.ThreatStatusID)" } }
Cmd 'Windows Defender: eventos das últimas 24 h (bloqueios)' { Get-WinEvent -FilterHashtable @{ LogName = 'Microsoft-Windows-Windows Defender/Operational'; StartTime = (Get-Date).AddDays(-1) } -MaxEvents 200 -ErrorAction Stop | Where-Object { $_.Id -in 1006, 1007, 1015, 1116, 1117, 1121, 1122, 1123, 1124, 1127 } | Select-Object -First 15 | ForEach-Object { "$($_.TimeCreated) [$($_.Id)] $(($_.Message -split "`n" | Select-Object -First 6) -join ' ')" } }
Cmd 'Outros antivírus registados' { Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction Stop | ForEach-Object { $_.displayName } }
Cmd 'AppLocker' { $p = Get-AppLockerPolicy -Effective -ErrorAction Stop; "$(@($p.RuleCollections | Where-Object { $_.Count }).Count) colecção(ões) de regras activas" }

# a limpeza: só de uma instalação que nunca terminou (sem configuração nem base de dados)
if ((Test-Path $Destino) -and -not $instalado -and $adm) {
  L ''
  L "=== LIMPEZA: $Destino nunca chegou a ser instalado — retoma-se para os administradores e apaga-se"
  Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path -like "$Destino\*" } | ForEach-Object { L "    a parar $($_.Path)"; Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
  Cmd 'icacls /setowner (administradores)' { icacls $Destino /setowner '*S-1-5-32-544' /T /C /Q }
  Cmd 'icacls /reset (permissões normais do disco C:)' { icacls $Destino /reset /T /C /Q }
  Cmd 'icacls /grant (administradores e sistema)' { icacls $Destino /grant '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' /T /C /Q }
  Get-ChildItem $Destino -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object { try { $_.Attributes = 'Normal' } catch { } }
  try { Remove-Item -Recurse -Force $Destino -ErrorAction Stop; L "    v $Destino apagada: volte a correr o INSTALAR-*.bat" }
  catch { L "    !!! não se apagou: $($_.Exception.Message)"; L '    Reinicie o servidor e corra este .bat outra vez; se continuar, traga este ficheiro.' }
} elseif ($instalado) {
  L ''
  L "=== $Destino tem um sistema instalado: não se apagou nada (só o diagnóstico)."
}

[IO.File]::WriteAllLines($F, [string[]]$linhas, (New-Object Text.UTF8Encoding $true))
Write-Host ''
Write-Host "Diagnóstico escrito em: $F" -ForegroundColor Green
Write-Host 'Copie este ficheiro para o pendrive e traga-o.' -ForegroundColor Green
try { Start-Process notepad.exe $F } catch {}
