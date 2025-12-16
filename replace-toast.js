const fs = require('fs');
const path = require('path');

const files = [
    'src/pages/Dashboard.tsx',
    'src/pages/ExpirationControl.tsx',
    'src/pages/PreCount.tsx',
    'src/pages/Products.tsx',
    'src/pages/Reports.tsx',
    'src/pages/StockImport.tsx',
    'src/pages/CyclicInventoryDetail.tsx',
    'src/pages/CyclicInventory.tsx',
    'src/pages/AdminBranches.tsx',
    'src/hooks/useInventorySync.ts',
    'src/hooks/useInventoryUpload.ts',
    'src/hooks/useOfflineSync.ts',
    'src/hooks/useSyncManager.ts',
    'src/components/AddEventDialog.tsx',
    'src/components/BarcodeScanner.tsx',
    'src/components/ExpirationEntryModal.tsx',
    'src/components/dashboard/widgets/UpcomingInventoriesWidget.tsx',
    'src/components/ReportDetail.tsx',
    'src/components/SaveReportModal.tsx',
    'src/components/dashboard/widgets/CalendarWidget.tsx',
    'src/components/HeaderMenus.tsx',
    'src/components/dashboard/CalendarModal.tsx',
    'src/components/SyncStatusBottomSheet.tsx'
];

const projectRoot = process.cwd();

files.forEach(file => {
    const fullPath = path.join(projectRoot, file);

    if (!fs.existsSync(fullPath)) {
        console.log(`❌ No encontrado: ${file}`);
        return;
    }

    console.log(`📝 Procesando: ${file}`);

    let content = fs.readFileSync(fullPath, 'utf8');
    let changed = false;

    // 1. Reemplazar import
    if (content.includes('import { toast } from "sonner"') || content.includes("import { toast } from 'sonner'")) {
        content = content.replace(/import \{ toast \} from ["']sonner["'];?/g, 'import { notify } from "@/lib/notifications";');
        changed = true;
    }

    // 2. Reemplazar toast.success
    content = content.replace(/toast\.success\(([^)]+)\)/g, (match, args) => {
        changed = true;
        return `notify.success("Operación exitosa", ${args})`;
    });

    // 3. Reemplazar toast.error
    content = content.replace(/toast\.error\(([^)]+)\)/g, (match, args) => {
        changed = true;
        return `notify.error("Error", ${args})`;
    });

    // 4. Reemplazar toast.info
    content = content.replace(/toast\.info\(([^)]+)\)/g, (match, args) => {
        changed = true;
        return `notify.info("Información", ${args})`;
    });

    // 5. Reemplazar toast.warning
    content = content.replace(/toast\.warning\(([^)]+)\)/g, (match, args) => {
        changed = true;
        return `notify.warning("Advertencia", ${args})`;
    });

    if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ Completado: ${file}`);
    } else {
        console.log(`⏭️  Sin cambios: ${file}`);
    }
});

console.log('\\n🎉 ¡Reemplazo masivo completado!');
