$ErrorActionPreference = 'Stop'

$arduinoCliVersion = '1.5.1'
$arduinoCliSha256 = 'fabe42e0eb04d00e776a66178299ff95a46c623dbc260f997e58fd514853dd40'
$esp32CoreVersion = '3.3.11'

$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsDirectory = Join-Path $projectRoot '.tools\arduino-cli'
$arduinoDirectory = Join-Path $projectRoot '.arduino'
$arduinoCli = Join-Path $toolsDirectory 'arduino-cli.exe'
$archivePath = Join-Path $toolsDirectory 'arduino-cli.zip'
$arduinoConfig = Join-Path $arduinoDirectory 'arduino-cli.yaml'

function Invoke-ArduinoCli {
  param([string[]]$Arguments)

  & $arduinoCli --config-file $arduinoConfig @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Arduino CLI termino con el codigo $LASTEXITCODE."
  }
}

New-Item -ItemType Directory -Force -Path $toolsDirectory | Out-Null
New-Item -ItemType Directory -Force -Path (
  (Join-Path $arduinoDirectory 'data'),
  (Join-Path $arduinoDirectory 'downloads'),
  (Join-Path $arduinoDirectory 'user')
) | Out-Null

if (-not (Test-Path -LiteralPath $arduinoCli)) {
  $downloadUrl = (
    "https://github.com/arduino/arduino-cli/releases/download/v$arduinoCliVersion/" +
    "arduino-cli_${arduinoCliVersion}_Windows_64bit.zip"
  )

  Write-Host "Descargando Arduino CLI $arduinoCliVersion..."
  Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $archivePath

  $downloadedHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLower()
  if ($downloadedHash -ne $arduinoCliSha256) {
    throw 'El checksum de Arduino CLI no coincide con el publicado oficialmente.'
  }

  Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsDirectory -Force
}

$portableRoot = $projectRoot.Replace('\', '/')
$configContent = @"
board_manager:
  additional_urls:
    - https://espressif.github.io/arduino-esp32/package_esp32_index.json
directories:
  data: $portableRoot/.arduino/data
  downloads: $portableRoot/.arduino/downloads
  user: $portableRoot/.arduino/user
updater:
  enable_notification: false
"@
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($arduinoConfig, $configContent, $utf8WithoutBom)

Write-Host "Instalando el nucleo ESP32 $esp32CoreVersion..."
Invoke-ArduinoCli @('core', 'update-index')
Invoke-ArduinoCli @('core', 'install', "esp32:esp32@$esp32CoreVersion")

Write-Host 'Instalando las bibliotecas del firmware...'
Invoke-ArduinoCli @(
  'lib', 'install',
  'ArduinoJson@7.4.3',
  'Adafruit GFX Library@1.12.6',
  'Adafruit ST7735 and ST7789 Library@1.11.0',
  'SparkFun MAX3010x Pulse and Proximity Sensor Library@1.1.2'
)

Write-Host 'Entorno Arduino listo. Ejecuta npm run firmware:build para comprobarlo.'
