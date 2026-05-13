$procs = Get-Process | Where-Object { $_.MainWindowTitle -ne "" }
foreach ($p in $procs) {
    if ($p.ProcessName -like "*Plex*" -or $p.MainWindowTitle -like "*Plex*") {
        Write-Host "Ventana encontrada: $($p.MainWindowTitle) (Proceso: $($p.ProcessName))"
    }
}
