[CmdletBinding()]
param(
    [switch]$Seed
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

function Invoke-Checked {
    param([string]$File, [string[]]$Arguments)
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Fallo: $File $($Arguments -join ' ')" }
}

Write-Host '== Backend ==' -ForegroundColor Green
Set-Location $backend
if (-not (Test-Path '.venv')) {
    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) { Invoke-Checked 'py' @('-3.12', '-m', 'venv', '.venv') }
    else { Invoke-Checked 'python' @('-m', 'venv', '.venv') }
}
$python = Join-Path $backend '.venv\Scripts\python.exe'
Invoke-Checked $python @('-m', 'pip', 'install', '--upgrade', 'pip')
Invoke-Checked $python @('-m', 'pip', 'install', '-r', 'requirements-dev.txt')

if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    $key = & $python -c "import secrets; print(secrets.token_urlsafe(50))"
    (Get-Content '.env') -replace '^DJANGO_SECRET_KEY=.*', "DJANGO_SECRET_KEY=$key" | Set-Content '.env'
    Write-Host 'backend/.env creado con una SECRET_KEY nueva.'
}

Invoke-Checked $python @('manage.py', 'migrate')
if ($Seed) { Invoke-Checked $python @('manage.py', 'seed_scifi_catalog') }

Write-Host '== Frontend ==' -ForegroundColor Green
Set-Location $frontend
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env' }
Invoke-Checked 'npm' @('install')

Write-Host ''
Write-Host 'Instalacion completada.' -ForegroundColor Green
Write-Host 'Crea un administrador:  backend\.venv\Scripts\python.exe backend\manage.py createsuperuser'
Write-Host 'Arranca el entorno:     .\scripts\dev.ps1'
