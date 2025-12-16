const fs = require('fs');
const path = require('path');

// Lista de archivos pendientes
const files = [
    'src/pages/PreCount.tsx',
    'src/pages/Reports.tsx',
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

console.log("Iniciando reemplazo masivo...");

files.forEach(relativePath => {
    const fullPath = path.join(process.cwd(), relativePath);

    if (!fs.existsSync(fullPath)) {
        console.log(`❌ Archivo no encontrado: ${relativePath}`);
        return;
    }

    let content = fs.readFileSync(fullPath, 'utf8');
    let originalHash = content.length; // Simple check

    // 1. Reemplazar Import
    // Regex flexible para capturar 'import { toast } from "sonner";' o con comillas simples
    const importRegex = /import\s+\{\s*toast\s*\}\s+from\s+['"]sonner['"];?/g;
    if (importRegex.test(content)) {
        content = content.replace(importRegex, 'import { notify } from "@/lib/notifications";');
    }

    // 2. Reemplazar llamadas
    // Estrategia: Reemplazar 'toast.method(' por 'notify.method("Titulo Genérico", '
    // Esto hace que el mensaje original pase a ser el segundo argumento (la descripción en notify)

    // Success
    content = content.replace(/toast\.success\(/g, 'notify.success("Operación exitosa", ');

    // Error
    content = content.replace(/toast\.error\(/g, 'notify.error("Error", ');

    // Info
    content = content.replace(/toast\.info\(/g, 'notify.info("Información", ');

    // Warning
    content = content.replace(/toast\.warning\(/g, 'notify.warning("Advertencia", ');

    // Verificar si hubo cambios
    if (content.length !== originalHash || content !== fs.readFileSync(fullPath, 'utf8')) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ Actualizado: ${relativePath}`);
    } else {
        console.log(`⏭️  Sin cambios necesarios: ${relativePath}`);
    }
});

console.log("¡Proceso finalizado!");
