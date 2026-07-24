# Publish a release: bump version, build APK, commit, tag, upload to GitHub.
# Usage:  .\release.ps1            (bumps patch: 0.2.0 -> 0.2.1)
#         .\release.ps1 -Version 0.3.0
param([string]$Version)
$ErrorActionPreference = "Stop"
$gh = "$env:LOCALAPPDATA\gh\bin\gh.exe"
$env:JAVA_HOME = "$env:LOCALAPPDATA\Java\jdk-21"

# --- version bump ---
$pkg = Get-Content package.json -Raw | ConvertFrom-Json
if (-not $Version) {
  $parts = $pkg.version.Split(".")
  $parts[2] = [string]([int]$parts[2] + 1)
  $Version = $parts -join "."
}
Write-Host "releasing v$Version (was $($pkg.version))" -ForegroundColor Cyan

(Get-Content package.json -Raw) -replace "`"version`": `"$($pkg.version)`"", "`"version`": `"$Version`"" |
  Set-Content package.json -Encoding utf8 -NoNewline

# android versionCode must increase for in-place updates
$gradle = Get-Content android\app\build.gradle -Raw
$code = [int][regex]::Match($gradle, "versionCode (\d+)").Groups[1].Value + 1
$gradle = $gradle -replace "versionCode \d+", "versionCode $code"
$gradle = $gradle -replace "versionName `"[^`"]*`"", "versionName `"$Version`""
Set-Content android\app\build.gradle $gradle -Encoding utf8 -NoNewline

# --- build ---
Write-Host "building..." -ForegroundColor Cyan
npm run build | Out-Null
npx cap sync android | Out-Null
Push-Location android
.\gradlew.bat assembleDebug --quiet
Pop-Location
$apk = "android\app\build\outputs\apk\debug\app-debug.apk"
Copy-Item $apk "laufwerk-v$Version.apk" -Force

# --- commit, tag, release ---
git add -A
git -c user.name="Fabian" -c user.email="fabian.majcen@univie.ac.at" commit -q -m "release v$Version"
git tag "v$Version"
git push -q origin main --tags
& $gh release create "v$Version" "laufwerk-v$Version.apk" --title "Laufwerk v$Version" --notes "Update via Settings -> Check for update."
Remove-Item "laufwerk-v$Version.apk"
Write-Host "released v$Version - phones update via Settings." -ForegroundColor Green
