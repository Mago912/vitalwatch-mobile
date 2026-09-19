$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$encryptedPasswordPath = Join-Path $workspaceRoot '.tools\supabase-db-password-vitalwatch.clixml'

Set-Location -LiteralPath $workspaceRoot

Write-Host 'Contrasena de Postgres para migrar VitalWatch' -ForegroundColor Cyan
Write-Host 'Introduce la contrasena de base de datos del proyecto Vitalwatch.'
Write-Host 'No se mostrara mientras escribes y se guardara cifrada con DPAPI.'
Write-Host 'Si no la recuerdas, usa Database password en la pagina abierta.'
Write-Host ''

Start-Process 'https://supabase.com/dashboard/project/sehuynlvfvgfhelqpbrx/settings/database'
$securePassword = Read-Host 'Contrasena de Postgres' -AsSecureString
$credential = [System.Management.Automation.PSCredential]::new('postgres', $securePassword)
$databasePassword = $credential.GetNetworkCredential().Password

if ([string]::IsNullOrWhiteSpace($databasePassword)) {
  Write-Host 'No se ingreso ninguna contrasena.' -ForegroundColor Red
  return
}

try {
  $securePassword | Export-Clixml -LiteralPath $encryptedPasswordPath
  Write-Host ''
  Write-Host 'Contrasena guardada cifrada correctamente.' -ForegroundColor Green
  Write-Host 'Regresa al chat y escribe: db lista' -ForegroundColor Green
} finally {
  $databasePassword = $null
  $credential = $null
  $securePassword.Dispose()
}
