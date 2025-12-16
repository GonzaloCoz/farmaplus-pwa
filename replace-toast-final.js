const fs = require('fs');
const path = require('path');

const files = [
    'src/pages/PreCount.tsx',
    'src/pages/Reports.tsx',
    'src/pages/Settings.tsx',
    'src/pages/StockImport.tsx',
    'src/pages/Products.tsx',
    'src/pages/ExpirationControl.tsx',
    'src/pages/Dashboard.tsx',
    'src/pages/CyclicInventoryDetail.tsx',
    'src/pages/CyclicInventory.tsx',
    'src/pages/AdminBranches.tsx',
    'src/components/SyncStatusBottomSheet.tsx',
    'src/components/dashboard/widgets/CalendarWidget.tsx',
    'src/components/dashboard/CalendarModal.tsx'
];

files.forEach(file => {
    const fullPath = path.join(process.cwd(), file);

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

    // 2. Reemplazar toast.success - simple
    const successMatches = content.match(/toast\.success\([^)]+\)/g);
    if (successMatches) {
        successMatches.forEach(match => {
            const args = match.match(/toast\.success\((.+)\)/)[1];
            content = content.replace(match, `notify.success("Operación exitosa", ${args})`);
            changed = true;
        });
    }

    // 3. Reemplazar toast.error - simple
    const errorMatches = content.match(/toast\.error\([^)]+\)/g);
    if (errorMatches) {
        errorMatches.forEach(match => {
            const args = match.match(/toast\.error\((.+)\)/)[1];
            content = content.replace(match, `notify.error("Error", ${args})`);
            changed = true;
        });
    }

    // 4. Reemplazar toast.info
    const infoMatches = content.match(/toast\.info\([^)]+\)/g);
    if (infoMatches) {
        infoMatches.forEach(match => {
            const args = match.match(/toast\.info\((.+)\)/)[1];
            content = content.replace(match, `notify.info("Información", ${args})`);
            changed = true;
        });
    }

    // 5. Reemplazar toast.warning
    const warningMatches = content.match(/toast\.warning\([^)]+\)/g);
    if (warningMatches) {
        warningMatches.forEach(match => {
            const args = match.match(/toast\.warning\((.+)\)/)[1];
            content = content.replace(match, `notify.warning("Advertencia", ${args})`);
            changed = true;
        });
    }

    if (changed) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ Completado: ${file}`);
    } else {
        console.log(`⏭️  Sin cambios: ${file}`);
    }
});

console.log('\n🎉 ¡Reemplazo masivo completado!');
