# Script para hacer que Windows y Plex25 reconozcan el Launcher como Excel
$LauncherPath = "C:\Proyectos\farmaplus-pwa-main\launcher\dist\win-unpacked\Farmaplus Launcher.exe"
$ProgID = "Excel.Application"
$CLSID = "{00024500-0000-0000-C000-000000000046}"

if (-not (Test-Path $LauncherPath)) {
    Write-Error "No se encontró el Launcher en $LauncherPath"
    exit
}

Write-Host "Iniciando 'Operación Identidad Secreta'..." -ForegroundColor Cyan

# 1. App Paths
$AppPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\App Paths\excel.exe"
if (-not (Test-Path $AppPath)) { New-Item -Path $AppPath -Force | Out-Null }
Set-ItemProperty -Path $AppPath -Name "(Default)" -Value $LauncherPath
Set-ItemProperty -Path $AppPath -Name "Path" -Value (Split-Path $LauncherPath)

# 2. ProgID
$ClassPath = "HKCU:\Software\Classes\$ProgID"
if (-not (Test-Path $ClassPath)) { New-Item -Path $ClassPath -Force | Out-Null }
Set-ItemProperty -Path $ClassPath -Name "(Default)" -Value "Microsoft Excel Application"
$CurVerPath = "$ClassPath\CurVer"
if (-not (Test-Path $CurVerPath)) { New-Item -Path $CurVerPath -Force | Out-Null }
Set-ItemProperty -Path $CurVerPath -Name "(Default)" -Value "$ProgID.15"

# 3. CLSID
$CLSIDPath = "HKCU:\Software\Classes\CLSID\$CLSID"
if (-not (Test-Path $CLSIDPath)) { New-Item -Path $CLSIDPath -Force | Out-Null }
Set-ItemProperty -Path $CLSIDPath -Name "(Default)" -Value "Microsoft Excel Application"
$LocalServerPath = "$CLSIDPath\LocalServer32"
if (-not (Test-Path $LocalServerPath)) { New-Item -Path $LocalServerPath -Force | Out-Null }
Set-ItemProperty -Path $LocalServerPath -Name "(Default)" -Value "`"$LauncherPath`""

# 4. Asociaciones
$Exts = @(".xls", ".xlsx", ".csv")
foreach ($ext in $Exts) {
    $ExtPath = "HKCU:\Software\Classes\$ext"
    if (-not (Test-Path $ExtPath)) { New-Item -Path $ExtPath -Force | Out-Null }
    Set-ItemProperty -Path $ExtPath -Name "(Default)" -Value "Excel.Sheet.12"
}

Write-Host "¡Registro de 'Falso Excel' completado!" -ForegroundColor Green
