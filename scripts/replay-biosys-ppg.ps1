param(
  [Parameter(Mandatory = $true)]
  [string]$Port,
  [Parameter(Mandatory = $true)]
  [string]$InputCsv,
  [bool]$ExpectValid = $true,
  [string]$OutputPath,
  [int]$BaudRate = 115200,
  [int]$TimeoutSeconds = 45
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedInput = (Resolve-Path -LiteralPath $InputCsv).Path
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $OutputPath = Join-Path $projectRoot "measurements\biosys-1.0.16\$stamp-replay.log"
} elseif (-not [System.IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath = Join-Path $projectRoot $OutputPath
}

$rows = @(Import-Csv -LiteralPath $resolvedInput | Where-Object {
  -not $_.PSObject.Properties['type'] -or $_.type -eq 'PPG'
})
if ($rows.Count -eq 0) {
  throw "El CSV no contiene filas PPG: $resolvedInput"
}

$requiredColumns = @(
  'sample_index', 'sample_time_us', 'red_raw', 'ir_raw',
  'mpu_window_delta_g', 'mpu_window_gyro_rad_s', 'mpu_saturated'
)
foreach ($column in $requiredColumns) {
  if (-not $rows[0].PSObject.Properties[$column]) {
    throw "Falta la columna obligatoria '$column' en $resolvedInput."
  }
}
if (-not $rows[0].PSObject.Properties['timing_valid'] -and
    -not $rows[0].PSObject.Properties['missing_samples']) {
  throw "El CSV debe incluir timing_valid o missing_samples."
}

$serial = [System.IO.Ports.SerialPort]::new($Port, $BaudRate, 'None', 8, 'One')
$serial.NewLine = "`n"
$serial.ReadTimeout = 250
$serial.WriteTimeout = 5000
$serial.DtrEnable = $false
$serial.RtsEnable = $false
$log = [System.Collections.Generic.List[string]]::new()

function Read-Until {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Predicate,
    [Parameter(Mandatory = $true)]
    [datetime]$Deadline
  )

  while ((Get-Date) -lt $Deadline) {
    try {
      $line = $serial.ReadLine().Trim()
      if ($line.Length -eq 0) { continue }
      $log.Add($line)
      Write-Host $line
      if (& $Predicate $line) { return $line }
    } catch [System.TimeoutException] {
      continue
    }
  }
  return $null
}

try {
  $serial.Open()
  Start-Sleep -Milliseconds 1200
  $serial.DiscardInBuffer()
  $serial.WriteLine('RESET')

  $reset = Read-Until -Deadline (Get-Date).AddSeconds(10) -Predicate {
    param($line) $line -eq '[REPLAY] RESET_OK'
  }
  if (-not $reset) {
    throw 'El firmware no confirmo RESET. Verifica que BIOSYS replay este cargado.'
  }

  $sent = 0
  foreach ($row in $rows) {
    $timingValid = if ($row.PSObject.Properties['timing_valid']) {
      if ([int]$row.timing_valid -eq 0) { '0' } else { '1' }
    } else {
      if ([int]$row.missing_samples -eq 0) { '1' } else { '0' }
    }
    $fields = @(
      $row.sample_index,
      $row.sample_time_us,
      $row.red_raw,
      $row.ir_raw,
      $timingValid,
      $row.mpu_window_delta_g,
      $row.mpu_window_gyro_rad_s,
      $row.mpu_saturated
    )
    if ($fields | Where-Object { [string]::IsNullOrWhiteSpace([string]$_) }) {
      throw "Fila PPG incompleta en el indice $sent."
    }
    $serial.WriteLine(($fields -join ','))
    ++$sent
    if (($sent % 32) -eq 0) { Start-Sleep -Milliseconds 20 }
  }

  $serial.WriteLine('END')
  $resultLine = Read-Until -Deadline (Get-Date).AddSeconds($TimeoutSeconds) -Predicate {
    param($line) $line.StartsWith('[REPLAY_RESULT]')
  }
  if (-not $resultLine) {
    throw 'No se recibio REPLAY_RESULT antes del timeout.'
  }

  $pattern = '^\[REPLAY_RESULT\] rows=(\d+) rejected=(\d+) fused=(\d+) valid=(\d+) first_valid_us=(\d+) longest_valid_ms=(\d+) bpm_min=(nan|[-+]?\d+(?:\.\d+)?) bpm_max=(nan|[-+]?\d+(?:\.\d+)?)$'
  $match = [regex]::Match($resultLine, $pattern, 'IgnoreCase')
  if (-not $match.Success) { throw "REPLAY_RESULT malformado: $resultLine" }
  $accepted = [uint32]$match.Groups[1].Value
  $rejected = [uint32]$match.Groups[2].Value
  $valid = [uint32]$match.Groups[4].Value
  if ($accepted -ne $sent) { throw "Firmware acepto $accepted de $sent filas enviadas." }
  if ($rejected -ne 0) { throw "Firmware rechazo $rejected filas." }
  if ($ExpectValid -and $valid -eq 0) { throw 'Se esperaba FC valida y el replay produjo valid=0.' }
  if (-not $ExpectValid -and $valid -ne 0) { throw "Se esperaba reproducir valid=0 y se obtuvo valid=$valid." }

  $outputDirectory = Split-Path -Parent $OutputPath
  [System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null
  [System.IO.File]::WriteAllLines($OutputPath, $log)
  Write-Host "Replay verificado: $resultLine"
  Write-Host "Evidencia: $OutputPath"
} finally {
  if ($serial.IsOpen) { $serial.Close() }
  $serial.Dispose()
}
