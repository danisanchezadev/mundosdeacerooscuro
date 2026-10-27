$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$python = Join-Path $root 'backend\.venv\Scripts\python.exe'

if (-not (Test-Path $python)) {
    throw 'Entorno no instalado. Ejecuta primero .\scripts\setup.ps1'
}

$api = Start-Process -FilePath $python -ArgumentList 'manage.py', 'runserver', '8000' `
    -WorkingDirectory (Join-Path $root 'backend') -PassThru -NoNewWindow
Write-Host "Backend:  http://localhost:8000  (Swagger: /api/docs/)" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173  (Ctrl+C para detener ambos)" -ForegroundColor Green

try {
    Set-Location (Join-Path $root 'frontend')
    npm run dev
}
finally {
    if ($api -and -not $api.HasExited) {
        Stop-Process -Id $api.Id -Force
    }
}
