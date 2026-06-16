# Read .env file
$envPath = Join-Path $PSScriptRoot "..\.env"
$envContent = Get-Content $envPath -Raw

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

$headers = @{
    "apikey" = $key
    "Authorization" = "Bearer $key"
    "Content-Type" = "application/json"
}

function Fetch-All($tableName, $selectParams, $additionalParams) {
    $allData = @()
    $offset = 0
    $limit = 1000
    $hasMore = $true

    while ($hasMore) {
        $uri = "$url/rest/v1/$tableName`?select=$selectParams&limit=$limit&offset=$offset"
        if ($additionalParams) {
            $uri += "&$additionalParams"
        }
        
        Write-Host "Fetching $tableName (offset $offset)..."
        try {
            $data = Invoke-RestMethod -Uri $uri -Headers $headers -Method Get
            $count = $data.Count
            Write-Host "Received $count rows."
            
            if ($count -gt 0) {
                $allData += $data
            }
            
            if ($count -lt $limit) {
                $hasMore = $false
            } else {
                $offset += $limit
            }
        } catch {
            Write-Error "Error fetching $tableName at offset ${offset}: $_"
            $hasMore = $false
        }
    }
    return $allData
}

# 1. Fetch all branch laboratories
Write-Host "=== OBTENIENDO TODAS LAS METAS DE SUCURSALES (branch_laboratories) ==="
$branchLabs = Fetch-All "branch_laboratories" "branch_name,laboratory,category,status" ""
Write-Host "Total registros branch_laboratories obtenidos: $($branchLabs.Count)"

# Agrupar por sucursal para ver cuántos laboratorios únicos tiene asignados cada una
$branchesMeta = @{}
foreach ($row in $branchLabs) {
    $bName = $row.branch_name.Trim()
    $lab = $row.laboratory.Trim()
    
    if (-not $branchesMeta.ContainsKey($bName)) {
        $branchesMeta[$bName] = [System.Collections.Generic.HashSet[string]]::new()
    }
    [void]$branchesMeta[$bName].Add($lab)
}

Write-Host "`nMetas por sucursal (cantidad de laboratorios únicos asignados):"
foreach ($b in ($branchesMeta.Keys | Sort-Object)) {
    Write-Host " - $($b): $($branchesMeta[$b].Count) laboratorios"
}

# 2. Fetch all audit logs with action=INVENTORY_ADJUSTMENT
Write-Host "`n=== OBTENIENDO TODOS LOS LOGS DE AUDITORIA (audit_logs) ==="
$logs = Fetch-All "audit_logs" "created_at,branch_id,action,details" "action=eq.INVENTORY_ADJUSTMENT&order=created_at.asc"
Write-Host "Total logs de ajustes obtenidos: $($logs.Count)"

# Tracear el progreso de cada sucursal
$branchProg = @{} # Branch -> Set of completed labs
$branchCompletions = @() # Array of PSCustomObject (Branch, CompletionTime, LastLab)

foreach ($log in $logs) {
    $bName = $log.branch_id
    if (-not $bName) { continue }
    $bName = $bName.Trim()
    
    # Intentar obtener el laboratorio de los detalles
    $details = $log.details
    $lab = $null
    if ($details -and $details.lab) {
        $lab = $details.lab.Trim()
    }
    
    if (-not $lab) { continue }
    
    # Si la sucursal no tiene meta registrada, intentamos buscar case-insensitive
    if (-not $branchesMeta.ContainsKey($bName)) {
        $foundMeta = $false
        foreach ($k in $branchesMeta.Keys) {
            if ($k.ToLower() -eq $bName.ToLower()) {
                $bName = $k # usar el nombre de la meta
                $foundMeta = $true
                break
            }
        }
        if (-not $foundMeta) {
            # Si no existe en la meta, lo agregamos dinámicamente con tamaño estimado
            $branchesMeta[$bName] = [System.Collections.Generic.HashSet[string]]::new()
        }
    }
    
    if (-not $branchProg.ContainsKey($bName)) {
        $branchProg[$bName] = [System.Collections.Generic.HashSet[string]]::new()
    }
    
    # Marcar laboratorio como completado para esta sucursal
    [void]$branchProg[$bName].Add($lab)
    
    # Verificar si completó el 100% de su meta
    $targetCount = $branchesMeta[$bName].Count
    $currentCount = $branchProg[$bName].Count
    
    # Solo si tiene una meta definida > 0
    if ($targetCount -gt 0 -and $currentCount -eq $targetCount) {
        # Verificar si ya la habíamos marcado como completada
        $alreadyDone = $false
        foreach ($c in $branchCompletions) {
            if ($c.Branch -eq $bName) {
                $alreadyDone = $true
                break
            }
        }
        if (-not $alreadyDone) {
            $branchCompletions += [PSCustomObject]@{
                Branch = $bName
                CompletedAt = $log.created_at
                LabCount = $targetCount
                LastLab = $lab
            }
            Write-Host ">> SUCURSAL COMPLETADA AL 100%: $bName el $($log.created_at) (último lab: $lab)"
        }
    }
}

Write-Host "`n--- RESULTADOS FINALES DEL ANÁLISIS ---"
if ($branchCompletions.Count -eq 0) {
    Write-Host "Ninguna sucursal completó el 100% según los logs procesados o las metas de laboratorios."
} else {
    Write-Host "Las sucursales que completaron al 100% en orden cronológico son:"
    $ordered = $branchCompletions | Sort-Object CompletedAt
    $i = 1
    foreach ($c in $ordered) {
        Write-Host " $i. $($c.Branch) - Completado: $($c.CompletedAt) - Total Labs: $($c.LabCount) (Último Lab: $($c.LastLab))"
        $i++
    }
}

# Mostrar también el progreso final de todas las sucursales para referencia
Write-Host "`nProgreso final por sucursal (laboratorios completados / meta):"
foreach ($b in ($branchesMeta.Keys | Sort-Object)) {
    $done = 0
    if ($branchProg.ContainsKey($b)) {
        $done = $branchProg[$b].Count
    }
    $pct = 0
    if ($branchesMeta[$b].Count -gt 0) {
        $pct = [Math]::Round(($done / $branchesMeta[$b].Count) * 100, 1)
    }
    $statusText = "en progreso"
    if ($pct -eq 100) { $statusText = "COMPLETADO" }
    Write-Host " - $($b): $done / $($branchesMeta[$b].Count) ($pct%) - $statusText"
}
