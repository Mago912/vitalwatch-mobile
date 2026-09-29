param(
  [Parameter(Mandatory=$true)][string]$Port,
  [ValidateRange(10,120)][int]$DurationSeconds=20,
  [string]$Label='diagnostico-corto'
)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'freeze-capture-helpers.ps1')
$root=Split-Path -Parent $PSScriptRoot
$folder=Join-Path $root 'measurements/biosys-1.0.23-freeze'
New-Item -ItemType Directory -Force -Path $folder | Out-Null
$safeLabel=($Label -replace '[^a-zA-Z0-9_-]','-')
$base=Join-Path $folder ((Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+$safeLabel)
$pairWriter=[IO.StreamWriter]::new("$base.hrpair.log",$false,[Text.UTF8Encoding]::new($false))
$traceWriter=[IO.StreamWriter]::new("$base.freeze.log",$false,[Text.UTF8Encoding]::new($false))
$serial=[IO.Ports.SerialPort]::new($Port,115200,'None',8,'One')
$serial.DtrEnable=$false; $serial.RtsEnable=$false
$serial.NewLine="`n"; $serial.WriteTimeout=1000
$started=Get-Date
$reason='error'; $errorText=$null
$pairs=0; $traces=0; $malformed=0; $ignored=0; $overlong=0
$pending=''; $discardUntilNewline=$false
try {
  $serial.Open(); $serial.DiscardInBuffer()
  $watch=[Diagnostics.Stopwatch]::StartNew()
  $lastPairMs=0; $nextQuery=0
  $serial.WriteLine('J')
  Write-Host "FREEZE: hasta $DurationSeconds s; se detiene si hay STALL o 10 s sin HRPAIR."
  while ($watch.Elapsed.TotalSeconds -lt $DurationSeconds) {
    if($watch.ElapsedMilliseconds -ge $nextQuery) {
      $serial.WriteLine('Q'); $nextQuery=$watch.ElapsedMilliseconds+1000
    }
    $chunk=$serial.ReadExisting()
    if($discardUntilNewline) {
      $end=$chunk.IndexOf("`n")
      if($end -ge 0){$chunk=$chunk.Substring($end+1);$discardUntilNewline=$false}else{$chunk=''}
    }
    $pending+=$chunk
    while($pending.Contains("`n")) {
      $end=$pending.IndexOf("`n")
      $line=$pending.Substring(0,$end).Trim(); $pending=$pending.Substring($end+1)
      if($line.Length -gt 1024){$overlong++;continue}
      $type=Get-FreezeFrameType $line
      $elapsed=$watch.ElapsedMilliseconds
      switch($type) {
        'hrpair' {$pairWriter.WriteLine("$elapsed|$line");$pairWriter.Flush();$pairs++;$lastPairMs=$elapsed}
        'freeze' {$traceWriter.WriteLine("$elapsed|$line");$traceWriter.Flush();$traces++}
        'stall' {$traceWriter.WriteLine("$elapsed|$line");$traceWriter.Flush();$traces++;$reason='stall'}
        'malformed' {$malformed++}
        default {$ignored++} # Never persist possible credentials/network logs.
      }
    }
    if($pending.Length -gt 1024){$overlong++;$pending='';$discardUntilNewline=$true}
    if($reason -eq 'stall'){break}
    if(Test-FreezeCaptureTimedOut $watch.ElapsedMilliseconds $lastPairMs){$reason='hrpair-timeout';break}
    Start-Sleep -Milliseconds 20
  }
  if($reason -eq 'error'){$reason='duration-ended'}
} catch {
  $errorText=$_.Exception.GetType().Name
  Write-Warning "Captura interrumpida: $errorText"
} finally {
  if($serial.IsOpen){$serial.Close()};$serial.Dispose()
  $pairWriter.Dispose();$traceWriter.Dispose()
  $meta=[ordered]@{
    firmware='BIOSYS 1.0.23 DIAG';firmwareVersionSource='Operator-selected, verify upload first'
    port=$Port;baudRate=115200;label=$Label;durationRequestedSeconds=$DurationSeconds
    startedAt=$started.ToString('o');finishedAt=(Get-Date).ToString('o')
    stopReason=$reason;structuralHrpairFrames=$pairs;freezeFrames=$traces
    malformedFrames=$malformed;ignoredLines=$ignored;overlongFragments=$overlong
    pendingCharacters=$pending.Length;errorType=$errorText
    note='No reset. Numeric diagnostic frames only. Completion is not validation of FC.'
  }
  [IO.File]::WriteAllText("$base.json",($meta|ConvertTo-Json),[Text.UTF8Encoding]::new($false))
}
Write-Host "Resultado: $reason; HRPAIR=$pairs; FREEZE=$traces; malformados=$malformed; largos=$overlong"
Write-Host "Registro: $base"
if($pairs -gt 0){
  & node (Join-Path $PSScriptRoot 'biosys-hr-pair.mjs') "$base.hrpair.log"
  if($LASTEXITCODE -ne 0){exit 2}
}
if($reason -ne 'duration-ended' -or $pairs -eq 0){exit 1}
