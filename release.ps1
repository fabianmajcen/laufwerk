# Publish a release: bump version, build APK, verify the artifact, commit,
# tag, upload to GitHub.
# Usage:  .\release.ps1            (bumps patch: 0.2.1 -> 0.2.2)
#         .\release.ps1 -Version 0.3.0
param([string]$Version)
$ErrorActionPreference = "Stop"
$gh = "$env:LOCALAPPDATA\gh\bin\gh.exe"
$aapt2 = "$env:LOCALAPPDATA\Android\Sdk\build-tools\35.0.0\aapt2.exe"
$env:JAVA_HOME = "$env:LOCALAPPDATA\Java\jdk-21"

function Write-NoBom([string]$Path, [string]$Content) {
  # PS 5.1 'utf8' writes a BOM, which breaks vite (package.json) and gradle
  # (build.gradle). .NET WriteAllText defaults to BOM-less UTF-8.
  [System.IO.File]::WriteAllText((Resolve-Path $Path).Path, $Content)
}
function Assert-Ok([string]$Step) {
  if ($LASTEXITCODE -ne 0) { throw "$Step failed (exit $LASTEXITCODE) - aborting release." }
}

# --- version bump ---
$pkg = Get-Content package.json -Raw | ConvertFrom-Json
if (-not $Version) {
  $parts = $pkg.version.Split(".")
  $parts[2] = [string]([int]$parts[2] + 1)
  $Version = $parts -join "."
}
Write-Host "releasing v$Version (was $($pkg.version))" -ForegroundColor Cyan

$pkgRaw = (Get-Content package.json -Raw) -replace "`"version`": `"$($pkg.version)`"", "`"version`": `"$Version`""
Write-NoBom package.json $pkgRaw

# android versionCode must increase for in-place updates
$gradle = Get-Content android\app\build.gradle -Raw
$code = [int][regex]::Match($gradle, "versionCode (\d+)").Groups[1].Value + 1
$gradle = $gradle -replace "versionCode \d+", "versionCode $code"
$gradle = $gradle -replace "versionName `"[^`"]*`"", "versionName `"$Version`""
Write-NoBom android\app\build.gradle $gradle

# --- build (fail fast on every step) ---
Write-Host "building web..." -ForegroundColor Cyan
npm run build | Out-Null
Assert-Ok "npm run build"
npx cap sync android | Out-Null
Assert-Ok "cap sync"
Write-Host "building apk..." -ForegroundColor Cyan
Push-Location android
.\gradlew.bat assembleDebug --quiet
$gradleExit = $LASTEXITCODE
Pop-Location
if ($gradleExit -ne 0) { throw "gradle failed (exit $gradleExit) - aborting release." }

# --- verify the artifact IS this version before shipping it ---
$apk = "android\app\build\outputs\apk\debug\app-debug.apk"
$badging = & $aapt2 dump badging $apk | Select-Object -First 1
if ($badging -notmatch "versionName='$([regex]::Escape($Version))'") {
  throw "APK verification failed: expected versionName $Version, got: $badging"
}
Write-Host "verified: $badging" -ForegroundColor Green

# --- commit, tag, release ---
Copy-Item $apk "laufwerk-v$Version.apk" -Force
git add -A
git -c user.name="Fabian" -c user.email="fabian.majcen@univie.ac.at" commit -q -m "release v$Version"
git tag "v$Version"
git push -q origin main --tags
Assert-Ok "git push"
& $gh release create "v$Version" "laufwerk-v$Version.apk" --title "Laufwerk v$Version" --notes "Update via Settings -> Check for update."
Assert-Ok "gh release create"
Remove-Item "laufwerk-v$Version.apk"
Write-Host "released v$Version - phones update via Settings." -ForegroundColor Green
