import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Host characterization only. Never opens COM, changes firmware, or reads secrets.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const versionArg=process.argv.find(arg=>arg.startsWith('--version='));
const version=versionArg?.split('=')[1]??'1.0.21';
if(!['1.0.21','1.0.22','1.0.23'].includes(version))throw new Error('Supported versions: 1.0.21, 1.0.22, 1.0.23');
const source=path.join(root,'esp32','VitalWatch_BIOSYS_'+version.replaceAll('.','_'));
const tests=path.join(root,'esp32/tests/hrpair_native');
const output=path.join(root,'.arduino/build',version==='1.0.21'?'hrpair-native':'hrpair-native-'+version);
const compiler=process.env.VITALWATCH_ZIG ?? path.join(root,'.tools/zig-windows-x86_64-0.13.0/zig.exe');
const sensor=fs.readFileSync(path.join(source,'Sensor_Oxigeno.cpp'),'utf8');
const types=fs.readFileSync(path.join(source,'Sensor_Oxigeno.h'),'utf8');
const config=fs.readFileSync(path.join(source,'Configuracion.h'),'utf8');
function block(text,marker,semicolon=false){
  const start=text.indexOf(marker);
  if(start<0||text.indexOf(marker,start+marker.length)>=0)throw new Error(`Expected unique declaration: ${marker}`);
  const brace=text.indexOf('{',start);
  let depth=0;
  for(let i=brace;i<text.length;i++){
    if(text[i]==='{')depth++;
    if(text[i]==='}'&&--depth===0)return text.slice(start,i+1)+(semicolon?';':'');
  }
  throw new Error(`Unclosed block: ${marker}`);
}
function constant(text,name){
  const found=text.match(new RegExp(`(?:static )?constexpr [^;\\n]*\\b${name}\\s*=[^;]+;`,'g'));
  if(found?.length!==1)throw new Error(`Expected one constant: ${name}`);
  return found[0];
}
const stateStart=sensor.indexOf('HeartRateResult hrDisplay=hr;');
const stateEnd=sensor.indexOf('MeasurementSessionState session=',stateStart);
if(stateStart<0||stateEnd<=stateStart)throw new Error('Display state block missing');
const selected=[
  block(config,'enum class SignalQuality',true),
  block(config,'enum QualityReason',true),
  block(types,'enum class HeartRateStatus',true),
  block(types,'enum class SpO2Status',true),
  block(types,'struct HeartRateResult',true),
  block(types,'struct SpO2Result',true),
  `namespace VitalWatchConfig { ${constant(config,'INTERVALO_RESULTADO_PPG_MS')} }`,
  `namespace PPGConfig { ${constant(sensor,'DISPLAY_HISTORY')} }`,
  'HeartRateResult hr{}; SpO2Result sp{};',
  sensor.slice(stateStart,stateEnd),
  ...['void clearDisplayBpmHistory()','void resetDisplayResults()',
    'float medianDisplayedBpm()','void queueDisplayBpm()',
    'void publishDisplayResults()'].map(name=>block(sensor,name)),
].join('\n\n');
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'publication.inc'),selected);
const executable=path.join(output,'reproduction.exe');
const env={...process.env,ZIG_GLOBAL_CACHE_DIR:path.join(root,'.tools/zig-cache')};
function run(args){
  const result=spawnSync(compiler,args,{cwd:root,stdio:'inherit',env});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Compilation failed: ${result.status}`);
}
run(['c++','-std=c++17','-O0','-Wall','-Wextra', '-I'+tests,'-I'+source,'-I'+output,
  path.join(tests,'reproduction.cpp'),path.join(source,'PpgBeatFusion.cpp'),'-o',executable]);
const checked=['Sensor_Oxigeno.cpp','Sensor_Oxigeno.h','Configuracion.h','PpgBeatFusion.cpp','PpgBeatFusion.h','PpgChannelDetector.h'];
const hashes=Object.fromEntries(checked.map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(source,name))).digest('hex')]));
const result=spawnSync(executable,process.argv.includes('--require-immediate')?['--require-immediate']:[],{cwd:root,encoding:'utf8'});
if(result.error)throw result.error;
process.stdout.write(result.stdout);process.stderr.write(result.stderr);
const report={kind:'CODEX REPRODUCTION TESTS',createdAt:new Date().toISOString(),
  firmwareVersion:version,
  mode:process.argv.includes('--require-immediate')?'proposed-immediate-contract':'baseline-characterization',
  sourceHashes:hashes,exitCode:result.status,output:result.stdout};
const reportPath=path.join(output,report.mode+'.json');
fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
console.log(`Report: ${reportPath}`);
process.exitCode=result.status??1;
