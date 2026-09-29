# Read-only integration check of the actual setup statements; no build/upload.
$ErrorActionPreference = 'Stop'
$source = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'esp32-firmware.ps1') -Raw
$boundary = $source.IndexOf('function Invoke-ArduinoCli')
if ($boundary -lt 0) { throw 'Setup boundary missing; review the test.' }
# ScriptBlock.Create has no source filename, so supply only that host intrinsic.
# The actual version selection and path expressions remain unmodified.
$setup = $source.Substring(0, $boundary).Replace('$PSScriptRoot', ("'" + $PSScriptRoot.Replace("'", "''") + "'"))
$probe = [scriptblock]::Create($setup + @'

[pscustomobject]@{
  sketch = $biosysDirectory
  normal = $biosysBuildDirectory
  compare = $biosysCompareBuildDirectory
  research = $biosysResearchBuildDirectory
  replay = $biosysReplayBuildDirectory
}
'@)
$root = Split-Path -Parent $PSScriptRoot
foreach ($version in @('1.0.21', '1.0.22', '1.0.23')) {
  $actual = & $probe -BiosysVersion $version
  $expected = @{
    sketch = Join-Path $root ('esp32\VitalWatch_BIOSYS_' + $version.Replace('.', '_'))
    normal = Join-Path $root (".arduino\build\biosys-$version")
    compare = Join-Path $root (".arduino\build\biosys-$version-hrpair")
    research = Join-Path $root (".arduino\build\biosys-$version-research")
    replay = Join-Path $root (".arduino\build\biosys-$version-replay")
  }
  foreach ($key in $expected.Keys) {
    if ($actual.$key -ne $expected[$key]) { throw "$version $key path mismatch" }
  }
  Write-Output "PASS: $version has separate sketch and build paths."
}
$defaults = & $probe
if ($defaults.compare -ne (Join-Path $root '.arduino\build\biosys-1.0.21-hrpair')) {
  throw 'The existing default no longer targets 1.0.21.'
}
$rejected = $false
try { & $probe -BiosysVersion '9.9.9' | Out-Null } catch { $rejected = $true }
if (-not $rejected) { throw 'Unknown firmware version was accepted.' }
Write-Output 'PASS: default preserved and unknown version rejected; no serial port opened.'
