# Tablet APK Build & Package Script for SML Legacy Cold Store
param (
    [string]$BuildType = "debug"
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " SML Legacy Cold Store - Tablet APK Builder" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Detect Java Home (Compatible with Android Gradle: Java 21)
$candidateJdks = @(
    "$env:USERPROFILE\.jdks\jbr-21.0.11",
    "$env:USERPROFILE\.jdks\temurin-17.0.20",
    "C:\Program Files\Android\Android Studio\jbr"
)

$foundJdk = $null
foreach ($cand in $candidateJdks) {
    if (Test-Path "$cand\bin\java.exe") {
        $foundJdk = $cand
        break
    }
}

if ($foundJdk) {
    $env:JAVA_HOME = $foundJdk
    Write-Host "Using JDK: $env:JAVA_HOME" -ForegroundColor Green
} elseif ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
    Write-Host "Using existing JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Green
} else {
    Write-Host "Error: Compatible Java JDK could not be located." -ForegroundColor Red
    exit 1
}

# 2. Detect Android SDK
if (-not $env:ANDROID_HOME -or -not (Test-Path "$env:ANDROID_HOME\platform-tools")) {
    $candidateSdk = "$env:LOCALAPPDATA\Android\Sdk"
    if (Test-Path "$candidateSdk\platform-tools") {
        $env:ANDROID_HOME = $candidateSdk
        Write-Host "Using Android SDK: $env:ANDROID_HOME" -ForegroundColor Green
    } else {
        Write-Host "Error: ANDROID_HOME is not set and Android SDK could not be located." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Using existing ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Green
}

$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

# 3. Build Web Bundle (Vite -> dist)
$rootDir = Join-Path $PSScriptRoot ".."
Write-Host "Building web bundle (npm run build)..." -ForegroundColor Yellow
Push-Location $rootDir
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Web build failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }

    Write-Host "Syncing assets to Android (npx cap sync android)..." -ForegroundColor Yellow
    & npx.cmd cap sync android
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Capacitor sync failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} finally {
    Pop-Location
}

# 4. Build APK with Gradle
$androidDir = Join-Path $PSScriptRoot "..\android"
$gradlew = Join-Path $androidDir "gradlew.bat"

if (-not (Test-Path $gradlew)) {
    Write-Host "Error: gradlew.bat not found at $gradlew" -ForegroundColor Red
    exit 1
}

$gradleTask = if ($BuildType -eq "release") { "assembleRelease" } else { "assembleDebug" }
Write-Host "Running Gradle: .\gradlew $gradleTask in $androidDir..." -ForegroundColor Yellow

Push-Location $androidDir
$origErrorAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    & .\gradlew.bat $gradleTask
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Gradle build failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
} finally {
    $ErrorActionPreference = $origErrorAction
    Pop-Location
}

# 4. Copy APK to root tablet-apk directory
$apkSource = if ($BuildType -eq "release") {
    Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
} else {
    Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
}

if (-not (Test-Path $apkSource)) {
    Write-Host "Error: Expected APK output not found at $apkSource" -ForegroundColor Red
    exit 1
}

$targetDir = Join-Path $PSScriptRoot "..\tablet-apk"
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

$targetApk = Join-Path $targetDir "sml-cold-store-tablet-v2.apk"
Copy-Item -Path $apkSource -Destination $targetApk -Force

$fileInfo = Get-Item $targetApk
$sizeMB = [math]::Round($fileInfo.Length / 1MB, 2)

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " BUILD SUCCESSFUL!" -ForegroundColor Green
Write-Host " Tablet APK ready at:" -ForegroundColor Cyan
Write-Host "   $targetApk" -ForegroundColor White
Write-Host " File Size: $sizeMB MB" -ForegroundColor Yellow
Write-Host "==================================================" -ForegroundColor Green
