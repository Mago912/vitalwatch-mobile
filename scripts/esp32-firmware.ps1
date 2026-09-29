param(
  [ValidateSet('build', 'stable-build', 'stable-upload', 'baseline-build', 'bio-build', 'bio-upload', 'bio-research-build', 'bio-research-upload', 'bio-replay-build', 'bio-replay-upload', 'biosys-build', 'biosys-upload', 'biosys-research-build', 'biosys-research-upload', 'biosys-replay-build', 'biosys-replay-upload', 'biosys-compare-build', 'biosys-compare-upload', 'ports', 'upload', 'monitor', 'tft-build', 'tft-upload')]
  [string]$Action = 'build',
  [string]$Port,
  [string]$Fqbn = 'esp32:esp32:esp32',
  [ValidateSet('1.0.21', '1.0.22', '1.0.23')]
  [string]$BiosysVersion = '1.0.21'
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$arduinoCli = Join-Path $projectRoot '.tools\arduino-cli\arduino-cli.exe'
$arduinoConfig = Join-Path $projectRoot '.arduino\arduino-cli.yaml'
$sketchDirectory = Join-Path $projectRoot 'esp32\VitalWatch_FW_0_9_1'
$stableDirectory = Join-Path $projectRoot 'esp32\VitalWatch_FW_0_9_0'
$baselineDirectory = Join-Path $projectRoot 'esp32\VitalWatch_FW_0_5_0'
$bioDirectory = Join-Path $projectRoot 'esp32\VitalWatch_BIO_0_6_0'
$biosysSketchName = 'VitalWatch_BIOSYS_' + $BiosysVersion.Replace('.', '_')
$biosysDirectory = Join-Path $projectRoot ('esp32\' + $biosysSketchName)
$tftTestDirectory = Join-Path $projectRoot 'esp32\tft_test'
$deviceConfig = Join-Path $sketchDirectory 'vitalwatch_config.h'
$stableDeviceConfig = Join-Path $stableDirectory 'vitalwatch_config.h'
$buildDirectory = Join-Path $projectRoot '.arduino\build\vitalwatch-0.9.1'
$stableBuildDirectory = Join-Path $projectRoot '.arduino\build\vitalwatch-0.9.0'
$baselineBuildDirectory = Join-Path $projectRoot '.arduino\build\fw-0.5.0'
$bioBuildDirectory = Join-Path $projectRoot '.arduino\build\bio-0.6.0'
$bioResearchBuildDirectory = Join-Path $projectRoot '.arduino\build\bio-0.6.0-research'
$bioReplayBuildDirectory = Join-Path $projectRoot '.arduino\build\bio-0.6.0-replay'
$biosysBuildDirectory = Join-Path $projectRoot ('.arduino\build\biosys-' + $BiosysVersion)
$biosysResearchBuildDirectory = "$biosysBuildDirectory-research"
$biosysReplayBuildDirectory = "$biosysBuildDirectory-replay"
$biosysCompareBuildDirectory = "$biosysBuildDirectory-hrpair"
$tftBuildDirectory = Join-Path $projectRoot '.arduino\build\tft-test'

function Invoke-ArduinoCli {
  param([string[]]$Arguments)

  # El YAML copiado de otra PC puede contener otra letra de unidad.
  # Las variables solo afectan esta ejecucion; no modificamos la configuracion global.
  $portableDirectories = @{
    ARDUINO_DIRECTORIES_DATA = Join-Path $projectRoot '.arduino\data'
    ARDUINO_DIRECTORIES_DOWNLOADS = Join-Path $projectRoot '.arduino\downloads'
    ARDUINO_DIRECTORIES_USER = Join-Path $projectRoot '.arduino\user'
  }
  $previousEnvironment = @{}
  foreach ($name in $portableDirectories.Keys) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
  }
  try {
    foreach ($name in $portableDirectories.Keys) {
      [Environment]::SetEnvironmentVariable($name, $portableDirectories[$name], 'Process')
    }
    & $arduinoCli --config-file $arduinoConfig @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "Arduino CLI termino con el codigo $LASTEXITCODE."
    }
  } finally {
    foreach ($name in $portableDirectories.Keys) {
      [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process')
    }
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
  param([string]$ConfigPath)

  if (-not (Test-Path -LiteralPath $ConfigPath)) {
    throw "Falta $ConfigPath."
  }

  $content = Get-Content -Raw -LiteralPath $ConfigPath
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

  $json = Invoke-ArduinoCli @('board', 'list', '--format', 'json')

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
    [string]$OutputDirectory,
    [string]$Defines = ''
  )

  # Mantiene los temporales dentro del proyecto. Evita depender del perfil de
  # Windows que haya instalado Codex/Arduino CLI en otra PC.
  $arguments = @(
    'compile',
    '--fqbn', $Fqbn,
    '--build-path', "$OutputDirectory-work",
    '--output-dir', $OutputDirectory,
    $Sketch
  )

  if (-not [string]::IsNullOrWhiteSpace($Defines)) {
    $arguments = @(
      'compile',
      '--fqbn', $Fqbn,
      '--build-property', "compiler.cpp.extra_flags=$Defines",
      '--build-property', "compiler.c.extra_flags=$Defines",
      '--build-path', "$OutputDirectory-work",
      '--output-dir', $OutputDirectory,
      $Sketch
    )
  }

  Invoke-ArduinoCli $arguments
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
    # Esta placa/cable perdio la conexion al 15,2 % usando 921600. La carga a
    # 115200 es mas lenta, pero completo escritura y verificacion de hash.
    '--upload-property', 'upload.speed=57600',
    '--input-dir', $InputDirectory
  )
}

try {
  Assert-ToolsInstalled

  switch ($Action) {
  'build' {
    Build-Sketch -Sketch $sketchDirectory -OutputDirectory $buildDirectory
  }
  'stable-build' {
    Build-Sketch -Sketch $stableDirectory -OutputDirectory $stableBuildDirectory
  }
  'stable-upload' {
    Assert-DeviceConfigured -ConfigPath $stableDeviceConfig
    $devicePort = Resolve-DevicePort
    Build-Sketch -Sketch $stableDirectory -OutputDirectory $stableBuildDirectory
    Upload-Build -DevicePort $devicePort -InputDirectory $stableBuildDirectory
  }
  'baseline-build' {
    Build-Sketch -Sketch $baselineDirectory -OutputDirectory $baselineBuildDirectory
  }
  'bio-build' {
    Build-Sketch -Sketch $bioDirectory -OutputDirectory $bioBuildDirectory
  }
  'bio-upload' {
    $devicePort = Resolve-DevicePort
    Build-Sketch -Sketch $bioDirectory -OutputDirectory $bioBuildDirectory
    Upload-Build -DevicePort $devicePort -InputDirectory $bioBuildDirectory
  }
  'bio-research-build' {
    Build-Sketch -Sketch $bioDirectory -OutputDirectory $bioResearchBuildDirectory -Defines '-DBIO_RESEARCH_MODE=1'
  }
  'bio-research-upload' {
    $devicePort = Resolve-DevicePort
    Build-Sketch -Sketch $bioDirectory -OutputDirectory $bioResearchBuildDirectory -Defines '-DBIO_RESEARCH_MODE=1'
    Upload-Build -DevicePort $devicePort -InputDirectory $bioResearchBuildDirectory
  }
  'bio-replay-build' {
    Build-Sketch -Sketch $bioDirectory -OutputDirectory $bioReplayBuildDirectory -Defines '-DBIO_RESEARCH_MODE=1 -DBIO_REPLAY_MODE=1'
  }
  'bio-replay-upload' {
    $devicePort = Resolve-DevicePort
    Build-Sketch -Sketch $bioDirectory -OutputDirectory $bioReplayBuildDirectory -Defines '-DBIO_RESEARCH_MODE=1 -DBIO_REPLAY_MODE=1'
    Upload-Build -DevicePort $devicePort -InputDirectory $bioReplayBuildDirectory
  }
  'biosys-build' {
    Build-Sketch -Sketch $biosysDirectory -OutputDirectory $biosysBuildDirectory
  }
  'biosys-upload' {
    Assert-DeviceConfigured -ConfigPath (Join-Path $biosysDirectory 'vitalwatch_config.h')
    $devicePort = Resolve-DevicePort
    Build-Sketch -Sketch $biosysDirectory -OutputDirectory $biosysBuildDirectory
    Upload-Build -DevicePort $devicePort -InputDirectory $biosysBuildDirectory
  }
  'biosys-compare-build' {
    Build-Sketch -Sketch $biosysDirectory -OutputDirectory $biosysCompareBuildDirectory -Defines '-DBIO_COMPARE_MODE=1 -DBIO_RESEARCH_MODE=0 -DBIO_REPLAY_MODE=0'
    # Local build receipt: upload verifies these files without recompiling while BOOT is held.
    $receiptFiles = @()
    $receiptFiles += @(Get-ChildItem -LiteralPath $biosysDirectory -File | Where-Object { $_.Extension -in '.ino', '.h', '.cpp' })
    $receiptFiles += @(Get-ChildItem -LiteralPath $biosysCompareBuildDirectory -File -Filter '*.bin')
    $receipt = @($receiptFiles | ForEach-Object {
      [ordered]@{ path = $_.FullName; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
    })
    $receiptPath = Join-Path $biosysCompareBuildDirectory 'HRPAIR_BUILD.json'
    [IO.File]::WriteAllText($receiptPath, (ConvertTo-Json -InputObject $receipt -Depth 3), [Text.UTF8Encoding]::new($false))
  }
  'biosys-compare-upload' {
    Assert-DeviceConfigured -ConfigPath (Join-Path $biosysDirectory 'vitalwatch_config.h')
    $receiptPath = Join-Path $biosysCompareBuildDirectory 'HRPAIR_BUILD.json'
    if (-not (Test-Path -LiteralPath $receiptPath)) { throw 'Primero compila con biosys-compare-build.' }
    # Windows PowerShell 5.1 emits a JSON array as one pipeline object.
    # Direct assignment preserves its entries instead of nesting the array.
    $receipt = Get-Content -Raw -LiteralPath $receiptPath | ConvertFrom-Json
    $mainBin = Join-Path $biosysCompareBuildDirectory ($biosysSketchName + '.ino.bin')
    if (-not ($receipt | Where-Object { $_.path -eq $mainBin })) { throw 'Recibo sin binario principal.' }
    foreach ($entry in $receipt) {
      if (-not (Test-Path -LiteralPath $entry.path) -or (Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash -ne $entry.sha256) {
        throw 'Cambio una fuente o un binario desde la compilacion HRPAIR. Vuelve a compilar.'
      }
    }
    $devicePort = Resolve-DevicePort
    Upload-Build -DevicePort $devicePort -InputDirectory $biosysCompareBuildDirectory
  }
  'biosys-research-build' {
    Build-Sketch -Sketch $biosysDirectory -OutputDirectory $biosysResearchBuildDirectory -Defines '-DBIO_RESEARCH_MODE=1'
  }
  'biosys-research-upload' {
    Assert-DeviceConfigured -ConfigPath (Join-Path $biosysDirectory 'vitalwatch_config.h')
    $devicePort = Resolve-DevicePort
    Build-Sketch -Sketch $biosysDirectory -OutputDirectory $biosysResearchBuildDirectory -Defines '-DBIO_RESEARCH_MODE=1'
    Upload-Build -DevicePort $devicePort -InputDirectory $biosysResearchBuildDirectory
  }
  'biosys-replay-build' {
    Build-Sketch -Sketch $biosysDirectory -OutputDirectory $biosysReplayBuildDirectory -Defines '-DBIO_REPLAY_MODE=1 -DBIO_RESEARCH_MODE=0'
  }
  'biosys-replay-upload' {
    $devicePort = Resolve-DevicePort
    Build-Sketch -Sketch $biosysDirectory -OutputDirectory $biosysReplayBuildDirectory -Defines '-DBIO_REPLAY_MODE=1 -DBIO_RESEARCH_MODE=0'
    Upload-Build -DevicePort $devicePort -InputDirectory $biosysReplayBuildDirectory
  }
  'ports' {
    Invoke-ArduinoCli @('board', 'list')
  }
  'upload' {
    Assert-DeviceConfigured -ConfigPath $deviceConfig
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
