const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/pages/PreCount.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split(/\r?\n/);

console.log('Total lines:', lines.length);

// Buscamos el marcador de la corrupción
const targetLineIndex = lines.findIndex(l => l.trim() === 'div>');

if (targetLineIndex !== -1) {
    console.log('Found "div>" at line:', targetLineIndex + 1);
    
    // Buscamos el inicio del bloque a reemplazar (el comentario de la columna derecha)
    let startReplace = -1;
    for (let i = targetLineIndex; i > 0; i--) {
        if (lines[i].includes('Right Column: Dense List / Table (Solo para Zebra/Salon)')) {
            startReplace = i;
            break;
        }
    }
    
    // Buscamos el final del bloque a reemplazar (justo antes de <PreCountList)
    const endReplace = lines.findIndex((l, i) => i > targetLineIndex && l.includes('<PreCountList'));
    
    if (startReplace !== -1 && endReplace !== -1) {
        console.log(`Replacing from line ${startReplace + 1} to ${endReplace}`);
        
        const newContent = [
            '                                        </Card>',
            '                                    </div>',
            '',
            '                                    {/* Right Column: Dense List / Table (Solo para Zebra/Salon) */}',
            '                                    <div className="lg:col-span-8 lg:col-start-5 flex flex-col h-full min-h-0 bg-card border border-border/40 rounded-xl overflow-hidden shadow-sm">'
        ];
        
        lines.splice(startReplace, endReplace - startReplace, ...newContent);
        fs.writeFileSync(filePath, lines.join('\n'));
        console.log('Fixed successfully');
    } else {
        console.log('Could not find start/end markers:', { startReplace, endReplace });
    }
} else {
    console.log('Could not find "div>" marker. Looking for alternatives...');
    // Si no encuentra div>, intentamos buscar el bloque por el comentario corrupto
    const fallbackStart = lines.findIndex(l => l.includes('Right Column: Dense List / Table (Solo para Zebra/Salon)'));
    if (fallbackStart !== -1) {
        const fallbackEnd = lines.findIndex((l, i) => i > fallbackStart && l.includes('<PreCountList'));
        if (fallbackEnd !== -1) {
             const newContent = [
                '                                        </Card>',
                '                                    </div>',
                '',
                '                                    {/* Right Column: Dense List / Table (Solo para Zebra/Salon) */}',
                '                                    <div className="lg:col-span-8 lg:col-start-5 flex flex-col h-full min-h-0 bg-card border border-border/40 rounded-xl overflow-hidden shadow-sm">'
            ];
            lines.splice(fallbackStart, fallbackEnd - fallbackStart, ...newContent);
            fs.writeFileSync(filePath, lines.join('\n'));
            console.log('Fixed using fallback');
        }
    }
}
