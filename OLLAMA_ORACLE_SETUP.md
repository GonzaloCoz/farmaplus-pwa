# Guía de Configuración de Ollama y Nginx en Servidor Oracle Cloud

Esta guía explica paso a paso cómo instalar **Ollama**, descargar el modelo **Qwen 2.5 (3B)** y configurar **nginx** como un proxy reverso seguro bajo el dominio `ai.halu.com.ar` para conectar con el asistente de la PWA.

---

## Paso 1: Instalar y Probar Ollama

Accedé por SSH a tu servidor Oracle Cloud y ejecutá el instalador oficial de Ollama:

```bash
# 1. Instalar Ollama automáticamente
curl -fsSL https://ollama.com/install.sh | sh

# 2. Descargar el modelo recomendado (Qwen 2.5 3B, excelente español y liviano)
ollama pull qwen2.5:3b

# 3. Probar el modelo localmente para verificar que responda bien
ollama run qwen2.5:3b "Hola, ¿cómo estás?"
```
*(Escribí `/exit` para salir del chat interactivo).*

---

## Paso 2: Configurar Ollama como Servicio (systemd)

Para asegurarnos de que Ollama escuche localmente y se reinicie solo si el servidor se apaga:

1. Editá el archivo de configuración del servicio de systemd:
   ```bash
   sudo systemctl edit ollama.service
   ```
2. Agregá las siguientes líneas en el editor que se abre (dentro de la sección de Service):
   ```ini
   [Service]
   Environment="OLLAMA_HOST=127.0.0.1"
   ```
3. Guardá el archivo y recargá los servicios de systemd:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart ollama
   ```
4. Verificá que Ollama esté corriendo y escuchando solo localmente (puerto `11434`):
   ```bash
   sudo ss -tulpn | grep 11434
   # Debería mostrar 127.0.0.1:11434
   ```

---

## Paso 3: Configurar Nginx para Exponer `ai.halu.com.ar`

Para exponer la API a la Edge Function de Supabase, configuraremos nginx para proteger Ollama usando una API key interna.

1. Creá o editá un archivo de configuración de sitio en Nginx para `ai.halu.com.ar`:
   ```bash
   sudo nano /etc/nginx/sites-available/ai.halu.com.ar
   ```
2. Pegá la siguiente configuración básica (reemplazando `CLAVE_SECRETA_INTERNA` por una de tu preferencia, que debe coincidir con la variable de entorno de Supabase):
   ```nginx
   server {
       listen 80;
       server_name ai.halu.com.ar;

       # Redirección automática a HTTPS (opcional, Let's Encrypt lo hace solo)
       location / {
           return 301 https://$host$request_uri;
       }
   }

   server {
       listen 443 ssl;
       server_name ai.halu.com.ar;

       # Certificados SSL de Let's Encrypt (Certbot los rellenará solos, ver paso 4)
       # ssl_certificate /etc/letsencrypt/live/ai.halu.com.ar/fullchain.pem;
       # ssl_certificate_key /etc/letsencrypt/live/ai.halu.com.ar/privkey.pem;

       # Seguridad contra abuso: Validar API Key interna
       location /api/ {
           if ($http_x_internal_key != "CLAVE_SECRETA_INTERNA") {
               return 403;
           }

           proxy_pass http://127.0.0.1:11434/api/;
           proxy_read_timeout 120s;
           proxy_connect_timeout 60s;
           
           # Soporte de Streaming / Buffering desactivado
           proxy_http_version 1.1;
           proxy_set_header Connection "";
           proxy_buffering off;
           proxy_cache off;
       }
   }
   ```
3. Habilitá el sitio creando el enlace simbólico y testeá nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/ai.halu.com.ar /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

## Paso 4: Instalar Certificado SSL (HTTPS) con Certbot

La Edge Function corre bajo HTTPS, por lo que exige que Ollama responda también por HTTPS.

```bash
# 1. Instalar Certbot de Let's Encrypt si no lo tenés
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# 2. Generar el certificado para tu dominio (Certbot modificará nginx automáticamente)
sudo certbot --nginx -d ai.halu.com.ar
```

---

## Paso 5: Deploy de la Edge Function en Supabase Self-Hosted

Dado que estás usando una instancia de Supabase self-hosted en tu VPS (`ubuntu@vnic-halu`), no podés usar el comando `supabase functions deploy` como en la versión cloud. En su lugar, el deploy se hace mapeando los archivos en el volumen de Docker.

1. **Copiar la función al VPS:**
   Tenés que copiar la carpeta de la función que creamos localmente en tu proyecto a tu VPS.
   En la ruta de tu VPS donde tengas instalado Supabase (por ejemplo `~/supabase/`), buscá la carpeta de volúmenes de las funciones.
   
   Ejecutá lo siguiente en tu VPS para crear la carpeta:
   ```bash
   mkdir -p ~/supabase/volumes/functions/ai-chat/
   ```

2. **Transferir el archivo:**
   Copiá el contenido de `supabase/functions/ai-chat/index.ts` (de este proyecto) y pegalo dentro de `~/supabase/volumes/functions/ai-chat/index.ts` en tu VPS.

3. **Configurar las variables de entorno:**
   En tu VPS, las variables para la función deben configurarse en el archivo `.env` que lee el contenedor de Edge Functions (o en el archivo `docker-compose.yml` en la sección del servicio `functions`).
   Agregá lo siguiente:
   ```env
   OLLAMA_URL="http://172.18.0.1:11434/api/chat"
   ```
   *(Nota: si el contenedor de la función está en la misma red `supabase_default`, puede apuntar directamente a la IP de la red de Docker de Ollama en lugar de salir a internet).*

4. **Reiniciar el contenedor de funciones:**
   Aplicá los cambios reiniciando el servicio de funciones de tu Supabase:
   ```bash
   cd ~/supabase
   docker compose restart functions
   ```

¡Listo! Tu PWA en `http://localhost:5173` ya está configurada para consultar a la Edge Function self-hosted usando el service `src/services/aiChatService.ts`.
