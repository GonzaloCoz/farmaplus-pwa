$dllUrl = "https://www.nuget.org/api/v2/package/MySqlConnector/2.3.5"
$zipPath = "$env:TEMP\MySqlConnector.zip"
$extractPath = "$env:TEMP\MySqlConnector"

Write-Host "Descargando MySqlConnector..."
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $dllUrl -OutFile $zipPath

Write-Host "Extrayendo..."
if (Test-Path $extractPath) { Remove-Item -Recurse -Force $extractPath }
Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force

$dllPath = "$extractPath\lib\net471\MySqlConnector.dll"
Add-Type -Path $dllPath

Write-Host "Intentando conexión..."
$connStr = "Server=172.30.40.63;Port=3306;Database=plex;Uid=root;Pwd=plex2014;ConnectionTimeout=5;"
$conn = New-Object MySqlConnector.MySqlConnection($connStr)

try {
    $conn.Open()
    Write-Host "¡CONEXION EXITOSA!"
    
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT p.ean, p.nombre, s.cantidad FROM productos p JOIN laboratorios l ON p.laboratorio_id = l.id JOIN stock s ON p.id = s.producto_id WHERE l.nombre LIKE '%ALCON%' AND s.sucursal_id = 75 LIMIT 10"
    $reader = $cmd.ExecuteReader()
    
    while ($reader.Read()) {
        Write-Host "$($reader.GetString(0)) | $($reader.GetString(1)) | $($reader.GetInt32(2))"
    }
    $reader.Close()
} catch {
    Write-Host "Error: $($_.Exception.Message)"
} finally {
    if ($conn.State -eq 'Open') { $conn.Close() }
}
