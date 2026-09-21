param(
  [Parameter(Mandatory = $true)]
  [string]$Port,
  [ValidateRange(10, 3600)]
  [int]$DurationSeconds = 90,
  [string]$Label = 'reposo-dedo'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$safeLabel = ($Label.Trim() -replace '[^a-zA-Z0-9_-]', '-').Trim('-')
if ([string]::IsNullOrWhiteSpace($safeLabel)) {
  $safeLabel = 'medicion'
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputDirectory = Join-Path $projectRoot 'measurements\biosys-1.0.9'
$csvPath = Join-Path $outputDirectory "$timestamp-$safeLabel.csv"
$metadataPath = Join-Path $outputDirectory "$timestamp-$safeLabel.json"
$csvHeader = 'type,session_id,sample_index,sample_time_us,processing_time_us,red_raw,ir_raw,ir_dc,ir_ac,ir_filtered,peak_custom,peak_sparkfun,peak_accepted,ibi_ms,bpm_instant,bpm_robust,hr_status,ppg_quality,ppg_quality_flags,spo2_result,spo2_status,spo2_quality,led_amplitude,sparkfun_check_count,sparkfun_available,hw_fifo_read_ptr,hw_fifo_write_ptr,hw_fifo_overflow,suspected_drops,missing_samples,mpu_time_us,ax_g,ay_g,az_g,acc_mag_g,gyro_mag_rad_s,mpu_dt_us,mpu_saturated,mpu_missed_deadlines,spo2_maxim,spo2_maxim_valid,spo2_custom_candidate,measurement_state,loop_last_us,loop_max_us,display_render_us,i2c_failures'

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$utf8 = [System.Text.UTF8Encoding]::new($false)
$writer = [System.IO.StreamWriter]::new($csvPath, $false, $utf8)
$serial = [System.IO.Ports.SerialPort]::new($Port, 115200, 'None', 8, 'One')
$serial.NewLine = "`n"
$serial.ReadTimeout = 500
$serial.DtrEnable = $false
$serial.RtsEnable = $false
$recordCount = 0
$startedAt = Get-Date

try {
  $writer.WriteLine($csvHeader)
  $serial.Open()
  Write-Host "Puerto $Port abierto. Esperando el reinicio del ESP32..."
  Start-Sleep -Seconds 2
  $serial.DiscardInBuffer()
  $captureStart = Get-Date
  Write-Host "Capturando $DurationSeconds segundos con etiqueta '$safeLabel'."

  while (((Get-Date) - $captureStart).TotalSeconds -lt $DurationSeconds) {
    try {
      $line = $serial.ReadLine().Trim()
      if ($line.StartsWith('PPG,')) {
        $writer.WriteLine($line)
        $recordCount++
        if ($recordCount % 250 -eq 0) {
          Write-Host "Registros PPG: $recordCount"
        }
      }
    } catch [System.TimeoutException] {
      # Un tiempo sin datos no cancela la sesion; puede ocurrir al retirar el dedo.
    }
  }
} finally {
  if ($serial.IsOpen) {
    $serial.Close()
  }
  $serial.Dispose()
  $writer.Dispose()
}

$metadata = [ordered]@{
  firmware = 'BIOSYS 1.0.9'
  mode = 'BIO_RESEARCH_MODE=1'
  label = $Label
  port = $Port
  baudRate = 115200
  requestedDurationSeconds = $DurationSeconds
  startedAt = $startedAt.ToString('o')
  finishedAt = (Get-Date).ToString('o')
  researchRecords = $recordCount
  csvFile = Split-Path -Leaf $csvPath
  note = 'Datos experimentales. No usar para diagnostico medico.'
}
[System.IO.File]::WriteAllText(
  $metadataPath,
  ($metadata | ConvertTo-Json -Depth 3),
  $utf8
)

Write-Host "Captura finalizada: $recordCount registros PPG + MPU."
Write-Host "CSV: $csvPath"
Write-Host "Metadatos: $metadataPath"

if ($recordCount -eq 0) {
  Write-Warning 'No se recibieron filas PPG. Confirma que cargaste el modo research y que el puerto es correcto.'
  exit 2
}
