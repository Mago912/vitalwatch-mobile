$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$encryptedTokenPath = Join-Path $workspaceRoot '.tools\supabase-token-vitalwatch.clixml'
$projectRef = 'sehuynlvfvgfhelqpbrx'

Set-Location -LiteralPath $workspaceRoot

Write-Host 'Token cifrado para desplegar VitalWatch' -ForegroundColor Cyan
Write-Host 'Pega el token personal de Supabase. No se mostrara mientras escribes.'
Write-Host 'Se guardara cifrado con DPAPI para este usuario de Windows.'
Write-Host ''

$secureToken = Read-Host 'Token personal' -AsSecureString
$credential = [System.Management.Automation.PSCredential]::new('supabase', $secureToken)
$accessToken = $credential.GetNetworkCredential().Password

if ([string]::IsNullOrWhiteSpace($accessToken)) {
  Write-Host 'No se ingreso ningun token.' -ForegroundColor Red
  return
}

try {
  $headers = @{ Authorization = "Bearer $accessToken" }
  $projects = Invoke-RestMethod `
    -Headers $headers `
    -Uri 'https://api.supabase.com/v1/projects'

  if (-not ($projects | Where-Object { $_.ref -eq $projectRef })) {
    throw "El token no tiene acceso al proyecto Vitalwatch $projectRef."
  }

  $secureToken | Export-Clixml -LiteralPath $encryptedTokenPath
  Write-Host ''
  Write-Host 'Token verificado y guardado cifrado correctamente.' -ForegroundColor Green
  Write-Host 'Regresa al chat y escribe: token listo' -ForegroundColor Green
} finally {
  $accessToken = $null
  $credential = $null
  $secureToken.Dispose()
}
