# Builds dist/instatrack-extension-<version>.zip for upload to the Chrome Web Store.
# Run: powershell -ExecutionPolicy Bypass -File build-extension.ps1   (bump "version" in manifest.json first)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$root = $PSScriptRoot
$version = (Get-Content "$root\manifest.json" -Raw | ConvertFrom-Json).version
# Only what the extension loads: no tests, cloud code or docs (Pro is on hold).
$files = 'manifest.json', 'popup.html', 'popup.js', 'list.html', 'list.js',
  'diff.js', 'ui.css', 'ui.js', 'icons/icon16.png', 'icons/icon32.png', 'icons/icon48.png', 'icons/icon128.png'
New-Item -ItemType Directory -Force "$root\dist" | Out-Null
$zipPath = "$root\dist\instatrack-extension-$version.zip"
Remove-Item $zipPath -ErrorAction SilentlyContinue
$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
try { foreach ($f in $files) { [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $root $f), $f) } } finally { $zip.Dispose() }
Write-Output "Built $zipPath"
