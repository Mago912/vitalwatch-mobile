param(
  [Parameter(Mandatory = $true)]
  [string]$Port,
  [ValidateRange(10, 3600)]
  [int]$DurationSeconds = 90,
  [string]$Label = 'reposo-dedo',
  [ValidateSet(115200, 230400, 460800, 921600)]
  [int]$BaudRate = 460800
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$safeLabel = ($Label.Trim() -replace '[^a-zA-Z0-9_-]', '-').Trim('-')
if ([string]::IsNullOrWhiteSpace($safeLabel)) {
  $safeLabel = 'medicion'
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputDirectory = Join-Path $projectRoot 'measurements\biosys-1.0.17'
$csvPath = Join-Path $outputDirectory "$timestamp-$safeLabel.csv"
$metadataPath = Join-Path $outputDirectory "$timestamp-$safeLabel.json"
$csvHeader = 'type,session_id,sample_index,sample_time_us,processing_time_us,red_raw,ir_raw,ir_dc,ir_ac,ir_filtered,peak_custom,peak_sparkfun,peak_accepted,ibi_ms,bpm_instant,bpm_robust,hr_status,ppg_quality,ppg_quality_flags,spo2_result,spo2_status,spo2_quality,led_amplitude,sparkfun_check_count,sparkfun_available,hw_fifo_read_ptr,hw_fifo_write_ptr,hw_fifo_overflow,suspected_drops,missing_samples,mpu_time_us,ax_g,ay_g,az_g,acc_mag_g,gx_rad_s,gy_rad_s,gz_rad_s,gyro_mag_rad_s,mpu_window_peak_g,mpu_window_delta_g,mpu_window_gyro_rad_s,mpu_window_samples,mpu_dt_us,mpu_saturated,mpu_missed_deadlines,ppg_mod_ir_pct,ppg_mod_red_pct,ppg_ratio_r,spo2_maxim,spo2_maxim_valid,spo2_custom_candidate,maxim_hr,maxim_hr_valid,measurement_state,loop_last_us,loop_max_us,display_render_us,i2c_failures,red_prominence,red_threshold,red_snr,red_candidate,ir_prominence,ir_threshold,ir_snr,ir_candidate,peak_fused,detector_state,quarantine_remaining_ms,synchronized_count'
$expectedFieldCount = $csvHeader.Split(',').Count

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$utf8 = [System.Text.UTF8Encoding]::new($false)
$writer = [System.IO.StreamWriter]::new($csvPath, $false, $utf8)
$serial = [System.IO.Ports.SerialPort]::new($Port, $BaudRate, 'None', 8, 'One')
$serial.NewLine = "`n"
$serial.ReadTimeout = 500
$serial.DtrEnable = $false
$serial.RtsEnable = $false
$recordCount = 0
$invalidRecordCount = 0
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
        $fields = $line.Split(',')
        $validRecord = $fields.Count -eq $expectedFieldCount

        # Todos los campos posteriores a "PPG" deben ser numeros o NaN.
        # Esto descarta mensajes de diagnostico que se mezclen en una fila serial.
        if ($validRecord) {
          for ($index = 1; $index -lt $fields.Count; $index++) {
            if ($fields[$index] -ieq 'nan') {
              continue
            }
            $number = 0.0
            if (-not [double]::TryParse(
              $fields[$index],
              [System.Globalization.NumberStyles]::Float,
              [System.Globalization.CultureInfo]::InvariantCulture,
              [ref]$number
            )) {
              $validRecord = $false
              break
            }
          }
        }

        if ($validRecord) {
          $writer.WriteLine($line)
          $recordCount++
          if ($recordCount % 250 -eq 0) {
            Write-Host "Registros PPG validos: $recordCount"
          }
        } else {
          $invalidRecordCount++
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
  firmware = 'BIOSYS 1.0.17'
  mode = 'BIO_RESEARCH_MODE=1'
  label = $Label
  port = $Port
  baudRate = $BaudRate
  requestedDurationSeconds = $DurationSeconds
  startedAt = $startedAt.ToString('o')
  finishedAt = (Get-Date).ToString('o')
  researchRecords = $recordCount
  discardedRecords = $invalidRecordCount
  csvFile = Split-Path -Leaf $csvPath
  note = 'Datos experimentales. No usar para diagnostico medico.'
}
[System.IO.File]::WriteAllText(
  $metadataPath,
  ($metadata | ConvertTo-Json -Depth 3),
  $utf8
)

Write-Host "Captura finalizada: $recordCount registros PPG + MPU validos."
Write-Host "Filas seriales descartadas por estar incompletas o mezcladas: $invalidRecordCount"
Write-Host "CSV: $csvPath"
Write-Host "Metadatos: $metadataPath"

if ($recordCount -eq 0) {
  Write-Warning 'No se recibieron filas PPG. Confirma que cargaste el modo research y que el puerto es correcto.'
  exit 2
}
