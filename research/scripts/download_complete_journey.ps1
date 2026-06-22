$ErrorActionPreference = "Stop"

$repoApi = "https://api.github.com/repos/bradleyboehmke/completejourney/contents/data?ref=master"
$root = Split-Path -Parent $PSScriptRoot
$rawDir = Join-Path $root "datasets\complete-journey\raw"

New-Item -ItemType Directory -Force -Path $rawDir | Out-Null

$items = Invoke-RestMethod -Uri $repoApi -Headers @{ "User-Agent" = "Codex" }
$wanted = $items | Where-Object { $_.name -ne ".DS_Store" }

foreach ($item in $wanted) {
    $dest = Join-Path $rawDir $item.name
    $isComplete = (Test-Path $dest) -and ((Get-Item $dest).Length -eq [int64]$item.size)

    if ($isComplete) {
        Write-Host "SKIP $($item.name)"
        continue
    }

    Write-Host "DOWNLOAD $($item.name)"
    Invoke-WebRequest -Uri $item.download_url -OutFile $dest -Headers @{ "User-Agent" = "Codex" }
}

Get-ChildItem $rawDir -File |
    Sort-Object Name |
    Select-Object Name, Length, @{ Name = "SHA256"; Expression = { (Get-FileHash -Algorithm SHA256 $_.FullName).Hash } } |
    Format-Table -AutoSize
