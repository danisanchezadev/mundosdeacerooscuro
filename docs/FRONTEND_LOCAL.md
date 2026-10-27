# Frontend local en Windows (PowerShell)
Requisitos: Node.js 20.19+ de la rama 20, o 22.12+; npm incluido. Recomendado: Node 24 LTS.
## 1. Entrar en el frontend y comprobar herramientas
```powershell
Set-Location C:\Users\ae.dominguez\TEST_APP\frontend
node --version
npm --version
```
## 2. Preparar dependencias y configuracion (primera vez)
```powershell
npm ci
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```
## 3. Arrancar (detente si cualquier comando anterior falla)
```powershell
npm run dev -- --port 5173 --strictPort
```
Abre http://localhost:5173; deja la terminal abierta y usa Ctrl+C para detener. Si el puerto esta ocupado, revisa el proceso existente.
Para cargar datos necesitas el [backend en el puerto 8000](BACKEND_LOCAL.md). Ejecuta npm aqui, no en backend.
`VITE_API_URL` vacio usa el proxy `/api` a localhost:8000; si lo cambias, indica solo el origen sin `/api` y reinicia Vite.
