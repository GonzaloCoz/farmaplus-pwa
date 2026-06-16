# Read .env file
$envPath = Join-Path $PSScriptRoot "..\.env"
if (-not (Test-Path $envPath)) {
    Write-Error "No se encontró el archivo .env"
    exit 1
}

$envContent = Get-Content $envPath -Raw

# Parse URL and Key
$url = ""
$key = ""

foreach ($line in ($envContent -split "`r?`n")) {
    if ($line -match '^VITE_SUPABASE_URL=(.+)$') {
        $url = $Matches[1].Trim()
    }
    if ($line -match '^VITE_SUPABASE_ANON_KEY=(.+)$') {
        $key = $Matches[1].Trim()
    }
}

if (-not $url -or -not $key) {
    Write-Error "Faltan credenciales de Supabase en .env"
    exit 1
}

Write-Host "URL: $url"

$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
    "Content-Type" = "application/json"
}

# 1. Query branch_laboratories
Write-Host "Consultando branch_laboratories..."
try {
    # Queremos buscar laboratorios que estén completados (100% de progreso)
    # y ver cuándo se actualizaron o crearon, o ver si podemos deducir cuáles fueron las primeras.
    $uri = "$url/rest/v1/branch_laboratories?select=*&progress_percentage=eq.100"
    $completedLabs = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
    
    Write-Host "Cantidad de laboratorios con 100% de progreso: $($completedLabs.Count)"
    
    if ($completedLabs.Count -gt 0) {
        # Mostrar el top por updated_at o creados si tienen esa fecha
        $completedLabs | Group-Object branch_name | ForEach-Object {
            Write-Host "Sucursal: $($_.Name)"
            $_.Group | ForEach-Object {
                Write-Host "  - Laboratorio: $($_.laboratory), Categoría: $($_.category), Actualizado: $($_.updated_at)"
            }
        }
    }
} catch {
    Write-Error "Error consultando branch_laboratories: $_"
}

# 2. Query audit_logs o similar si es accesible
Write-Host "`nConsultando audit_logs..."
try {
    $uriLogs = "$url/rest/v1/audit_logs?select=*&order=created_at.asc&limit=100"
    $logs = Invoke-RestMethod -Uri $uriLogs -Headers $headers -Method Get
    Write-Host "Logs de auditoría encontrados: $($logs.Count)"
    if ($logs.Count -gt 0) {
        $logs | Select-Object created_at, user_id, branch_id, action, entity_type, details | Out-String | Write-Host
    }
} catch {
    Write-Warning "No se pudo consultar audit_logs (probablemente RLS): $_"
}

# 3. Query inventory_adjustments si existe
Write-Host "`nConsultando inventory_adjustments..."
try {
    # Veamos si hay registros de ajustes finales
    $uriAdj = "$url/rest/v1/inventory_adjustments?select=*&order=created_at.asc&limit=100"
    $adjustments = Invoke-RestMethod -Uri $uriAdj -Headers $headers -Method Get
    Write-Host "Ajustes de inventario encontrados: $($adjustments.Count)"
    if ($adjustments.Count -gt 0) {
        # Agrupar por sucursal y fecha de creación más temprana
        $adjustments | Group-Object branch_name | ForEach-Object {
            Write-Host "Sucursal: $($_.Name)"
            # Ver los primeros registros de esta sucursal
            $first = $_.Group | Sort-Object created_at | Select-Object -First 1
            Write-Host "  - Primer ajuste el: $($first.created_at) para el lab $($first.laboratory)"
        }
    }
} catch {
    Write-Warning "No se pudo consultar inventory_adjustments: $_"
}

# 4. Query inventories para ver si hay completados
Write-Host "`nConsultando inventarios (inventories) con status = adjusted..."
try {
    # El estado de los productos en inventario se pone en 'adjusted' cuando se finaliza
    $uriInv = "$url/rest/v1/inventories?select=branch_name,updated_at,status&status=eq.adjusted&order=updated_at.asc&limit=500"
    $invs = Invoke-RestMethod -Uri $uriInv -Headers $headers -Method Get
    Write-Host "Items ajustados en total: $($invs.Count)"
    if ($invs.Count -gt 0) {
        $invs | Group-Object branch_name | ForEach-Object {
            $earliest = $_.Group | Sort-Object updated_at | Select-Object -First 1
            Write-Host "Sucursal: $($_.Name) - Primer item ajustado el: $($earliest.updated_at)"
        }
    }
} catch {
    Write-Warning "No se pudo consultar inventories: $_"
}
