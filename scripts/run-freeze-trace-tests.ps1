$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$compiler=Join-Path $root '.tools/zig-windows-x86_64-0.13.0/zig.exe'
$source=Join-Path $root 'esp32/VitalWatch_BIOSYS_1_0_23'
$output=Join-Path $root '.arduino/build/freeze-trace-native'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$priorCache=$env:ZIG_GLOBAL_CACHE_DIR
try {
  $env:ZIG_GLOBAL_CACHE_DIR=Join-Path $root '.tools/zig-cache'
  & $compiler cc -x c++ -std=c++17 -fno-exceptions -fno-rtti -Wall -Wextra "-I$source" (Join-Path $root 'esp32/tests/freeze_trace_native.cpp') -o (Join-Path $output 'model-test.exe')
  if($LASTEXITCODE -ne 0){throw 'Native compilation failed'}
  $lines=& (Join-Path $output 'model-test.exe')
  $result=$LASTEXITCODE
  $lines | Write-Output
  $report=[ordered]@{
    kind='CODEX REPRODUCTION TESTS';createdAt=(Get-Date).ToString('o');exitCode=$result
    sourceHash=(Get-FileHash -LiteralPath (Join-Path $source 'FreezeTraceModel.h') -Algorithm SHA256).Hash
    testHash=(Get-FileHash -LiteralPath (Join-Path $root 'esp32/tests/freeze_trace_native.cpp') -Algorithm SHA256).Hash
    output=$lines
  }
  [IO.File]::WriteAllText((Join-Path $output 'report.json'),($report|ConvertTo-Json -Depth 4),[Text.UTF8Encoding]::new($false))
  if($result -ne 0){exit $result}
} finally { $env:ZIG_GLOBAL_CACHE_DIR=$priorCache }
