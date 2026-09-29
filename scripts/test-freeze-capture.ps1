$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'freeze-capture-helpers.ps1')
$cases=0
$failures=0
function Check($Condition, $Name) {
  $script:cases++
  if($Condition){Write-Output "PASS $Name"}else{$script:failures++;Write-Output "FAIL $Name"}
}
$hr='HRPAIR,1,10475181,0,225,0,4,nan,1,10475720,1,nan,0,0,0,0,0.0000,0,0,0.000,0.000,8,0,0,0,3637,189886,0'
Check ((Get-FreezeFrameType $hr) -eq 'hrpair') 'complete HRPAIR is retained'
Check ((Get-FreezeFrameType 'FREEZE,1,LIVE,123,10,0,1,1,3') -eq 'freeze') 'LIVE retained'
Check ((Get-FreezeFrameType 'FREEZE,1,PREV,1,123,1000,10,123,900,2000') -eq 'freeze') 'PREV retained'
Check ((Get-FreezeFrameType 'FREEZE,1,STALL,123,20') -eq 'stall') 'STALL terminates long capture'
Check ((Get-FreezeFrameType 'HRPAIR,1,117,1,naHRPAIR,1,117,1,na') -eq 'malformed') 'mixed fragments not counted as responses'
Check ((Get-FreezeFrameType 'HRPAIR,1,123,token=private') -eq 'malformed') 'non-numeric diagnostic payload not retained'
Check ((Get-FreezeFrameType '[INFO] private network data') -eq 'other') 'other logs excluded'
Check ((Get-FreezeFrameType 'FREEZE,1,STALL,2') -eq 'malformed') 'truncated stall rejected'
Check (-not (Test-FreezeCaptureTimedOut 9999 0)) 'initial grace below ten seconds'
Check (Test-FreezeCaptureTimedOut 10000 0) 'no initial response times out'
Check (-not (Test-FreezeCaptureTimedOut 14000 4133)) 'recent HRPAIR keeps capture alive'
Check (Test-FreezeCaptureTimedOut 14133 4133) 'loss after initial responses also times out'
Write-Output "CODEX REPRODUCTION TESTS: $cases cases, $failures failures"
if($failures){exit 1}
