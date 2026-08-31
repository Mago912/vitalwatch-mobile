param(
  [ValidateSet('build', 'baseline-build', 'ports', 'upload', 'monitor', 'tft-build', 'tft-upload')]
  [string]$Action = 'build',
  [string]$Port,
  [string]$Fqbn = 'esp32:esp32:esp32'
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$arduinoCli = Join-Path $projectRoot '.tools\arduino-cli\arduino-cli.exe'
$arduinoConfig = Join-Path $projectRoot '.arduino\arduino-cli.yaml'
$sketchDirectory = Join-Path $projectRoot 'esp32\VitalWatch_FW_0_9_0'
$baselineDirectory = Join-Path $projectRoot 'esp32\VitalWatch_FW_0_5_0'
$tftTestDirectory = Join-Path $projectRoot 'esp32\tft_test'
$deviceConfig = Join-Path $sketchDirectory 'vitalwatch_config.h'
$buildDirectory = Join-Path $projectRoot '.arduino\build\vitalwatch-0.9.0'
$baselineBuildDirectory = Join-Path $projectRoot '.arduino\build\fw-0.5.0'
$tftBuildDirectory = Join-Path $projectRoot '.arduino\build\tft-test'

function Invoke-ArduinoCli {
  param([string[]]$Arguments)

  & $arduinoCli --config-file $arduinoConfig @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Arduino CLI termino con el codigo $LASTEXITCODE."
  }
}

function Assert-ToolsInstalled {
  if (-not (Test-Path -LiteralPath $arduinoCli)) {
    throw 'No se encontro Arduino CLI en .tools/arduino-cli.'
  }

  if (-not (Test-Path -LiteralPath $arduinoConfig)) {
    throw 'No se encontro la configuracion local de Arduino CLI.'
  }
}

function Assert-DeviceConfigured {
  if (-not (Test-Path -LiteralPath $deviceConfig)) {
    throw 'Falta esp32/VitalWatch_FW_0_9_0/vitalwatch_config.h.'
  }

  $content = Get-Content -Raw -LiteralPath $deviceConfig
  $requiredValues = @('SUPABASE_URL', 'SUPABASE_KEY', 'DEVICE_CODE', 'DEVICE_TOKEN')

  foreach ($name in $requiredValues) {
    $match = [regex]::Match(
      $content,
      "const\s+char\*\s+$name\s*=\s*`"([^`"]*)`""
    )
    if (-not $match.Success) {
      throw "No se encontro $name en vitalwatch_config.h."
    }

    $value = $match.Groups[1].Value
    $isPending = [string]::IsNullOrWhiteSpace($value) -or $value -match (
      '^(TU_|YOUR_|CAMBIAR|REEMPLAZAR)'
    )
    if ($isPending) {
      throw "Completa $name en vitalwatch_config.h antes de cargar la placa."
    }
  }
}

function Resolve-DevicePort {
  if (-not [string]::IsNullOrWhiteSpace($Port)) {
    return $Port
  }

  $json = & $arduinoCli --config-file $arduinoConfig board list --format json
  if ($LASTEXITCODE -ne 0) {
    throw 'No se pudieron consultar los puertos USB.'
  }

  $boardList = $json | ConvertFrom-Json
  $candidatePorts = @(
    $boardList.detected_ports |
      ForEach-Object { $_.port.address } |
      Where-Object { $_ -and $_ -ne 'COM1' }
  )

  if ($candidatePorts.Count -eq 1) {
    Write-Host "Puerto detectado automaticamente: $($candidatePorts[0])"
    return $candidatePorts[0]
  }

  if ($candidatePorts.Count -eq 0) {
    throw 'No se detecto el ESP32 por USB. Conectalo y ejecuta npm run firmware:ports.'
  }

  throw 'Hay varios puertos disponibles. Indica uno con -Port COM3.'
}

function Build-Sketch {
  param(
    [string]$Sketch,
    [string]$OutputDirectory
  )

  Invoke-ArduinoCli @(
    'compile',
    '--fqbn', $Fqbn,
    '--output-dir', $OutputDirectory,
    $Sketch
  )
}

function Upload-Build {
  param(
    [string]$DevicePort,
    [string]$InputDirectory
  )

  Invoke-ArduinoCli @(
    'upload',
    '--port', $DevicePort,
    '--fqbn', $Fqbn,
    '--input-dir', $InputDirectory
  )
}

try {
  Assert-ToolsInstalled

  switch ($Action) {
  'build' {
    Build-Sketch -Sketch $sketchDirectory -OutputDirectory $buildDirectory
  }
  'baseline-build' {
    Build-Sketch -Sketch $baselineDirectory -OutputDirectory $baselineBuildDirectory
  }
  'ports' {
    Invoke-ArduinoCli @('board', 'list')
  }
  'upload' {
    Assert-DeviceConfigured
    $devicePort = Resolve-DevicePort
    Build-Sketch -Sketch $sketchDirectory -OutputDirectory $buildDirectory
    Upload-Build -DevicePort $devicePort -InputDirectory $buildDirectory
  }
  'monitor' {
    $devicePort = Resolve-DevicePort
    Invoke-ArduinoCli @(
      'monitor',
      '--port', $devicePort,
      '--config', 'baudrate=115200'
    )
  }
  'tft-build' {
    Build-Sketch -Sketch $tftTestDirectory -OutputDirectory $tftBuildDirectory
  }
  'tft-upload' {
    $devicePort = Resolve-DevicePort
    Build-Sketch -Sketch $tftTestDirectory -OutputDirectory $tftBuildDirectory
    Upload-Build -DevicePort $devicePort -InputDirectory $tftBuildDirectory
  }
  }
} catch {
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
