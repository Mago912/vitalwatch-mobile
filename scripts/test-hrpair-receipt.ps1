# Read-only regression: execute the production JSON assignment, never upload.
param([string]$ReceiptPath = (Join-Path $PSScriptRoot '..\.arduino\build\biosys-1.0.21-hrpair\HRPAIR_BUILD.json'))
$ErrorActionPreference = 'Stop'
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  (Join-Path $PSScriptRoot 'esp32-firmware.ps1'), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'Firmware script has parse errors.' }
$assignment = $ast.Find({ param($node)
  $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and
  $node.Left.Extent.Text -eq '$receipt' -and
  $node.Right.Extent.Text -match 'ConvertFrom-Json'
}, $true)
if (-not $assignment) { throw 'Receipt reader not found.' }
. ([scriptblock]::Create($assignment.Extent.Text))
if (@($receipt).Count -lt 2) { throw 'Expected multiple individual receipt entries, not one nested array.' }
foreach ($entry in $receipt) {
  if ($entry.path -isnot [string] -or $entry.sha256 -isnot [string]) {
    throw 'Each receipt entry must have a scalar path and hash.'
  }
  if (-not (Test-Path -LiteralPath $entry.path) -or
      (Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash -ne $entry.sha256) {
    throw 'Receipt is stale: rebuild before running this local integration test.'
  }
}
Write-Output "PASS: $(@($receipt).Count) individual entries match; no serial port opened."
