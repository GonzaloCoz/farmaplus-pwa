# GitHub Actions Deployment Setup

## ✅ Configuración Completada

Se ha creado un workflow de GitHub Actions en `.github/workflows/deploy.yml` que automatiza el deployment a GitHub Pages.

## Cómo Funciona

### Trigger Automático
El workflow se ejecuta automáticamente cuando:
- Se hace push a la rama `main`
- Se ejecuta manualmente desde GitHub Actions UI

### Proceso de Build
1. **Checkout**: Descarga el código del repositorio
2. **Setup Node.js**: Configura Node.js v20 con cache de npm
3. **Install**: Ejecuta `npm ci` para instalar dependencias
4. **Build**: Ejecuta `npm run build` con memoria extendida (4GB)
5. **Upload**: Sube el contenido de `dist/` como artifact
6. **Deploy**: Despliega a GitHub Pages

### Ventajas
- ✅ Build en ambiente limpio de Ubuntu
- ✅ No depende del ambiente local
- ✅ Memoria extendida para evitar errores de build
- ✅ Cache de dependencias para builds más rápidos
- ✅ Deployment automático al hacer push

## Próximos Pasos

### 1. Configurar GitHub Pages
Ve a tu repositorio en GitHub:
1. Settings → Pages
2. En "Source" selecciona: **GitHub Actions**
3. Guarda los cambios

### 2. Hacer Push de los Cambios
```bash
git add .github/workflows/deploy.yml
git add .
git commit -m "Add GitHub Actions deployment workflow"
git push origin main
```

### 3. Monitorear el Deployment
1. Ve a la pestaña "Actions" en tu repositorio
2. Verás el workflow "Deploy to GitHub Pages" ejecutándose
3. Espera a que complete (usualmente 2-5 minutos)
4. Una vez completado, tu sitio estará disponible en:
   `https://[tu-usuario].github.io/farmaplus-pwa/`

## Troubleshooting

### Si el Build Falla en GitHub Actions
- Revisa los logs en la pestaña Actions
- El error será más claro que en local
- Puedes ejecutar el workflow manualmente con "Run workflow"

### Si el Deployment Falla
- Verifica que GitHub Pages esté configurado para usar "GitHub Actions"
- Asegúrate de que el repositorio sea público o tengas GitHub Pro/Enterprise

## Variables de Entorno (Opcional)

Si necesitas agregar secrets (ej. Supabase keys):
1. Settings → Secrets and variables → Actions
2. New repository secret
3. Agrega las variables necesarias
4. Actualiza el workflow para usarlas:
```yaml
- name: Build
  run: npm run build
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
```
