param([string]$Ssid)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $projectRoot 'esp32\VitalWatch_FW_0_9_0\vitalwatch_config.h'
$examplePath = Join-Path $projectRoot 'esp32\VitalWatch_FW_0_9_0\vitalwatch_config.example.h'

function ConvertTo-CppString {
  param([string]$Value)

  return $Value.Replace('\', '\\').Replace('"', '\"')
}

function Get-CurrentWifiName {
  $interfaces = netsh wlan show interfaces
  $ssidLine = $interfaces | Where-Object { $_ -match '^\s*SSID\s*:\s*(.+)$' } | Select-Object -First 1

  if ($ssidLine -match '^\s*SSID\s*:\s*(.+)$') {
    return $Matches[1].Trim()
  }

  return $null
}

if (-not (Test-Path -LiteralPath $configPath)) {
  Copy-Item -LiteralPath $examplePath -Destination $configPath
}

if ([string]::IsNullOrWhiteSpace($Ssid)) {
  $currentSsid = Get-CurrentWifiName
  $prompt = if ($currentSsid) {
    "Nombre del WiFi [$currentSsid]"
  } else {
    'Nombre del WiFi'
  }

  $enteredSsid = Read-Host $prompt
  $Ssid = if ([string]::IsNullOrWhiteSpace($enteredSsid)) { $currentSsid } else { $enteredSsid }
}

if ([string]::IsNullOrWhiteSpace($Ssid)) {
  throw 'El nombre del WiFi no puede quedar vacio.'
}

$securePassword = Read-Host 'Contrasena del WiFi (no se mostrara)' -AsSecureString
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)

try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  if ([string]::IsNullOrWhiteSpace($plainPassword)) {
    throw 'La contrasena del WiFi no puede quedar vacia.'
  }

  $content = Get-Content -Raw -LiteralPath $configPath
  $escapedSsid = ConvertTo-CppString $Ssid
  $escapedPassword = ConvertTo-CppString $plainPassword
  $content = [regex]::Replace(
    $content,
    'const\s+char\*\s+WIFI_SSID\s*=\s*"[^"]*";',
    "const char* WIFI_SSID = `"$escapedSsid`";"
  )
  $content = [regex]::Replace(
    $content,
    'const\s+char\*\s+WIFI_PASSWORD\s*=\s*"[^"]*";',
    "const char* WIFI_PASSWORD = `"$escapedPassword`";"
  )
  $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($configPath, $content, $utf8WithoutBom)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  $plainPassword = $null
}

Write-Host "WiFi de respaldo '$Ssid' configurado. La red principal tambien puede cargarse desde el portal del ESP32."
