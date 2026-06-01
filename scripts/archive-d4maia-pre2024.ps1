param(
    [string]$LocalRoot = 'C:\Users\cmm1490\Downloads\d4maia',
    [ValidateSet('inventory', 'dump', 'verify', 'drop', 'all')]
    [string]$Phase = 'all',
    [switch]$DryRun,
    [string[]]$Tables = @(),
    [string]$DeployEnvPath = 'secrets/production.deploy.local.env',
    [string]$DbConfigPath = 'secrets/environments.local.json',
    [int]$MaxYear = 2023,
    [int]$MaxRetries = 2
)

$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
    return (Split-Path -Parent $PSScriptRoot)
}

function Resolve-RepoPath {
    param([string]$Path)
    if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
    return (Join-Path (Get-RepoRoot) $Path)
}

function Read-EnvFile {
    param([string]$Path)
    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path) {
        $trimmed = $line.Trim()
        if ($trimmed -eq '' -or $trimmed.StartsWith('#') -or $trimmed -notmatch '=') { continue }
        $parts = $trimmed -split '=', 2
        $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
    }
    return $values
}

function Get-EnvValue {
    param([hashtable]$Values, [string[]]$Keys, [string]$Default = '')
    foreach ($key in $Keys) {
        if ($Values.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace([string]$Values[$key])) {
            return [string]$Values[$key]
        }
    }
    return $Default
}

function Get-DbCredentials {
    param([string]$ConfigPath)
    $full = Resolve-RepoPath -Path $ConfigPath
    if (-not (Test-Path -LiteralPath $full)) {
        throw "Config DB não encontrado: $full"
    }
    $cfg = Get-Content -LiteralPath $full -Raw | ConvertFrom-Json
    $conn = $cfg.connections.main_db
    if (-not $conn) { throw 'connections.main_db em falta em environments.local.json' }
    return @{
        User = [string]$conn.user
        Password = [string]$conn.password
    }
}

function Get-SshTarget {
    param([string]$DeployEnvPath)
    $envValues = Read-EnvFile -Path (Resolve-RepoPath -Path $DeployEnvPath)
    $hostName = Get-EnvValue -Values $envValues -Keys @('WARDEN_DEPLOY_SSH_HOST', 'WELLS_API_DEPLOY_SSH_HOST')
    $userName = Get-EnvValue -Values $envValues -Keys @('WARDEN_DEPLOY_SSH_USER', 'WELLS_API_DEPLOY_SSH_USER')
    $port = Get-EnvValue -Values $envValues -Keys @('WARDEN_DEPLOY_SSH_PORT', 'WELLS_API_DEPLOY_SSH_PORT') -Default '22'
    $sudoPassword = Get-EnvValue -Values $envValues -Keys @('WARDEN_SUDO_PASSWORD')
    if ($hostName -eq '' -or $userName -eq '') { throw 'Host/user SSH em falta no deploy env.' }
    $sourceKey = Join-Path (Get-RepoRoot) 'secrets\.ssh\id_ed25519'
    if (-not (Test-Path -LiteralPath $sourceKey)) {
        throw "Chave SSH não encontrada: $sourceKey"
    }
    $tempKey = Join-Path $env:TEMP "warden_d4maia_id_ed25519_$PID"
    if (Test-Path -LiteralPath $tempKey) { Remove-Item -LiteralPath $tempKey -Force }
    Copy-Item -LiteralPath $sourceKey -Destination $tempKey -Force
    icacls $tempKey /inheritance:r | Out-Null
    icacls $tempKey /grant:r "$($env:USERNAME):(R)" | Out-Null
    return @{
        Target = "$userName@$hostName"
        Port = $port
        KeyPath = $tempKey
        SudoPassword = $sudoPassword
    }
}

function Invoke-RemoteSudo {
    param(
        [hashtable]$Ssh,
        [string]$Command
    )
    if ([string]::IsNullOrWhiteSpace($Ssh.SudoPassword)) {
        throw 'WARDEN_SUDO_PASSWORD em falta no production.deploy.local.env (necessário para du em /var/lib/mysql).'
    }
    $escaped = $Ssh.SudoPassword.Replace("'", "'\''")
    $remote = "echo '$escaped' | sudo -S $Command 2>/dev/null"
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = & ssh -p $Ssh.Port -i $Ssh.KeyPath -o BatchMode=yes $Ssh.Target $remote 2>&1
    $exit = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    if ($exit -ne 0) {
        throw "Sudo remoto falhou: $out"
    }
    return (($out | Where-Object { $_ -is [string] } | Out-String).Trim())
}

function Get-TableYear {
    param([string]$Name)
    if ($Name -match '(20\d{2})') {
        return [int]$Matches[1]
    }
    return $null
}

function Test-ShouldArchive {
    param([string]$Name, [int]$MaxYear)
    $year = Get-TableYear -Name $Name
    if ($null -eq $year) { return $false }
  if ($year -gt $MaxYear) { return $false }
    if ($Name -match '2024|2025|2026') { return $false }
    return $true
}

function Invoke-SshStreamToFile {
    param(
        [hashtable]$Ssh,
        [string]$RemoteCommand,
        [string]$OutFile
    )
    $dir = Split-Path -Parent $OutFile
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    if (Test-Path -LiteralPath $OutFile) { Remove-Item -LiteralPath $OutFile -Force }
    $errFile = Join-Path $dir '_ssh_stderr.tmp'
    if (Test-Path -LiteralPath $errFile) { Remove-Item -LiteralPath $errFile -Force }

    $keyPath = (Resolve-Path -LiteralPath $Ssh.KeyPath).Path
    $argumentList = @(
        '-p', [string]$Ssh.Port,
        '-i', [string]$keyPath,
        '-o', 'BatchMode=yes',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ServerAliveCountMax=10',
        [string]$Ssh.Target,
        [string]$RemoteCommand
    )
    $proc = Start-Process -FilePath 'ssh.exe' -ArgumentList $argumentList `
        -RedirectStandardOutput $OutFile -RedirectStandardError $errFile `
        -Wait -PassThru -NoNewWindow
    $err = ''
    if (Test-Path -LiteralPath $errFile) {
        $err = Get-Content -LiteralPath $errFile -Raw
        Remove-Item -LiteralPath $errFile -Force
    }
    if ($proc.ExitCode -ne 0) {
        if (Test-Path -LiteralPath $OutFile) { Remove-Item -LiteralPath $OutFile -Force }
        throw "SSH falhou (exit $($proc.ExitCode)): $err"
    }
    if (-not (Test-Path -LiteralPath $OutFile)) {
        throw 'SSH não produziu ficheiro de saída.'
    }
}

function Assert-SafeTableName {
    param([string]$Name)
    if ($Name -notmatch '^[A-Za-z0-9_]+$') {
        throw "Nome de tabela inválido: $Name"
    }
}

function Invoke-RemoteMysql {
    param(
        [hashtable]$Ssh,
        [hashtable]$Db,
        [string]$Sql,
        [string]$Database = ''
    )
    $sqlOneLine = ($Sql -replace '\s+', ' ').Trim()
    $dbArg = if ($Database) { " $Database" } else { '' }
    $remote = "MYSQL_PWD=$($Db.Password) mysql -u $($Db.User) -N -B$dbArg -e '$($sqlOneLine.Replace("'", "'\\''"))' 2>/dev/null"
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = & ssh -p $Ssh.Port -i $Ssh.KeyPath -o BatchMode=yes -o ServerAliveInterval=30 $Ssh.Target $remote 2>&1
    $exit = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    $text = ($out | Where-Object { $_ -is [string] } | Out-String).Trim()
    if ($exit -ne 0) {
        throw "MySQL remoto falhou (exit $exit): $text"
    }
    return $text
}

function Get-RemoteD4maiaTableSet {
    $raw = Invoke-RemoteMysql -Ssh $sshInfo -Db $db -Sql 'SHOW TABLES' -Database 'd4maia'
    $set = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
    foreach ($line in ($raw -split "[\r\n]+")) {
        $name = $line.Trim()
        if (-not [string]::IsNullOrWhiteSpace($name)) {
            [void]$set.Add($name)
        }
    }
    return $set
}

function Get-FileSha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Test-GzipIntegrity {
    param([string]$Path)
    $fs = [System.IO.File]::OpenRead($Path)
    try {
        $gzip = New-Object System.IO.Compression.GzipStream($fs, [System.IO.Compression.CompressionMode]::Decompress)
        $buf = New-Object byte[] 65536
        while ($gzip.Read($buf, 0, $buf.Length) -gt 0) { }
        $gzip.Close()
        return $true
    } catch {
        return $false
    } finally {
        $fs.Close()
    }
}

function Save-Manifest {
    param($Manifest, [string]$Path)
    $Manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Load-Manifest {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

$repoRoot = Get-RepoRoot
$tablesDir = Join-Path $LocalRoot 'tables'
$manifestPath = Join-Path $LocalRoot 'manifest.json'
$reportPath = Join-Path $LocalRoot 'verify-report.txt'
$sshInfo = Get-SshTarget -DeployEnvPath $DeployEnvPath
$db = Get-DbCredentials -ConfigPath $DbConfigPath
if (-not (Test-Path -LiteralPath $LocalRoot)) {
    New-Item -ItemType Directory -Force -Path $LocalRoot | Out-Null
}
if (-not (Test-Path -LiteralPath $tablesDir)) {
    New-Item -ItemType Directory -Force -Path $tablesDir | Out-Null
}

$drive = (Split-Path -Qualifier $LocalRoot)
$freeGb = (Get-PSDrive -Name $drive.TrimEnd(':') -ErrorAction SilentlyContinue).Free / 1GB
if ($freeGb -lt 10 -and $Phase -in @('dump', 'all')) {
    Write-Warning "Menos de 10 GB livres em ${drive} ($([math]::Round($freeGb,1)) GB). Continuar pode falhar."
}

function Update-Inventory {
    Write-Host '[d4maia] Inventário...'
    $raw = Invoke-RemoteMysql -Ssh $sshInfo -Db $db -Sql 'SHOW TABLES' -Database 'd4maia'
    $entries = @()
    $manual = @()
    foreach ($line in ($raw -split "`n")) {
        $name = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($name)) { continue }
        $year = Get-TableYear -Name $name
        if ($null -eq $year) {
            $manual += $name
            continue
        }
        if (-not (Test-ShouldArchive -Name $name -MaxYear $MaxYear)) { continue }
        if ($Tables.Count -gt 0 -and $Tables -notcontains $name) { continue }
        Assert-SafeTableName -Name $name
        $duOut = Invoke-RemoteSudo -Ssh $sshInfo -Command "du -sb /var/lib/mysql/d4maia/${name}.ibd 2>/dev/null || du -sb /var/lib/mysql/d4maia/${name} 2>/dev/null"
        $bytes = 0
        if ($duOut -match '^(\d+)') { $bytes = [long]$Matches[1] }
        $mb = [math]::Round($bytes / 1MB, 1)
        $rows = 0
        try {
            $rows = [long](Invoke-RemoteMysql -Ssh $sshInfo -Db $db -Sql "SELECT COUNT(*) FROM $name" -Database 'd4maia')
        } catch {
            Write-Warning "COUNT falhou para ${name}: $_"
        }
        $entries += [pscustomobject]@{
            table = $name
            year = $year
            mb = $mb
            row_estimate = $rows
            status = 'pending'
            count_before = $null
            file_bytes = $null
            sha256 = $null
            dump_finished_at = $null
            dropped_at = $null
            error = $null
        }
    }
    $manifest = [pscustomobject]@{
        schema = 'd4maia'
        max_year = $MaxYear
        created_at = (Get-Date).ToString('o')
        manual_review = $manual
        tables = @($entries | Sort-Object mb)
        df_before = $null
        df_after = $null
    }
    Save-Manifest -Manifest $manifest -Path $manifestPath
    $totalMb = ($entries | Measure-Object -Property mb -Sum).Sum
    Write-Host "Tabelas a arquivar: $($entries.Count) (~$([math]::Round($totalMb,0)) MB)"
    Write-Host "Revisão manual (sem ano): $($manual -join ', ')"
    return $manifest
}

function Invoke-DumpPhase {
    param($Manifest)
    try {
        $dfLine = & ssh -p $sshInfo.Port -i $sshInfo.KeyPath -o BatchMode=yes $sshInfo.Target "df -h / | tail -1" 2>$null
        $Manifest.df_before = ($dfLine | Out-String).Trim()
    } catch { }

    $sorted = @($Manifest.tables | Sort-Object { [double]$_.mb })
    if ($Tables.Count -gt 0) {
        $sorted = @($sorted | Where-Object { $Tables -contains $_.table })
    }
    foreach ($t in $sorted) {
        $name = $t.table
        $outFile = Join-Path $tablesDir "$name.sql.gz"
        Write-Host "[dump] $name ($($t.mb) MB est.)..."
        if ($DryRun) { continue }

        try {
            if ($t.status -eq 'dump_ok' -and (Test-Path -LiteralPath $outFile) -and (Test-GzipIntegrity -Path $outFile)) {
                Write-Host "[dump] $name - ja existe, a saltar."
                continue
            }

            Assert-SafeTableName -Name $name
            $countAttempt = 0
            $count = $null
            while ($countAttempt -le $MaxRetries -and $null -eq $count) {
                $countAttempt++
                try {
                    $count = [long](Invoke-RemoteMysql -Ssh $sshInfo -Db $db -Sql "SELECT COUNT(*) FROM $name" -Database 'd4maia')
                } catch {
                    if ($countAttempt -gt $MaxRetries) { throw }
                    Start-Sleep -Seconds 5
                }
            }
            $t.count_before = $count

            $dumpCmd = "MYSQL_PWD=$($db.Password) mysqldump -u $($db.User) --single-transaction --quick --skip-lock-tables --set-gtid-purged=OFF --no-tablespaces d4maia $name 2>/dev/null | gzip -c"
            $attempt = 0
            $ok = $false
            while ($attempt -le $MaxRetries -and -not $ok) {
                $attempt++
                try {
                    if (Test-Path -LiteralPath $outFile) { Remove-Item -LiteralPath $outFile -Force }
                    Invoke-SshStreamToFile -Ssh $sshInfo -RemoteCommand $dumpCmd -OutFile $outFile
                    if (-not (Test-Path -LiteralPath $outFile) -or (Get-Item -LiteralPath $outFile).Length -lt 100) {
                        throw 'Ficheiro dump vazio ou ausente.'
                    }
                    if (-not (Test-GzipIntegrity -Path $outFile)) {
                        throw 'gzip integrity check failed.'
                    }
                    $t.file_bytes = (Get-Item -LiteralPath $outFile).Length
                    $t.sha256 = Get-FileSha256 -Path $outFile
                    $t.dump_finished_at = (Get-Date).ToString('o')
                    $t.status = 'dump_ok'
                    $t.error = $null
                    $ok = $true
                    Write-Host "  OK: $([math]::Round($t.file_bytes/1MB,1)) MB compressed"
                } catch {
                    $t.error = $_.Exception.Message
                    if ($attempt -gt $MaxRetries) {
                        $t.status = 'dump_failed'
                        Write-Warning "  FALHOU: $($t.error)"
                    } else {
                        Write-Warning "  Tentativa $attempt falhou, retry..."
                        Start-Sleep -Seconds 5
                    }
                }
            }
        } catch {
            $t.status = 'dump_failed'
            $t.error = $_.Exception.Message
            Write-Warning "  FALHOU: $($t.error)"
        }
        Save-Manifest -Manifest $Manifest -Path $manifestPath
    }
}

function Invoke-VerifyPhase {
    param($Manifest)
    $lines = @("Verify report $(Get-Date -Format o)", "")
    $allOk = $true
    foreach ($t in $Manifest.tables) {
        $name = $t.table
        $path = Join-Path $tablesDir "$name.sql.gz"
        $issues = @()
        if (-not (Test-Path -LiteralPath $path)) { $issues += 'missing file' }
        elseif ((Get-Item -LiteralPath $path).Length -lt 100) { $issues += 'file too small' }
        elseif (-not (Test-GzipIntegrity -Path $path)) { $issues += 'gzip corrupt' }
        if ($null -eq $t.count_before -or $t.count_before -lt 0) { $issues += 'no count_before' }
        if ($t.status -ne 'dump_ok') { $issues += "status=$($t.status)" }
        if ($issues.Count -eq 0) {
            $lines += "OK  $name  rows=$($t.count_before)  bytes=$($t.file_bytes)"
        } else {
            $allOk = $false
            $t.status = 'verify_failed'
            $lines += "FAIL $name  $($issues -join '; ')"
        }
    }
    $failed = @($Manifest.tables | Where-Object { $_.status -ne 'dump_ok' })
    $lines += ""
    $lines += "Summary: $(@($Manifest.tables).Count) tables, $($failed.Count) not dump_ok, allOk=$allOk"
    $lines | Set-Content -LiteralPath $reportPath -Encoding UTF8
    Save-Manifest -Manifest $Manifest -Path $manifestPath
    if (-not $allOk -or $failed.Count -gt 0) {
        throw "Verificação falhou. Ver $reportPath"
    }
    Write-Host "Verificação OK. Relatório: $reportPath"
    return $true
}

function Invoke-DropPhase {
    param($Manifest)
    foreach ($t in $Manifest.tables) {
        $name = $t.table
        $gz = Join-Path $tablesDir "$name.sql.gz"
        if (-not (Test-Path -LiteralPath $gz)) {
            throw "Abortar drop: dump em falta para $name"
        }
        if (-not (Test-GzipIntegrity -Path $gz)) {
            throw "Abortar drop: gzip invalido para $name"
        }
        if ($t.status -notin @('dump_ok', 'dropped')) {
            throw "Abortar drop: $($t.table) status=$($t.status)"
        }
    }
    if ($DryRun) {
        Write-Host '[dry-run] DROP omitido.'
        return
    }
    $remoteTables = Get-RemoteD4maiaTableSet
    foreach ($t in $Manifest.tables) {
        $name = $t.table
        Write-Host "[drop] $name"
        try {
            Assert-SafeTableName -Name $name
            if (-not $remoteTables.Contains($name)) {
                Write-Host "  SKIP: ja ausente no servidor."
                $t.status = 'dropped'
                $t.dropped_at = (Get-Date).ToString('o')
                Save-Manifest -Manifest $Manifest -Path $manifestPath
                continue
            }
            $sql = "DROP TABLE IF EXISTS $name"
            Invoke-RemoteMysql -Ssh $sshInfo -Db $db -Sql $sql -Database 'd4maia' | Out-Null
            $remoteTables = Get-RemoteD4maiaTableSet
            if ($remoteTables.Contains($name)) {
                throw "Tabela $name ainda existe apos DROP."
            }
            $t.status = 'dropped'
            $t.dropped_at = (Get-Date).ToString('o')
        } catch {
            throw "DROP falhou em ${name}: $($_.Exception.Message)"
        }
        Save-Manifest -Manifest $Manifest -Path $manifestPath
    }
    try {
        $dfLine = & ssh -p $sshInfo.Port -i $sshInfo.KeyPath -o BatchMode=yes $sshInfo.Target "df -h / | tail -1" 2>$null
        $Manifest.df_after = ($dfLine | Out-String).Trim()
    } catch { }
    Save-Manifest -Manifest $Manifest -Path $manifestPath
    Write-Host "DROP concluido. df: $($Manifest.df_after)"
}

$runInventory = $Phase -in @('inventory', 'all')
$runDump = $Phase -in @('dump', 'all')
$runVerify = $Phase -eq 'verify'
$runDrop = $Phase -in @('drop', 'all')

$manifest = Load-Manifest -Path $manifestPath
if ($runInventory -or $null -eq $manifest) {
    $manifest = Update-Inventory
    if ($Phase -eq 'inventory' -or $DryRun) {
        exit 0
    }
}

if ($runDump) {
    Invoke-DumpPhase -Manifest $manifest
}

if ($runVerify) {
    Invoke-VerifyPhase -Manifest $manifest
}

if ($runDrop) {
    if ($Phase -eq 'all') {
        Invoke-VerifyPhase -Manifest $manifest | Out-Null
    } elseif ($Phase -eq 'drop') {
        Write-Host '[d4maia] Fase drop: validacao local dos dumps (sem re-verify manifest).'
    }
    Invoke-DropPhase -Manifest $manifest
}

Write-Host '[d4maia] Fase concluida.'
