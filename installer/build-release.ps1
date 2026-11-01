param(
    [string]$SourceRoot = 'E:\FeatherClient_minecraft',
    [string]$Version = '1.0.0',
    [string]$PayloadUrl = '',
    [switch]$SkipLauncherBuild
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$installerRoot = $PSScriptRoot
$repoRoot = Split-Path $installerRoot -Parent
$buildRoot = Join-Path $installerRoot 'build'
$stage = Join-Path $buildRoot 'payload'
$dist = Join-Path $installerRoot 'dist'
$downloads = Join-Path $installerRoot 'downloads'
$tools = Join-Path $installerRoot 'tools'
$launcherProject = Join-Path $SourceRoot 'launcher\FeatherRebornLauncher.csproj'
$setupProject = Join-Path $installerRoot 'FeatherReborn.Setup\FeatherReborn.Setup.csproj'
$buildInfoPath = Join-Path $installerRoot 'FeatherReborn.Setup\BuildInfo.g.cs'
$payloadName = 'FeatherReborn-Payload.zip'
$payloadPath = Join-Path $dist $payloadName
$utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false

function Assert-UnderPath {
    param([string]$Path, [string]$Parent)
    $resolvedPath = [IO.Path]::GetFullPath($Path)
    $resolvedParent = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    if (-not $resolvedPath.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Unsafe path: $resolvedPath"
    }
}

function Copy-Tree {
    param([string]$Source, [string]$Destination)
    if (-not (Test-Path -LiteralPath $Source)) { throw "Missing source: $Source" }
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    & robocopy $Source $Destination /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "robocopy failed ($LASTEXITCODE): $Source -> $Destination" }
}

function Copy-File {
    param([string]$Source, [string]$Destination)
    if (-not (Test-Path -LiteralPath $Source)) { throw "Missing source: $Source" }
    $parent = Split-Path $Destination -Parent
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
}

function Ensure-Download {
    param([string]$Url, [string]$Destination)
    if (Test-Path -LiteralPath $Destination) { return }
    New-Item -ItemType Directory -Force -Path (Split-Path $Destination -Parent) | Out-Null
    & curl.exe -L --fail --silent --show-error -o $Destination $Url
    if ($LASTEXITCODE -ne 0) { throw "Download failed: $Url" }
}

if (-not (Test-Path -LiteralPath (Join-Path $SourceRoot 'feather-versions\1.8.9.json'))) {
    throw "SourceRoot is not a Feather Reborn game directory: $SourceRoot"
}
if (-not (Test-Path -LiteralPath $launcherProject)) {
    throw "Launcher project not found: $launcherProject"
}

Assert-UnderPath $buildRoot $installerRoot
Assert-UnderPath $dist $installerRoot

if (Test-Path -LiteralPath $stage) {
    Remove-Item -LiteralPath $stage -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $stage, $dist, $downloads, $tools | Out-Null

Write-Host '[1/7] Building launcher...'
if (-not $SkipLauncherBuild) {
    $launcherOut = Join-Path $buildRoot 'launcher'
    if (Test-Path -LiteralPath $launcherOut) { Remove-Item -LiteralPath $launcherOut -Recurse -Force }
    & dotnet publish $launcherProject -c Release -r win-x64 --self-contained true `
        -o $launcherOut `
        -p:BaseIntermediateOutputPath="$(Join-Path $buildRoot 'launcher-obj\')" `
        -p:PublishSingleFile=true `
        -p:EnableCompressionInSingleFile=true `
        -p:IncludeNativeLibrariesForSelfExtract=true
    if ($LASTEXITCODE -ne 0) { throw 'Launcher build failed.' }
}

$launcherExe = Join-Path $buildRoot 'launcher\FeatherRebornLauncher.exe'
if (-not (Test-Path -LiteralPath $launcherExe)) {
    throw "Launcher not found: $launcherExe"
}

Write-Host '[2/7] Preparing Node.js runtime...'
$nodeExe = Join-Path $tools 'node\node.exe'
$nodeLicense = Join-Path $tools 'node\LICENSE'
if (-not (Test-Path -LiteralPath $nodeExe) -or -not (Test-Path -LiteralPath $nodeLicense)) {
    $nodeZip = Join-Path $downloads 'node-v22.20.0-win-x64.zip'
    Ensure-Download 'https://nodejs.org/dist/v22.20.0/node-v22.20.0-win-x64.zip' $nodeZip
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($nodeZip)
    try {
        foreach ($entryName in @('node-v22.20.0-win-x64/node.exe', 'node-v22.20.0-win-x64/LICENSE')) {
            $entry = $archive.Entries | Where-Object { $_.FullName -eq $entryName } | Select-Object -First 1
            if (-not $entry) { throw "Node package entry missing: $entryName" }
            $targetName = if ($entryName.EndsWith('node.exe')) { 'node.exe' } else { 'LICENSE' }
            $target = Join-Path $tools ('node\' + $targetName)
            New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
        }
    } finally {
        $archive.Dispose()
    }
}

Write-Host '[3/7] Staging runtime files...'
Copy-File $launcherExe (Join-Path $stage 'FeatherRebornLauncher.exe')
Copy-File $nodeExe (Join-Path $stage 'node\node.exe')
Copy-File $nodeLicense (Join-Path $stage 'node\LICENSE')
Copy-File (Join-Path $SourceRoot 'local-ui-server.js') (Join-Path $stage 'local-ui-server.js')
Copy-File (Join-Path $SourceRoot 'start-reborn.ps1') (Join-Path $stage 'start-reborn.ps1')
Copy-Tree (Join-Path $SourceRoot 'local-ui') (Join-Path $stage 'local-ui')
Copy-Tree (Join-Path $SourceRoot 'bootstrap') (Join-Path $stage 'bootstrap')
Copy-Tree (Join-Path $SourceRoot 'feather-versions') (Join-Path $stage 'feather-versions')
Copy-Tree (Join-Path $SourceRoot 'jre') (Join-Path $stage 'jre')
Copy-Tree (Join-Path $SourceRoot 'versions\1.8.9\natives-combined') (Join-Path $stage 'versions\1.8.9\natives-combined')
Copy-Tree (Join-Path $SourceRoot 'feather\assets') (Join-Path $stage 'feather\assets')
Copy-Tree (Join-Path $SourceRoot 'feather\configuration') (Join-Path $stage 'feather\configuration')
Copy-Tree (Join-Path $SourceRoot 'feather\misc') (Join-Path $stage 'feather\misc')

$featherFiles = @(
    'sidebar.json',
    'clickgui-reborn.json',
    'clickgui-hidden.json',
    'mica-state.json',
    'client_preferences.json',
    'visible_sections.json',
    'mc_options_v1.txt',
    'mc_options_v2.txt',
    'cosmetic_settings.json'
)
foreach ($name in $featherFiles) {
    $source = Join-Path $SourceRoot ('feather\' + $name)
    if (Test-Path -LiteralPath $source) {
        Copy-File $source (Join-Path $stage ('feather\' + $name))
    }
}

$rootFiles = @('options.txt', 'optionsof.txt', 'optionsshaders.txt')
foreach ($name in $rootFiles) {
    $source = Join-Path $SourceRoot $name
    if (Test-Path -LiteralPath $source) {
        Copy-File $source (Join-Path $stage $name)
    }
}

$configFiles = @(
    'splash.properties',
    'forge.cfg',
    'forgeChunkLoading.cfg'
)
foreach ($name in $configFiles) {
    $source = Join-Path $SourceRoot ('config\' + $name)
    if (Test-Path -LiteralPath $source) {
        Copy-File $source (Join-Path $stage ('config\' + $name))
    }
}
$modFiles = @(
    'feather-1.8.9-1.0.0-SNAPSHOT.temp.jar',
    'InGameAccountSwitcher-Forge-1.8-8.0.1.jar',
    'TokenAuth-1.2.0.temp.jar',
    'preview_OptiFine_1.8.9_HD_U_M6_pre2.temp.jar',
    'FeatherOpt-1.0.0-SNAPSHOT.temp.jar.disabled',
    '*InputFix*',
    '*MouseDelayFix*'
)
foreach ($entry in $modFiles) {
    if ($entry.Contains('*')) {
        $source = Get-ChildItem -LiteralPath (Join-Path $SourceRoot 'mods') -File -Filter $entry |
            Select-Object -First 1 -ExpandProperty FullName
        if (-not $source) { continue }
    } else {
        $source = Join-Path $SourceRoot ('mods\' + $entry)
    }
    if (Test-Path -LiteralPath $source) {
        Copy-File $source (Join-Path $stage ('mods\' + (Split-Path $source -Leaf)))
    }
}

$versionJson = Get-Content -LiteralPath (Join-Path $SourceRoot 'feather-versions\1.8.9.json') -Raw | ConvertFrom-Json
$libraryCount = 0
foreach ($library in $versionJson.libraries) {
    $relative = $library.name -replace '/', '\'
    $source = Join-Path $SourceRoot ('libraries\java\' + $relative)
    if (Test-Path -LiteralPath $source) {
        Copy-File $source (Join-Path $stage ('libraries\java\' + $relative))
        $libraryCount++
    }
}
if ($libraryCount -lt 50) { throw "Only $libraryCount libraries copied; source setup is incomplete." }

$assetIndexPath = Join-Path $SourceRoot 'assets\indexes\1.8.9-feather-game.json'
$assetIndex = Get-Content -LiteralPath $assetIndexPath -Raw | ConvertFrom-Json
$assetCount = 0
foreach ($property in $assetIndex.objects.PSObject.Properties) {
    $hash = [string]$property.Value.hash
    if ([string]::IsNullOrWhiteSpace($hash)) { continue }
    $relative = $hash.Substring(0, 2) + '\' + $hash
    $source = Join-Path $SourceRoot ('assets\objects\' + $relative)
    if (Test-Path -LiteralPath $source) {
        Copy-File $source (Join-Path $stage ('assets\objects\' + $relative))
        $assetCount++
    }
}
foreach ($indexName in @('1.8.9-feather-game.json', '1.8.json')) {
    $source = Join-Path $SourceRoot ('assets\indexes\' + $indexName)
    if (Test-Path -LiteralPath $source) {
        Copy-File $source (Join-Path $stage ('assets\indexes\' + $indexName))
    }
}
if ($assetCount -lt 600) { throw "Only $assetCount assets copied; source setup is incomplete." }

$launcherConfig = @'
{
  "MemoryMb": 4096,
  "Username": "Player",
  "ExtraJvmArgs": "",
  "KeepLauncherOpen": true
}
'@
[IO.File]::WriteAllText(
    (Join-Path $stage 'launcher-config.json'),
    $launcherConfig,
    $utf8NoBom)

Write-Host "[4/7] Compressing payload ($assetCount assets, $libraryCount libraries)..."
if (Test-Path -LiteralPath $payloadPath) { Remove-Item -LiteralPath $payloadPath -Force }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($payloadPath, [IO.Compression.ZipArchiveMode]::Create)
try {
    $files = @(Get-ChildItem -LiteralPath $stage -Recurse -File)
    $index = 0
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($stage.Length).TrimStart('\')
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $archive,
            $file.FullName,
            $relative,
            [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        $index++
        if (($index % 500) -eq 0) {
            Write-Host "      packaged $index / $($files.Count)"
        }
    }
} finally {
    $archive.Dispose()
}

$unpackedSize = (Get-ChildItem -LiteralPath $stage -Recurse -File | Measure-Object Length -Sum).Sum
$payloadSize = (Get-Item -LiteralPath $payloadPath).Length
$payloadHash = (Get-FileHash -LiteralPath $payloadPath -Algorithm SHA256).Hash.ToLowerInvariant()

Write-Host '[5/7] Generating installer metadata...'
$buildInfo = @"
namespace FeatherReborn.Setup
{
    internal static class BuildInfo
    {
        public const string Version = "$Version";
        public const string PayloadFileName = "$payloadName";
        public static readonly string PayloadSha256 = "$payloadHash";
        public static readonly long PayloadSizeBytes = $payloadSize;
        public static readonly long UnpackedSizeBytes = $unpackedSize;
        public static readonly string DefaultPayloadUrl = "$PayloadUrl";
    }
}
"@
[IO.File]::WriteAllText($buildInfoPath, $buildInfo, $utf8NoBom)

Write-Host '[6/7] Building setup executable...'
$setupOut = Join-Path $buildRoot 'setup'
if (Test-Path -LiteralPath $setupOut) { Remove-Item -LiteralPath $setupOut -Recurse -Force }
& dotnet build $setupProject -c Release `
    -p:BaseIntermediateOutputPath="$(Join-Path $buildRoot 'setup-obj\')" `
    -p:OutputPath="$setupOut\"
if ($LASTEXITCODE -ne 0) { throw 'Setup build failed.' }
$setupExe = Join-Path $dist 'FeatherReborn-Setup.exe'
Copy-Item -LiteralPath (Join-Path $setupOut 'FeatherReborn-Setup.exe') -Destination $setupExe -Force

Write-Host '[7/7] Writing release metadata...'
$setupHash = (Get-FileHash -LiteralPath $setupExe -Algorithm SHA256).Hash.ToLowerInvariant()
$nodeHash = (Get-FileHash -LiteralPath $nodeExe -Algorithm SHA256).Hash.ToLowerInvariant()

$checksums = @"
$payloadHash  $payloadName
$setupHash  FeatherReborn-Setup.exe
"@
[IO.File]::WriteAllText((Join-Path $dist 'SHA256SUMS.txt'), $checksums,
    $utf8NoBom)

$sources = [ordered]@{
    generatedAt = (Get-Date).ToString('o')
    minecraftVersion = '1.8.9'
    featherPatchedJar = [ordered]@{
        source = 'bundled in payload'
        sha256 = (Get-FileHash -LiteralPath (Join-Path $SourceRoot 'mods\feather-1.8.9-1.0.0-SNAPSHOT.temp.jar') -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    officialFeatherJar = [ordered]@{
        url = 'https://builds-cf.feathercdn.net/release/1782267228/feather-1.8.9.jar'
        sha1 = 'cfdf5396e74391dd83cd23e25c8e567f503396d8'
        note = 'Unpatched 1.8.9 base. Replaced by the bundled patched jar.'
    }
    featherAssetIndex = [ordered]@{
        url = 'https://assets.feathercdn.net/feather_assets_index.json'
    }
    mojangAssetIndex = [ordered]@{
        url = 'https://launchermeta.mojang.com/v1/packages/f6ad102bcaa53b1a58358f16e376d548d44933ec/1.8.json'
        sha1 = 'f6ad102bcaa53b1a58358f16e376d548d44933ec'
    }
    cef103 = [ordered]@{
        url = 'https://libs.feathercdn.net/cef_binary-103.0.0+geeea43e-windows64.jar'
        sha1 = '0629243c811b54e5abaa33f7579b987bd9b3b7ad'
    }
    node = [ordered]@{
        version = '22.20.0'
        url = 'https://nodejs.org/dist/v22.20.0/node-v22.20.0-win-x64.zip'
        nodeExeSha256 = $nodeHash
    }
}
[IO.File]::WriteAllText(
    (Join-Path $dist 'SOURCE-INFO.json'),
    ($sources | ConvertTo-Json -Depth 6),
    $utf8NoBom)

$releaseTemplate = [IO.File]::ReadAllText(
    (Join-Path $installerRoot 'release-notes-template.txt'),
    [Text.Encoding]::UTF8)
$releaseReadme = $releaseTemplate.
    Replace('{{PAYLOAD_MB}}', ([Math]::Round($payloadSize / 1MB, 1)).ToString()).
    Replace('{{UNPACKED_GB}}', ([Math]::Round($unpackedSize / 1GB, 2)).ToString())
[IO.File]::WriteAllText((Join-Path $dist 'RELEASE-NOTES.txt'), $releaseReadme, $utf8NoBom)

Write-Host ''
Write-Host 'Release complete:'
Write-Host "  $setupExe ($([Math]::Round((Get-Item $setupExe).Length / 1KB, 1)) KB)"
Write-Host "  $payloadPath ($([Math]::Round($payloadSize / 1MB, 1)) MB)"
Write-Host "  SHA256 payload: $payloadHash"
Write-Host "  SHA256 setup:   $setupHash"
