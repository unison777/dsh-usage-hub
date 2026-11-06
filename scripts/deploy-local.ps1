#requires -Version 5.1
<#
.SYNOPSIS
  把本仓库最新代码部署进 DeepSeek Harness 的 desktop profile。

.DESCRIPTION
  只做三件事，幂等、可重复：
    1. 用 DSH 自带的 pnpm 把包打成 tarball，放进 <profile>\vendor\
    2. 解包覆盖 <profile>\node_modules\@unison777\dsh-usage-hub
    3. 把 profile 的 package.json / pnpm-lock.yaml 里的 file: 指向改成新的 tarball

  这样 profile 只依赖自己 vendor\ 里那份 tarball，**不指向本仓库所在盘符**，
  换机器、挪目录、发布到 GitHub/npm 都不受影响。

  host 半改完由 Loader 自动重载；client 半改完要刷新页面（Ctrl+R）。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\deploy-local.ps1
#>
[CmdletBinding()]
param(
  [string]$Profile = '',
  [string]$Source = '',
  [string]$Node = '',
  [string]$Pnpm = ''
)

$ErrorActionPreference = 'Stop'

# 参数默认值放在脚本体里算：Windows PowerShell 5.1 下 param 默认值里拿 $PSScriptRoot 会为空。
if ($env:DSH_USAGE_HUB_DEBUG) {
  Write-Host ("DEBUG PSCommandPath=[{0}] scriptRoot=[{1}] myCmd=[{2}] HOME=[{3}] cwd=[{4}]" -f `
    $PSCommandPath, $PSScriptRoot, $MyInvocation.MyCommand.Path, $env:USERPROFILE, (Get-Location).Path)
}
$scriptDir = if ($PSCommandPath) { Split-Path -Parent $PSCommandPath } elseif ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { (Get-Location).Path }
if (-not $Profile) { $Profile = Join-Path $env:USERPROFILE '.dsh\profiles\desktop' }
if (-not $Source) { $Source = (Resolve-Path (Join-Path $scriptDir '..')).Path }
if (-not $Node) { $Node = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' }
if (-not $Pnpm) {
  # 优先用 DSH 自己运行时里的 pnpm（跟着 DSH 家目录走，不依赖安装盘符）。
  $pnpmCandidates = @(
    (Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'),
    (Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs'),
    'D:\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
  )
  $Pnpm = $pnpmCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $Pnpm) { throw '找不到 pnpm.mjs；请用 -Pnpm 指定（DSH 运行时目录下的 pnpm\bin\pnpm.mjs）' }
}

function Assert-Path([string]$path, [string]$what) {
  if (-not (Test-Path -LiteralPath $path)) { throw "找不到$what：$path" }
}

Assert-Path $Profile 'profile 目录'
Assert-Path $Source '源码目录'
Assert-Path $Node 'Node 可执行文件'
Assert-Path $Pnpm 'pnpm 入口'

$manifest = [System.IO.File]::ReadAllText((Join-Path $Source 'package.json')) | ConvertFrom-Json
$name = [string]$manifest.name
$version = [string]$manifest.version
$dirName = ($name -split '/')[-1]
$tgzName = (($name -replace '^@', '' -replace '/', '-')) + '-' + $version + '.tgz'
$vendor = Join-Path $Profile 'vendor'
$target = Join-Path $Profile ('node_modules\' + ($name -replace '/', '\'))
$stage = Join-Path $Profile 'node_modules\.usage-hub-stage'

Write-Host "[1/4] 打包 $name@$version" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $vendor | Out-Null
# 先打进临时目录再拷进 vendor：打包失败时不会留下（或误用）旧 tarball。
$packDir = Join-Path $vendor ('.pack-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Force -Path $packDir | Out-Null
Push-Location $Source
try {
  & $Node $Pnpm pack --pack-destination $packDir | Out-Null
  $packCode = $LASTEXITCODE
} finally {
  Pop-Location
}
if ($packCode -ne 0) { throw ('pnpm pack 失败（退出码 ' + $packCode + '）') }
$freshTarball = Join-Path $packDir $tgzName
Assert-Path $freshTarball '本次打包产物'
$tarball = Join-Path $vendor $tgzName
Copy-Item $freshTarball $tarball -Force
Remove-Item $packDir -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "[2/4] 解包到 node_modules" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $stage | Out-Null
& tar.exe -xzf $tarball -C $stage
if ($LASTEXITCODE -ne 0) { throw 'tar 解包失败' }

if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item (Join-Path $stage 'package\*') $target -Recurse -Force
Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "[3/4] 同步 profile 清单" -ForegroundColor Cyan
$spec = 'file:vendor/' + $tgzName
$profileManifestPath = Join-Path $Profile 'package.json'
$manifestText = [System.IO.File]::ReadAllText($profileManifestPath)
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$namePattern = [regex]::Escape('"' + $name + '"')

# 只改文本、不重新序列化整份 JSON —— 保留主目录 hand-edit 过的排版与键序。
if ($manifestText -match $namePattern) {
  $manifestText = [regex]::Replace(
    $manifestText,
    '(' + $namePattern + '\s*:\s*")[^"]*(")',
    ('$1' + $spec + '$2')
  )
} else {
  $manifestText = [regex]::Replace(
    $manifestText,
    '("dependencies"\s*:\s*\{)',
    ('$1' + "`r`n    `"$name`": `"$spec`",")
  )
}
$parsed = $manifestText | ConvertFrom-Json
if (@($parsed.dsh.profile.bundles) -notcontains $name) {
  $manifestText = [regex]::Replace(
    $manifestText,
    '("bundles"\s*:\s*\[)',
    ('$1' + "`r`n        `"$name`",")
  )
}
[System.IO.File]::WriteAllText($profileManifestPath, $manifestText, $utf8NoBom)

$lockPath = Join-Path $Profile 'pnpm-lock.yaml'
if (Test-Path -LiteralPath $lockPath) {
  $lock = [System.IO.File]::ReadAllText($lockPath)
  # 把 importer 里任何 file:vendor/*.tgz（含历史遗留的 file:file: 前缀）统一成当前 spec
  $lock = [regex]::Replace($lock, 'file:(?:file:)*vendor/[^\s''"]+\.tgz', $spec)
  [System.IO.File]::WriteAllText($lockPath, $lock, $utf8NoBom)
}

Write-Host "[4/4] 校验" -ForegroundColor Cyan
$files = (Get-ChildItem -LiteralPath $target -Recurse -File).Count
$sourceClient = (Get-FileHash -LiteralPath (Join-Path $Source 'client.js')).Hash
$targetClient = (Get-FileHash -LiteralPath (Join-Path $target 'client.js')).Hash
if ($sourceClient -ne $targetClient) { throw 'client.js 与源码不一致，部署失败' }
$check = [System.IO.File]::ReadAllText($profileManifestPath) | ConvertFrom-Json
if ($check.dependencies.$name -ne $spec) { throw ('profile 依赖没更新成功：' + $check.dependencies.$name) }
if (@($check.dsh.profile.bundles) -notcontains $name) { throw 'profile bundles 里没有登记本插件' }

Write-Host ''
Write-Host ("已部署 {0}@{1} -> {2}（{3} 个文件）" -f $name, $version, $target, $files) -ForegroundColor Green
Write-Host ('  - vendor tarball : ' + $tarball)
Write-Host ('  - profile 依赖   : ' + $spec)
Write-Host ''
Write-Host '刷新 DSH 页面（Ctrl+R）让客户端半生效；host 半由 Loader 自动重载。' -ForegroundColor Yellow
