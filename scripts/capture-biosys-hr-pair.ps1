param(
  [Parameter(Mandatory = $true)][string]$Port,
  [ValidateRange(10, 3600)][int]$DurationSeconds = 120,
  [string]$Label = 'dedo-luz-habitual',
  [ValidateSet('1.0.21', '1.0.22')][string]$FirmwareVersion = '1.0.21'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$labelSafe = ($Label.Trim() -replace '[^a-zA-Z0-9_-]', '-').Trim('-')
if (-not $labelSafe) { $labelSafe = 'captura' }
$directory = Join-Path $projectRoot ("measurements\biosys-$FirmwareVersion-hrpair")
New-Item -ItemType Directory -Force -Path $directory | Out-Null
$base = Join-Path $directory ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $labelSafe)
$writer = [IO.StreamWriter]::new("$base.log", $false, [Text.UTF8Encoding]::new($false))
$serial = [IO.Ports.SerialPort]::new($Port, 115200, 'None', 8, 'One')
$serial.DtrEnable = $false
$serial.RtsEnable = $false
$serial.NewLine = "`n"
$serial.WriteTimeout = 1000
$count = 0
$bufferResets = 0
$startedAt = Get-Date
$completed = $false
try {
  $serial.Open()
  $serial.DiscardInBuffer()
  $pending = ''
  $watch = [Diagnostics.Stopwatch]::StartNew()
  $next = 0
  Write-Host "HRPAIR: capturando $DurationSeconds s por $Port, 115200 baudios."
  while ($watch.Elapsed.TotalSeconds -lt $DurationSeconds) {
    if ($watch.ElapsedMilliseconds -ge $next) {
      $serial.WriteLine('Q')
      $next = $watch.ElapsedMilliseconds + 1000
    }
    $pending += $serial.ReadExisting()
    while ($pending.Contains("`n")) {
      $splitAt = $pending.IndexOf("`n")
      $line = $pending.Substring(0, $splitAt).Trim()
      $pending = $pending.Substring($splitAt + 1)
      if ($line.Contains('HRPAIR,')) {
        $writer.WriteLine(('{0}|{1}' -f $watch.ElapsedMilliseconds, $line))
        $count++
        if ($count % 15 -eq 0) { $writer.Flush(); Write-Host "Respuestas HRPAIR: $count" }
      }
    }
    if ($pending.Length -gt 65536) { $pending = ''; $bufferResets++ }
    if ($watch.Elapsed.TotalSeconds -gt 7 -and $count -eq 0) {
      throw 'Sin respuestas HRPAIR: confirma que esta instalado el perfil HRPAIR-1 y no normal/Research.'
    }
    Start-Sleep -Milliseconds 20
  }
  $completed = $true
} finally {
  if ($serial.IsOpen) { $serial.Close() }
  $serial.Dispose()
  $writer.Dispose()
  $metadata = [ordered]@{
    firmware = "BIOSYS $FirmwareVersion"; profile = 'HRPAIR-1'; schema = 1
    firmwareVersionSource = 'Operator-selected; HRPAIR schema 1 does not report firmware version.'
    port = $Port; baudRate = 115200; label = $Label
    durationRequestedSeconds = $DurationSeconds; pollingIntervalMs = 1000
    startedAt = $startedAt.ToString('o'); finishedAt = (Get-Date).ToString('o')
    completed = $completed; receivedLines = $count; bufferResets = $bufferResets
    note = 'Snapshots of instant and display states; not a 25 Hz waveform capture.'
  }
  [IO.File]::WriteAllText("$base.json", ($metadata | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
}
Write-Host "Registro: $base.log"
Write-Host 'Analisis (las lineas malformadas se rechazan y se informan):'
& node (Join-Path $PSScriptRoot 'biosys-hr-pair.mjs') "$base.log"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
