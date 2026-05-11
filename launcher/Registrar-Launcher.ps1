# Script para registrar Farmaplus Launcher en el menú "Abrir con..." de Windows

$ExePath = "C:\Proyectos\farmaplus-pwa-main\launcher\dist\win-unpacked\Farmaplus Launcher.exe"
$AppName = "Farmaplus Launcher"

if (-not (Test-Path $ExePath)) {
    Write-Error "No se encontró el ejecutable en: $ExePath. Por favor, verifica la ruta."
    exit
}

Write-Host "Registrando $AppName en el sistema..." -ForegroundColor Cyan

# 1. Registrar la aplicación y crear un ProgID
$ProgID = "Farmaplus.Launcher"
$ProgIDPath = "HKCU:\Software\Classes\$ProgID"
if (-not (Test-Path $ProgIDPath)) { New-Item -Path $ProgIDPath -Force | Out-Null }
Set-ItemProperty -Path $ProgIDPath -Name "(Default)" -Value "Farmaplus Inventory Launcher"

$CommandPath = "$ProgIDPath\shell\open\command"
if (-not (Test-Path $CommandPath)) { New-Item -Path $CommandPath -Force | Out-Null }
Set-ItemProperty -Path $CommandPath -Name "(Default)" -Value "`"$ExePath`" `"%1`""

# 2. Asociar con extensiones comunes (.xls, .xlsx, .csv)
$Extensions = @(".xls", ".xlsx", ".csv")

foreach ($ext in $Extensions) {
    # Agregar a la lista de "Abrir con..."
    $OpenWithList = "HKCU:\Software\Classes\$ext\OpenWithList"
    if (-not (Test-Path $OpenWithList)) { New-Item -Path $OpenWithList -Force | Out-Null }
    New-Item -Path "$OpenWithList\Farmaplus Launcher.exe" -Force -ErrorAction SilentlyContinue | Out-Null

    # Registrar el ProgID como opción válida para la extensión
    $OpenWithProgids = "HKCU:\Software\Classes\$ext\OpenWithProgids"
    if (-not (Test-Path $OpenWithProgids)) { New-Item -Path $OpenWithProgids -Force | Out-Null }
    Set-ItemProperty -Path $OpenWithProgids -Name $ProgID -Value ""
    
    # Intentar sugerirlo como aplicación recomendada
    $ExplorerPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\$ext\OpenWithList"
    if (Test-Path $ExplorerPath) {
        Set-ItemProperty -Path $ExplorerPath -Name "g" -Value "Farmaplus Launcher.exe" -ErrorAction SilentlyContinue
    }
}

Write-Host "¡Registro completado!" -ForegroundColor Green
Write-Host "Para que sea automático:" -ForegroundColor Cyan
Write-Host "1. Haz clic derecho en un archivo .xlsx"
Write-Host "2. Selecciona 'Abrir con...' -> 'Elegir otra aplicación'"
Write-Host "3. Selecciona '$AppName' y marca 'Siempre usar esta aplicación'" -ForegroundColor Yellow
