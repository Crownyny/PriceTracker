param(
    [string]$ComposeProjectName = "pricetracker",
    [string]$OutputCertPath = "./caddy-local-root.crt"
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Resolve-CaddyContainerName {
    param([string]$ProjectName)

    $exactName = "$ProjectName-caddy"
    $runningExact = docker ps --format "{{.Names}}" | Select-String -SimpleMatch -Pattern $exactName
    if ($runningExact) {
        return $exactName
    }

    $runningAny = docker ps --format "{{.Names}}" | Select-String -Pattern "caddy"
    if ($runningAny) {
        return ($runningAny | Select-Object -First 1).ToString().Trim()
    }

    return $null
}

Write-Step "Verificando Docker y contenedor de Caddy"
$dockerVersion = docker --version
if (-not $dockerVersion) {
    throw "Docker no esta disponible en esta terminal."
}

$containerName = Resolve-CaddyContainerName -ProjectName $ComposeProjectName
if (-not $containerName) {
    Write-Host "No se encontro Caddy activo. Intentando levantarlo con docker compose..." -ForegroundColor Yellow
    docker compose up -d caddy | Out-Host
    Start-Sleep -Seconds 2
    $containerName = Resolve-CaddyContainerName -ProjectName $ComposeProjectName
}

if (-not $containerName) {
    throw "No fue posible encontrar el contenedor de Caddy. Ejecuta 'docker compose up -d caddy' y vuelve a intentar."
}

Write-Host "Contenedor detectado: $containerName" -ForegroundColor Green

$sourceCertPath = "/data/caddy/pki/authorities/local/root.crt"
$resolvedOutputPath = (Resolve-Path (Split-Path -Parent $OutputCertPath) -ErrorAction SilentlyContinue)
if (-not $resolvedOutputPath) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $OutputCertPath) -Force | Out-Null
}

Write-Step "Extrayendo certificado raiz de Caddy"
docker cp "${containerName}:${sourceCertPath}" "$OutputCertPath" | Out-Host

if (-not (Test-Path $OutputCertPath)) {
    throw "No se pudo extraer el certificado en $OutputCertPath"
}

Write-Step "Instalando certificado en Trusted Root (CurrentUser)"
$certutilOutput = certutil -user -addstore Root "$OutputCertPath" 2>&1
$certutilOutput | Out-Host

if ($LASTEXITCODE -ne 0) {
    throw "Fallo certutil al importar el certificado."
}

Write-Step "Validando endpoint HTTPS"
try {
    $status = (Invoke-WebRequest -Uri "https://localhost:8443/ws/info" -UseBasicParsing -TimeoutSec 12).StatusCode
    Write-Host "OK: https://localhost:8443/ws/info responde $status" -ForegroundColor Green
}
catch {
    Write-Host "No se pudo validar /ws/info automaticamente. Revisa manualmente en el navegador." -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Yellow
}

Write-Host "`nListo. Si Chrome estaba abierto, recarga la extension y vuelve a probar." -ForegroundColor Green