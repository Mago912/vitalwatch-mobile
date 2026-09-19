$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourceConfigs = @(
  (Join-Path $projectRoot 'esp32\VitalWatch_FW_0_9_0\vitalwatch_config.h'),
  (Join-Path $projectRoot 'esp32\VitalWatch_FW_0_8_0\vitalwatch_config.h'),
  (Join-Path $projectRoot 'esp32\VitalWatch_FW_0_7_0\vitalwatch_config.h')
)
$targetConfig = Join-Path $projectRoot 'esp32\VitalWatch_FW_0_9_1\vitalwatch_config.h'
$exampleConfig = Join-Path $projectRoot 'esp32\VitalWatch_FW_0_9_1\vitalwatch_config.example.h'
$setupScript = Join-Path $PSScriptRoot 'esp32-setup.ps1'
$firmwareScript = Join-Path $PSScriptRoot 'esp32-firmware.ps1'
$migrationDirectory = Join-Path $projectRoot 'supabase\migrations'
$legacyMigrationDirectory = Join-Path $projectRoot 'supabase\migrations_legacy_local'

# Algunas copias antiguas tienen las mismas migraciones con otra fecha. Se
# apartan para que Supabase CLI no intente ejecutar dos veces el mismo SQL.
$legacyMigrationNames = @(
  '20260805005311_remote_push_notifications.sql',
  '20260805011020_restrict_push_token_client_access.sql',
  '20260825090000_secure_auth_and_device_pairing.sql',
  '20260825093000_restore_service_role_privileges.sql',
  '20260825100000_harden_pairing_and_add_indexes.sql'
)

New-Item -ItemType Directory -Force -Path $legacyMigrationDirectory | Out-Null
foreach ($migrationName in $legacyMigrationNames) {
  $activeMigration = Join-Path $migrationDirectory $migrationName
  $archivedMigration = Join-Path $legacyMigrationDirectory $migrationName
  if (-not (Test-Path -LiteralPath $activeMigration)) { continue }

  if (Test-Path -LiteralPath $archivedMigration) {
    $activeSql = ((Get-Content -Raw -LiteralPath $activeMigration) -replace '\s', '').Trim(';')
    $archivedSql = ((Get-Content -Raw -LiteralPath $archivedMigration) -replace '\s', '').Trim(';')
    if ($activeSql -cne $archivedSql) {
      throw "La migracion antigua $migrationName tiene cambios propios. Revisala manualmente."
    }
    Remove-Item -LiteralPath $activeMigration -Force
  } else {
    Move-Item -LiteralPath $activeMigration -Destination $archivedMigration
  }
}

function Invoke-VitalWatchScript {
  param(
    [string]$Script,
    [string[]]$Arguments = @()
  )

  & powershell -NoProfile -ExecutionPolicy Bypass -File $Script @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "El script $([System.IO.Path]::GetFileName($Script)) termino con codigo $LASTEXITCODE."
  }
}

if (-not (Test-Path -LiteralPath $targetConfig)) {
  $sourceConfig = $sourceConfigs | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if ($sourceConfig) {
    Copy-Item -LiteralPath $sourceConfig -Destination $targetConfig
    $sourceVersion = Split-Path -Leaf (Split-Path -Parent $sourceConfig)
    Write-Host "Configuracion privada migrada de $sourceVersion a 0.9.1."
  } elseif (Test-Path -LiteralPath $exampleConfig) {
    Copy-Item -LiteralPath $exampleConfig -Destination $targetConfig
    Write-Warning (
      'No se encontro la configuracion de 0.9.0, 0.8.0 ni 0.7.0. Se creo una plantilla; ' +
      'completa Supabase y DEVICE_TOKEN antes de cargar la placa.'
    )
  } else {
    throw 'No se encontro vitalwatch_config.example.h para firmware 0.9.1.'
  }
} else {
  Write-Host 'Se conserva vitalwatch_config.h existente de firmware 0.9.1.'
}

Write-Host 'Preparando Arduino CLI y rutas para esta computadora...'
Invoke-VitalWatchScript -Script $setupScript

Write-Host 'Compilando VitalWatch FW 0.9.1...'
Invoke-VitalWatchScript -Script $firmwareScript -Arguments @('-Action', 'build')

Write-Host ''
Write-Host 'VitalWatch FW 0.9.1 esta preparado en esta computadora.' -ForegroundColor Green
Write-Host 'Conecta el ESP32 y ejecuta:'
Write-Host '  npm run firmware:ports'
Write-Host '  npm run firmware:upload'
Write-Host '  npm run firmware:monitor'
