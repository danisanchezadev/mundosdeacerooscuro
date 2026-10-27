# Backend local en Windows (PowerShell)
Usa `.venv` (con punto), no el `venv` vacio creado por error.
No necesitas activar el entorno; usa siempre su ejecutable.
## 1. Entrar en el backend
```powershell
Set-Location C:\Users\ae.dominguez\TEST_APP\backend
```
## 2. Solo si falta el entorno o sus dependencias
```powershell
if (-not (Test-Path .\.venv\Scripts\python.exe)) { py -m venv .venv }
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```
## 3. Arrancar (detente si algun comando falla)
```powershell
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000 --noreload
```
Comprueba http://localhost:8000/api/books/ y http://localhost:8000/api/docs/; si ya responden, no arranques otro servidor.
Deja la terminal abierta; Ctrl+C detiene el servidor. Reinicia tras cambios. Usa SQLite sin `.env`; `npm run dev` es del frontend, no del backend.
