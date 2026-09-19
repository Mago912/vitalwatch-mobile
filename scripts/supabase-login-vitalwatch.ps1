$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$supabasePath = Join-Path $workspaceRoot '.tools\supabase-cli-2.116.0\supabase.exe'

Set-Location -LiteralPath $workspaceRoot

if (-not (Test-Path -LiteralPath $supabasePath)) {
  Write-Host 'No se encontro Supabase CLI para VitalWatch.' -ForegroundColor Red
  Write-Host 'Vuelve al chat para que Codex pueda repararlo.'
  return
}

Write-Host 'Inicio de sesion Supabase para VitalWatch' -ForegroundColor Cyan
Write-Host 'El login automatico de Bun falla en esta version de Windows.'
Write-Host 'Se abrira la pagina oficial de tokens personales de Supabase.'
Write-Host 'Crea un token llamado VitalWatch-PC y pegalo aqui; se leera de forma oculta.'
Write-Host 'No compartas el token en el chat.'
Write-Host ''

Start-Process 'https://supabase.com/dashboard/account/tokens'
$secureToken = Read-Host 'Pega el token personal y pulsa Enter' -AsSecureString
$credential = [System.Management.Automation.PSCredential]::new('supabase', $secureToken)
$accessToken = $credential.GetNetworkCredential().Password

if ([string]::IsNullOrWhiteSpace($accessToken)) {
  Write-Host 'No se ingreso ningun token.' -ForegroundColor Red
  return
}

try {
  & $supabasePath login `
    --token $accessToken `
    --name 'VitalWatch-PC' `
    --agent no `
    --output-format text
} finally {
  $accessToken = $null
  $credential = $null
  $secureToken.Dispose()
}

if ($LASTEXITCODE -eq 0) {
  Write-Host ''
  Write-Host 'Sesion de Supabase iniciada correctamente.' -ForegroundColor Green
  Write-Host 'Regresa al chat y escribe: supabase listo' -ForegroundColor Green
} else {
  Write-Host ''
  Write-Host 'No se pudo iniciar sesion. Revisa el mensaje anterior o vuelve al chat.' -ForegroundColor Red
}
