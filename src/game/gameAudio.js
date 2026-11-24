// Original procedural simulator audio. No external recordings, downloads or dependencies.
// Audio is unlocked only by a real user gesture; all sources are cleaned up on unmount.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const abs=v=>Math.abs(v||0);
const delta=(a,b)=>abs((a||0)-(b||0));
const tau=2*Math.PI;
const specs={
 light:{idle:760,max:3000,cylinders:8},flatbed:{idle:720,max:2800,cylinders:6},
 medium:{idle:680,max:2600,cylinders:6},rotator:{idle:620,max:2350,cylinders:6}
};
export const firingFrequency=(rpm,cylinders)=>rpm*cylinders/120;
export function soundState(s,previous,dt,surface){
 const profile=specs[s.type.id]||specs.medium;
 const speed=Math.hypot(s.vel.x,s.vel.z);
 const parked=s.parkingBrake||s.riggersDeployed;
 const active=s.recoveryLines.filter(l=>l.connected);
 const heavy=s.type.id==='rotator';
 const winchOn=heavy?active.some(l=>l.motor!==0)&&s.boomDeployed&&parked&&speed<.25:
  s.hook&&(s.winch||s.winchOut)&&s.parkingBrake&&(s.boomDeployed||s.tools.includes('bed'));
 const load=clamp(heavy?Math.max(0,...active.map(l=>l.tension/42000)):s.tension/32000);
 const stalled=winchOn&&(heavy?active.some(l=>l.stalled):!!s.cableStalled);
 const same=previous?.sim===s&&dt>0&&dt<.25;
 const current={sim:s,speed,x:s.pos.x,z:s.pos.z,roll:s.pickRoll,secondaryRoll:s.secondary.roll,secondaryActive:s.secondary.active,
  boom:[s.boomAngle,s.boomExtension,s.boomSwing],lift:[s.liftHeight,s.liftExtension],
  spools:s.recoveryLines.map(l=>l.spool),length:s.cableLength,park:!!s.parkingBrake,riggers:!!s.riggersDeployed,
  hook:!!s.hook,connected:s.recoveryLines.map(l=>!!l.connected),arms:!!s.armsClosed,straps:!!s.strapsOn,
  bed:!!s.bedTilt,deck:[s.bedSlide||0,s.bedProgress||0],liftDeployed:!!s.liftDeployed,loaded:!!s.loaded,stalled,load,jobDone:!!s.jobDone,reverse:s.vel.x*Math.sin(s.yaw)-s.vel.z*Math.cos(s.yaw)<-.25};
 const valid=same&&Math.hypot(current.x-previous.x,current.z-previous.z)<5;
 const motion=valid?clamp((current.boom.reduce((n,v,i)=>n+delta(v,previous.boom[i]),0)+
 current.lift.reduce((n,v,i)=>n+delta(v,previous.lift[i]),0)+current.deck.reduce((n,v,i)=>n+delta(v,previous.deck?.[i]),0))/dt,0,2):0;
 const hydraulic=clamp(motion*.95);
 const reelSpeed=valid&&winchOn?clamp((heavy?current.spools.reduce((n,v,i)=>n+(active.includes(s.recoveryLines[i])?delta(v,previous.spools[i]):0),0):
 delta(current.length,previous.length))/dt,0,6):0;
 const throttle=parked?0:abs(s.throttle);
 const rev=clamp(Math.max(speed/17*.60+throttle*.36,hydraulic*.28,winchOn?.22+load*.35:0));
 const rpm=profile.idle+(profile.max-profile.idle)*rev;
 const rough=clamp((surface?.drag||.36)/2.65);
 const events=[];
 if(valid){
  if(current.park!==previous.park)events.push('air');
  if(current.riggers!==previous.riggers||current.liftDeployed!==previous.liftDeployed||current.bed!==previous.bed)events.push('heavy');
  if(current.hook!==previous.hook||current.connected.some((v,i)=>v!==previous.connected[i])||
    current.arms!==previous.arms||current.straps!==previous.straps||current.loaded!==previous.loaded)events.push('metal');
  if(stalled&&!previous.stalled)events.push('strain');
  if((previous.roll>.5&&current.roll<.18)||(current.secondaryActive&&previous.secondaryRoll>.5&&current.secondaryRoll<.18))events.push('heavy');
  if((previous.roll>.22&&current.roll<.18)||(current.secondaryActive&&previous.secondaryRoll>.22&&current.secondaryRoll<.18))events.push('heavy');
 }
 return {current,events:[...new Set(events)],rpm,cylinders:profile.cylinders,engineLoad:clamp(Math.max(throttle*.7,winchOn?load*.95:0,hydraulic*.6)),
  speed,rough,wet:surface?.name==='MUD'||surface?.name==='SUBMERGED',hydraulic,reelSpeed,winchOn,load,stalled,
  reverse:!parked&&(current.reverse||s.throttle<-.15),wind:clamp(speed/20),strain:clamp((load-.6)/.4)};
}
// Deterministic pseudo-random generator for reproducible original waveforms.
function noiseGenerator(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/2147483648-1;};}
export function makeSoundWave(kind,rate,seconds=2){
 const size=Math.max(1,Math.round(rate*seconds)),out=new Float32Array(size);
 const rand=noiseGenerator(0x2a713c+kind.length*19);
 let low=0,mid=0;
 for(let i=0;i<size;i++){
  const t=i/rate,white=rand();low+=.035*(white-low);mid+=.18*(white-mid);
  let value=0;
  if(kind==='diesel'){
   // 36 exhaust/combustion events per second at a 720-rpm six-cylinder reference.
   // Harmonics, firing-order variation and gritty mechanical transients rather than a pure tone.
   const p=(t*36)%1,cycle=Math.floor(t*36)%6;
   const hit=Math.exp(-p*12),weight=[1,.87,.96,.91,1.03,.89][cycle];
   value=weight*(.48*Math.sin(tau*p-.45)+.21*Math.sin(tau*p*2)+.10*Math.sin(tau*p*3)+.12*hit*(white+mid))+.12*low;
  }else if(kind==='noise'){value=.72*white+.25*mid;}
  else if(kind==='gravel'){value=.42*mid+.26*white+(rand()>.91?.45*rand():0);}
  else if(kind==='metal'){value=(.48*Math.sin(tau*530*t)+.24*Math.sin(tau*1010*t)+.13*Math.sin(tau*1730*t))*Math.exp(-t*22)+.35*white*Math.exp(-t*65);}
  else if(kind==='heavy'){value=(.62*Math.sin(tau*73*t)+.20*Math.sin(tau*167*t))*Math.exp(-t*13)+.37*mid*Math.exp(-t*28);}
  else if(kind==='air'){value=(.65*white+.25*mid)*Math.min(1,t*35)*Math.exp(-t*7);}
  else if(kind==='strain'){value=(.4*Math.sin(tau*(180*t+70*t*t))+.18*Math.sin(tau*467*t)+.24*mid)*Math.exp(-t*6)*Math.min(1,t*25);}
  // Seamless enough for loops without the abrupt end transient of raw noise.
  const fade=Math.min(1,i/(rate*.008),(size-1-i)/(rate*.008));
  out[i]=clamp(value*fade,-1,1);
 }
 return out;
}
export function createGameAudio(){
 let ctx=null,master=null,compressor=null,nodes=[],loops={},effects={},disposed=false,previous=null,elapsed=0;
 let lastReverse=0,nextReverse=0;
 const set=(param,value,time=.06)=>{if(param&&ctx)param.setTargetAtTime(value,ctx.currentTime,time);};
 function buffer(kind,duration){
  const data=makeSoundWave(kind,ctx.sampleRate,duration),b=ctx.createBuffer(1,data.length,ctx.sampleRate);
  b.getChannelData(0).set(data);return b;
 }
 function filtered(source,type,frequency,q=1){
  const filter=ctx.createBiquadFilter();filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;
  const gain=ctx.createGain();gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(master);
  nodes.push(source,filter,gain);source.start();
  return {source,filter,gain};
 }
 function loop(kind,type,frequency,q=1){
  const source=ctx.createBufferSource();source.buffer=buffer(kind,2);source.loop=true;
  return filtered(source,type,frequency,q);
 }
 function tone(type,frequency,cutoff){
  const source=ctx.createOscillator();source.type=type;source.frequency.value=frequency;
  return filtered(source,'lowpass',cutoff,.6);
 }
 function init(){
  const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;
  if(!Audio)return false;
  ctx=new Audio();master=ctx.createGain();master.gain.value=0;
  compressor=ctx.createDynamicsCompressor();compressor.threshold.value=-16;compressor.knee.value=18;compressor.ratio.value=4;
  master.connect(compressor);compressor.connect(ctx.destination);
  loops.engine=loop('diesel','lowpass',800,.55);
  loops.rattle=loop('noise','bandpass',380,.8);
  loops.turbo=tone('sine',450,1600);
  loops.winch=tone('triangle',210,1100);
  loops.winchNoise=loop('gravel','bandpass',850,.7);
  loops.pump=tone('sawtooth',125,650);
  loops.hiss=loop('noise','bandpass',1300,.65);
  loops.road=loop('gravel','lowpass',700,.6);
  loops.wind=loop('noise','lowpass',450,.7);
  loops.creak=loop('gravel','bandpass',215,2);
  loops.reverse=tone('sine',790,1400);
  for(const kind of ['metal','heavy','air','strain'])effects[kind]=buffer(kind,kind==='air'?.75:.5);
  return true;
 }
 function unlock(){
  if(disposed)return;
  try{if(!ctx&&!init())return;if(ctx.state!=='running')Promise.resolve(ctx.resume()).catch(()=>{});}
  catch{close();}
 }
 function effect(kind,volume){
  if(!ctx||ctx.state!=='running'||!effects[kind]||volume<=0)return;
  const src=ctx.createBufferSource(),g=ctx.createGain();src.buffer=effects[kind];
  g.gain.value=volume;src.connect(g);g.connect(master);
  src.onended=()=>{try{src.disconnect();g.disconnect();}catch{}};
  src.start();
 }
 function update(s,dt,surface,volume,muted,hidden){
  if(disposed)return;
  elapsed+=Math.max(0,dt||0);
  if(elapsed<1/30)return;
  const step=elapsed;elapsed=0;
  const state=soundState(s,previous,step,surface);previous=state.current;
  if(!ctx||ctx.state!=='running')return;
  const volumeLevel=muted||hidden?0:clamp(Number.isFinite(volume)?volume:.7);
  set(master.gain,volumeLevel*.65,.045);
  const gain=(name,v)=>set(loops[name].gain.gain,v,.065);
  const pitch=(name,v)=>set(loops[name].source.frequency,v,.07);
  const filter=(name,v)=>set(loops[name].filter.frequency,v,.08);
  const rev=firingFrequency(state.rpm,state.cylinders);
  set(loops.engine.source.playbackRate,clamp(rev/36,.55,4),.09);
  gain('engine',.20+state.engineLoad*.11);filter('engine',520+rev*7+state.engineLoad*650);
  gain('rattle',.038+state.engineLoad*.055);filter('rattle',280+rev*3);
  gain('turbo',state.engineLoad*.025);pitch('turbo',320+rev*8);
  const activeWinch=state.winchOn&&(state.reelSpeed>.04||state.stalled);
  gain('winch',activeWinch?.025+state.load*.047:0);
  pitch('winch',state.stalled?105:165+state.reelSpeed*70-state.load*65);
  gain('winchNoise',activeWinch?.025+state.load*.036:0);
  filter('winchNoise',440+state.reelSpeed*150);
  gain('pump',state.hydraulic*.075);pitch('pump',100+state.hydraulic*80);
  gain('hiss',state.hydraulic*.07);filter('hiss',1000+state.hydraulic*700);
  const rolling=clamp(state.speed/12);
  gain('road',rolling*(.035+state.rough*.12));filter('road',state.wet?330:500+state.rough*1100);
  gain('wind',state.wind*.045);filter('wind',280+state.wind*900);
  gain('creak',state.strain*(state.winchOn?.05:.022));
  if(state.reverse&&!lastReverse)nextReverse=ctx.currentTime;
  lastReverse=state.reverse;
  if(state.reverse&&ctx.currentTime>=nextReverse)nextReverse=ctx.currentTime+.85;
  gain('reverse',state.reverse&&ctx.currentTime>=nextReverse-.85&&ctx.currentTime<nextReverse-.56?.065:0);
  if(volumeLevel>0)for(const event of state.events)effect(event,event==='heavy'?.27:event==='metal'?.19:.15);
 }
 function silence(){if(ctx&&master)set(master.gain,0,.025);previous=null;lastReverse=0;nextReverse=0;}
 function close(){
  disposed=true;for(const node of nodes){try{node.stop?.();node.disconnect();}catch{}}
  try{master?.disconnect();compressor?.disconnect();if(ctx&&ctx.state!=='closed')Promise.resolve(ctx.close()).catch(()=>{});}catch{}
  nodes=[];loops={};effects={};ctx=null;master=null;compressor=null;previous=null;
 }
 return {unlock,update,silence,close};
}
