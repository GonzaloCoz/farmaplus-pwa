# Script para reemplazar toast por notify en todo el proyecto
# Este script convierte las notificaciones de sonner a notify personalizado

$files = @(
    "src\pages\StockImport.tsx",
    "src\pages\Settings.tsx",
    "src\pages\Reports.tsx",
    "src\pages\Products.tsx",
    "src\pages\Dashboard.tsx",
    "src\pages\AdminBranches.tsx",
    "src\pages\PreCount.tsx",
    "src\pages\ExpirationControl.tsx",
    "src\pages\CyclicInventory.tsx",
    "src\pages\CyclicInventoryDetail.tsx",
    "src\components\ReportDetail.tsx",
    "src\components\SaveReportModal.tsx",
    "src\components\SyncStatusBottomSheet.tsx",
    "src\components\HeaderMenus.tsx",
    "src\components\dashboard\widgets\CalendarWidget.tsx",
    "src\components\dashboard\CalendarModal.tsx",
    "src\components\ExpirationEntryModal.tsx",
    "src\components\dashboard\widgets\UpcomingInventoriesWidget.tsx",
    "src\components\AddEventDialog.tsx",
    "src\hooks\useExpirationControl.ts",
    "src\hooks\useInventorySync.ts",
    "src\hooks\useInventoryUpload.ts",
    "src\hooks\useOfflineSync.ts",
    "src\hooks\useSyncManager.ts"
)

$projectRoot = "c:\Users\GHCoz\OneDrive - FARMAPLUS\Escritorio\farmaplus-pwa-main"

foreach ($file in $files) {
    $fullPath = Join-Path $projectRoot $file
    
    if (Test-Path $fullPath) {
        Write-Host "Procesando: $file" -ForegroundColor Cyan
        
        $content = Get-Content $fullPath -Raw -Encoding UTF8
        
        # 1. Reemplazar import
        $content = $content -replace 'import \{ toast \} from "sonner";', 'import { notify } from "@/lib/notifications";'
        $content = $content -replace "import \{ toast \} from 'sonner';", "import { notify } from '@/lib/notifications';"
        
        # 2. Convertir toast.success, toast.error, toast.info, toast.warning
        # Patrón: toast.TYPE("mensaje") -> notify.TYPE("Título", "mensaje")
        
        # Para success
        $content = $content -replace 'toast\.success\(`([^`]+)`\)', 'notify.success("Operación exitosa", `$1`)'
        $content = $content -replace 'toast\.success\("([^"]+)"\)', 'notify.success("Operación exitosa", "$1")'
        $content = $content -replace "toast\.success\('([^']+)'\)", "notify.success('Operación exitosa', '$1')"
        
        # Para error
        $content = $content -replace 'toast\.error\(`([^`]+)`\)', 'notify.error("Error", `$1`)'
        $content = $content -replace 'toast\.error\("([^"]+)"\)', 'notify.error("Error", "$1")'
        $content = $content -replace "toast\.error\('([^']+)'\)", "notify.error('Error', '$1')"
        
        # Para info
        $content = $content -replace 'toast\.info\(`([^`]+)`\)', 'notify.info("Información", `$1`)'
        $content = $content -replace 'toast\.info\("([^"]+)"\)', 'notify.info("Información", "$1")'
        $content = $content -replace "toast\.info\('([^']+)'\)", "notify.info('Información', '$1')"
        
        # Para warning
        $content = $content -replace 'toast\.warning\(`([^`]+)`\)', 'notify.warning("Advertencia", `$1`)'
        $content = $content -replace 'toast\.warning\("([^"]+)"\)', 'notify.warning("Advertencia", "$1")'
        $content = $content -replace "toast\.warning\('([^']+)'\)", "notify.warning('Advertencia', '$1')"
        
        # Guardar
        Set-Content $fullPath -Value $content -Encoding UTF8 -NoNewline
        Write-Host "✓ Completado: $file" -ForegroundColor Green
    } else {
        Write-Host "✗ No encontrado: $file" -ForegroundColor Yellow
    }
}

Write-Host "`n¡Reemplazo masivo completado!" -ForegroundColor Green
