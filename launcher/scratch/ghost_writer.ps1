Add-Type -AssemblyName Microsoft.VisualBasic
Add-Type -AssemblyName System.Windows.Forms

$processName = "PlexOnze"
$wshell = New-Object -ComObject WScript.Shell

# Buscar el proceso
$proc = Get-Process | Where-Object { $_.ProcessName -eq $processName } | Select-Object -First 1

if ($proc) {
    Write-Host "Enfocando Plex..."
    # Activar la ventana
    $wshell.AppActivate($proc.Id)
    Start-Sleep -Milliseconds 500
    
    Write-Host "Escribiendo código de barras..."
    [System.Windows.Forms.SendKeys]::SendWait("7798140255222")
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    
    Write-Host "¡Prueba completada!"
} else {
    Write-Host "No se encontró el proceso PlexOnze abierto."
}
