$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$java = Join-Path $root 'jre\jre8u332b09-windows-x64\bin\javaw.exe'
$natives = Join-Path $root 'versions\1.8.9\natives-combined'
$j = Get-Content -LiteralPath (Join-Path $root 'feather-versions\1.8.9.json') -Raw | ConvertFrom-Json

# FeatherTweaker must be discovered from mods/, never duplicated on -cp.
$featherMod = Join-Path $root 'mods\feather-1.8.9-1.0.0-SNAPSHOT.temp.jar'
$featherModDisabled = "$featherMod.disabled"
if (-not (Test-Path -LiteralPath $featherMod) -and (Test-Path -LiteralPath $featherModDisabled)) {
    Rename-Item -LiteralPath $featherModDisabled -NewName (Split-Path $featherMod -Leaf) -Force
}

# Restore CEF 103 runtime files if a launcher cleanup removed them.
$cefJar = Join-Path $root 'libraries\native\net\digitalingot\cef_binary\103.0.0\cef_binary-103.0.0+geeea43e-windows64.jar'
$cefRequired = @('icudtl.dat', 'resources.pak', 'snapshot_blob.bin', 'v8_context_snapshot.bin', 'locales\en-US.pak')
$cefMissing = @($cefRequired | Where-Object { -not (Test-Path -LiteralPath (Join-Path $natives $_)) })
if ($cefMissing.Count -gt 0) {
    if (-not (Test-Path -LiteralPath $cefJar)) { throw "CEF 103 jar not found: $cefJar" }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($cefJar)
    try {
        foreach ($entry in $zip.Entries) {
            if ($entry.FullName.EndsWith('/') -or $entry.FullName.StartsWith('META-INF/')) { continue }
            $target = Join-Path $natives ($entry.FullName -replace '/', '\')
            if (Test-Path -LiteralPath $target) { continue }
            $parent = Split-Path $target -Parent
            if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }
            [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
        }
    } finally {
        $zip.Dispose()
    }
}

function Test-LibraryAllowed($lib) {
    if (-not $lib.rules) { return $true }
    $allowed = $false
    foreach ($rule in $lib.rules) {
        $matchesOs = $true
        if ($rule.os -and $rule.os.name -and $rule.os.name -ne 'windows') { $matchesOs = $false }
        if ($matchesOs) {
            if ($rule.action -eq 'allow') { $allowed = $true }
            elseif ($rule.action -eq 'disallow') { $allowed = $false }
        }
    }
    return $allowed
}

$node = Join-Path $root 'node\node.exe'
if (-not (Test-Path -LiteralPath $node)) { $node = 'C:\Program Files\nodejs\node.exe' }
$uiScript = Join-Path $root 'local-ui-server.js'
$port = 4200
$listener = $null
try { $listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop | Select-Object -First 1 } catch { }
if ($listener) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -match 'local-(webapp-proxy|ui-server)\.js') {
        Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 300
    } else {
        throw "Port $port is already in use by another process."
    }
}
if (-not (Test-Path -LiteralPath $node)) { throw "Node.js not found: $node" }
if (-not (Test-Path -LiteralPath $uiScript)) { throw "Local UI server not found: $uiScript" }
Start-Process -FilePath $node -ArgumentList "`"$uiScript`"" -WorkingDirectory $root -WindowStyle Hidden
$ready = $false
for ($i = 0; $i -lt 40 -and -not $ready; $i++) {
    Start-Sleep -Milliseconds 250
    try {
        $connection = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop | Select-Object -First 1
        if ($connection) { $ready = $true }
    } catch { }
}
if (-not $ready) { throw "Local UI server failed to start on port $port" }

$env:FEATHER_TEST = '1'
$env:FEATHER_LOCAL_TEST = '1'
$env:FEATHER_DEBUG = '1'
Write-Output "local UI ready: http://127.0.0.1:$port/"

$cp = New-Object System.Collections.Generic.List[string]
$cp.Add((Join-Path $root 'bootstrap'))
foreach ($lib in $j.libraries) {
    if (-not (Test-LibraryAllowed $lib)) { continue }
    $path = Join-Path $root ('libraries\java\' + ($lib.name -replace '/', '\'))
    if (Test-Path -LiteralPath $path) { $cp.Add($path) }
}
$cpStr = $cp -join ';'
$assets = Join-Path $root 'assets'

$argString = "-Xmx4096M -Xms512M -Djava.library.path=`"$natives`" -Dorg.lwjgl.librarypath=`"$natives`" -Dfml.ignoreInvalidMinecraftCertificates=true -Dfml.ignorePatchDiscrepancies=true -cp `"$cpStr`" FeatherDirectLaunch --username Player --version 1.8.9-feather --gameDir `"$root`" --assetsDir `"$assets`" --assetIndex 1.8.9-feather-game --uuid 00000000000000000000000000000000 --accessToken 0 --userProperties {} --userType legacy --versionType feather --tweakClass net.minecraftforge.fml.common.launcher.FMLTweaker --tweakClass org.spongepowered.asm.launch.MixinTweaker --mixin mixins.feather.json --mixin.config mixins.feather.core.json"

Write-Output "Launching Feather Reborn 1.8.9..."
Start-Process -FilePath $java -ArgumentList $argString -WorkingDirectory $root
Write-Output "Started."
