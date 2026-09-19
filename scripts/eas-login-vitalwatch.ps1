$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$nodePath = Join-Path $workspaceRoot '.tools\node22\node-v22.23.1-win-x64\node.exe'
$easPath = Join-Path $workspaceRoot '.tools\eas-runner\node_modules\eas-cli\bin\run'

Set-Location -LiteralPath $workspaceRoot

if (-not (Test-Path -LiteralPath $nodePath) -or
    -not (Test-Path -LiteralPath $easPath)) {
  Write-Host 'No se encontraron las herramientas EAS preparadas para VitalWatch.' -ForegroundColor Red
  Write-Host 'Vuelve al chat para que Codex pueda repararlas.'
  return
}

Write-Host 'Inicio de sesion Expo/EAS para VitalWatch' -ForegroundColor Cyan
Write-Host 'La contrasena no mostrara caracteres mientras la escribes; es normal.'
Write-Host ''

& $nodePath $easPath login

if ($LASTEXITCODE -eq 0) {
  Write-Host ''
  Write-Host 'Sesion iniciada correctamente:' -ForegroundColor Green
  & $nodePath $easPath whoami
  Write-Host ''
  Write-Host 'Regresa al chat y escribe: listo' -ForegroundColor Green
} else {
  Write-Host ''
  Write-Host 'No se pudo iniciar sesion. Revisa el mensaje anterior o vuelve al chat.' -ForegroundColor Red
}
