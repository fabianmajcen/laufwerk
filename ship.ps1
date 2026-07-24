# One-command ship: web build -> cap sync -> APK -> install on the connected
# phone (USB or wireless adb). Run from the app folder:  .\ship.ps1
$ErrorActionPreference = "Stop"
$env:JAVA_HOME = "$env:LOCALAPPDATA\Java\jdk-21"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Write-Host "[1/4] building web assets..." -ForegroundColor Cyan
npm run build | Out-Null

Write-Host "[2/4] syncing capacitor..." -ForegroundColor Cyan
npx cap sync android | Out-Null

Write-Host "[3/4] building APK..." -ForegroundColor Cyan
Push-Location android
.\gradlew.bat assembleDebug --quiet
Pop-Location

$apk = "android\app\build\outputs\apk\debug\app-debug.apk"
$devices = (& $adb devices) -match "device$"
if ($devices.Count -eq 0) {
  Write-Host "[4/4] no phone connected - APK ready at $apk" -ForegroundColor Yellow
  Write-Host "  cable: plug in with USB debugging on, re-run .\ship.ps1"
  Write-Host "  wifi : adb connect <phone-ip>:<port>  (Developer options -> Wireless debugging), re-run"
  exit 0
}

Write-Host "[4/4] installing on $($devices.Count) device(s)..." -ForegroundColor Cyan
& $adb install -r $apk
Write-Host "shipped." -ForegroundColor Green
