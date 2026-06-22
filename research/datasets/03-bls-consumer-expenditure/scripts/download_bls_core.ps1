$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$rawDir = Join-Path $root "raw"
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null

$baseUrl = "https://download.bls.gov/pub/time.series/cx"
$files = @(
    "cx.data.1.AllData",
    "cx.series",
    "cx.category",
    "cx.subcategory",
    "cx.item",
    "cx.demographics",
    "cx.characteristics",
    "cx.footnote",
    "cx.process"
)

foreach ($file in $files) {
    $url = "$baseUrl/$file"
    $dest = Join-Path $rawDir $file
    Write-Host "Downloading $file ..."
    Invoke-WebRequest -Uri $url -OutFile $dest
}

Get-ChildItem -LiteralPath $rawDir |
    Where-Object { $_.Name -like "cx.*" } |
    Get-FileHash -Algorithm SHA256 |
    ForEach-Object { "$($_.Hash.ToLower())  $($_.Path | Split-Path -Leaf)" } |
    Set-Content -Encoding UTF8 (Join-Path $root "MANIFEST.sha256")

Write-Host "BLS core download complete."
