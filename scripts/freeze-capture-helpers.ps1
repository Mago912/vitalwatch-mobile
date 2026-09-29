function Get-FreezeFrameType([string]$Line) {
  if ($Line.StartsWith('HRPAIR,')) {
    $fields=$Line.Split(',')
    if ($fields.Count -eq 28 -and $fields[1] -eq '1' -and
        -not ($fields[2..27] | Where-Object { $_ -cnotmatch '^(?:[0-9]+(?:\.[0-9]+)?|nan)$' })) {
      return 'hrpair' # Structural validation only; scientific parser runs later.
    }
    return 'malformed'
  }
  if ($Line.StartsWith('FREEZE,')) {
    $fields=$Line.Split(',')
    $lengths=@{LIVE=9;PREV=10;STALL=5}
    if ($fields.Count -ge 3 -and $fields[1] -eq '1' -and
        $lengths.ContainsKey($fields[2]) -and $fields.Count -eq $lengths[$fields[2]] -and
        -not ($fields[3..($fields.Count-1)] | Where-Object { $_ -notmatch '^[0-9]+$' })) {
      if ($fields[2] -eq 'STALL') { return 'stall' }
      return 'freeze'
    }
    return 'malformed'
  }
  return 'other'
}
function Test-FreezeCaptureTimedOut([long]$NowMs, [long]$LastHrpairMs) {
  return ($NowMs-$LastHrpairMs) -ge 10000
}
