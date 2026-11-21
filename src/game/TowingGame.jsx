import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

function box(parent,name,size,pos,color,opts={}) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({color,roughness:opts.roughness??.78,metalness:opts.metalness??.08}));
  mesh.name=name; mesh.position.set(...pos); mesh.castShadow=true; mesh.receiveShadow=true; parent.add(mesh); return mesh;
}
function makeVehicle(scene,{name,color,pos,scale=1}) {
  const root=new THREE.Group(); root.name=name; root.position.copy(pos); scene.add(root);
  const body=new THREE.Group(); root.add(body);
  box(body,'frame',[2.05*scale,.48*scale,4.8*scale],[0,.95*scale,0],0x252a2e);
  box(body,'cab',[1.92*scale,1.45*scale,1.85*scale],[0,1.78*scale,-1.12*scale],color);
  box(body,'hood',[1.95*scale,.7*scale,1.55*scale],[0,1.55*scale,-2.45*scale],color);
  box(body,'windshield',[1.68*scale,.78*scale,.08*scale],[0,2.0*scale,-2.04*scale],0x8eb1c2,{metalness:.25,roughness:.22});
  box(body,'bed',[2.0*scale,.3*scale,1.5*scale],[0,1.35*scale,1.15*scale],0x333a40);
  const wheels=[];
  for(const z of [-1.55,1.55]) for(const x of [-1.06,1.06]) {
    const tire=new THREE.Mesh(new THREE.CylinderGeometry(.48*scale,.48*scale,.32*scale,20),new THREE.MeshStandardMaterial({color:0x17191b,roughness:.95}));
    tire.rotation.z=Math.PI/2; tire.position.set(x,.62*scale,z); tire.castShadow=true; root.add(tire); wheels.push(tire);
    const hub=new THREE.Mesh(new THREE.CylinderGeometry(.2*scale,.2*scale,.335*scale,16),new THREE.MeshStandardMaterial({color:0x8b9297,metalness:.7,roughness:.35}));
    hub.rotation.z=Math.PI/2; hub.position.copy(tire.position); root.add(hub);
  }
  if(name==='wrecker') {
    box(body,'boom base',[1.55,.42,1.1],[0,1.45,1.75],0x24282c);
    const boom=box(body,'folded recovery boom',[.42,.38,3.1],[0,2.35,2.5],0xd4a326); boom.rotation.x=1.35;
    box(body,'folded wheel lift crossbar',[2.25,.18,.3],[0,1.65,3.65],0x444b50);
    for(const x of [-.8,.8]) {const fork=box(body,'folded lift fork',[.16,.13,1.05],[x,1.45,4.0],0xc1c5c8);fork.rotation.x=1.25;}
  }
  root.userData={body,wheels,scale}; return root;
}

export default function TowingGame(){
 const mount=useRef(null),sim=useRef(null),[hud,setHud]=useState({speed:0,gear:'D',hook:false,tension:0,winch:'IDLE'}),[help,setHelp]=useState(true);
 useEffect(()=>{
  const host=mount.current;if(!host)return;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x9db2c2);scene.fog=new THREE.Fog(0x9db2c2,55,180);
  const camera=new THREE.PerspectiveCamera(62,1,.1,350);camera.position.set(9,7,12);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;host.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xdcecff,0x56604a,2.0));const sun=new THREE.DirectionalLight(0xfff0d8,2.4);sun.position.set(-25,38,20);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({color:0x59684a,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.12;ground.receiveShadow=true;scene.add(ground);
  const road=new THREE.Mesh(new THREE.BoxGeometry(10,.12,125),new THREE.MeshStandardMaterial({color:0x303438,roughness:.95}));road.position.set(0,-.02,-18);road.receiveShadow=true;scene.add(road);
  const shoulder=new THREE.Mesh(new THREE.BoxGeometry(5,.16,125),new THREE.MeshStandardMaterial({color:0x85785d}));shoulder.position.set(7.1,-.07,-18);scene.add(shoulder);
  const ditch=new THREE.Mesh(new THREE.BoxGeometry(4,.55,28),new THREE.MeshStandardMaterial({color:0x4d5840}));ditch.position.set(10.5,-.38,-20);scene.add(ditch);
  for(let i=0;i<30;i++){const x=(i%2?1:-1)*(14+Math.random()*28),z=-70+i*5;const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.3,2.8,7),new THREE.MeshStandardMaterial({color:0x59432e}));trunk.position.set(x,1.3,z);scene.add(trunk);const crown=new THREE.Mesh(new THREE.ConeGeometry(1.5+Math.random(),4.4,7),new THREE.MeshStandardMaterial({color:0x344d38}));crown.position.set(x,4.1,z);crown.castShadow=true;scene.add(crown);}
  for(let z=-75;z<40;z+=8){const dash=new THREE.Mesh(new THREE.BoxGeometry(.13,.025,3.4),new THREE.MeshBasicMaterial({color:0xe4dfc6}));dash.position.set(0,.06,z);scene.add(dash);}
  const truck=makeVehicle(scene,{name:'wrecker',color:0xc83b2c,pos:V(0,0,7)});
  const pickup=makeVehicle(scene,{name:'pickup',color:0x315c83,pos:V(10.2,0,-18),scale:.92});
  pickup.rotation.y=.18;
  // Pickup starts low in the soft ditch with a little yaw.
  const cableMat=new THREE.LineBasicMaterial({color:0xf3bd43});const cableGeo=new THREE.BufferGeometry().setFromPoints([V(),V()]);const cable=new THREE.Line(cableGeo,cableMat);scene.add(cable);cable.visible=false;
  const s={truck,pickup,pos:V(0,0,7),vel:V(),yaw:0,steer:0,throttle:0,brake:0,hook:false,winch:false,parkingBrake:false,cableLength:14,tension:0,pickPos:V(10.2,0,-18),pickVel:V(),pickYaw:-.18,cameraYaw:0,cameraPitch:.24,zoom:13,drag:null,pointers:new Map(),lastHud:0};
  sim.current=s;
  const resize=()=>{const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};const ro=new ResizeObserver(resize);ro.observe(host);resize();
  let last=performance.now(),raf=0;
  const update=(now)=>{
   const dt=Math.min(.033,(now-last)/1000);last=now;const steps=Math.max(1,Math.ceil(dt/(1/120)));const h=dt/steps;
   for(let n=0;n<steps;n++){
    const forward=V(Math.sin(s.yaw),0,-Math.cos(s.yaw));const right=V(Math.cos(s.yaw),0,Math.sin(s.yaw));
    const speed=s.vel.dot(forward);const steerAngle=s.steer*(.48-.28*clamp(Math.abs(speed)/22,0,1));s.truck.userData.body.rotation.y=0;
    const parked=s.winch||s.parkingBrake;const accel=(parked?0:s.throttle*5.8)-(s.brake||parked?Math.sign(speed)*18:0)-speed*0.22;
    s.vel.addScaledVector(forward,accel*h);
    const side=s.vel.dot(right);s.vel.addScaledVector(right,-side*Math.min(1,12.5*h));
    s.vel.multiplyScalar(Math.pow(.985,h*60));
    const yawRate=clamp((speed/3.4)*Math.tan(steerAngle),-1.25,1.25);s.yaw+=yawRate*h;
    const max=20;const sp=s.vel.length();if(sp>max)s.vel.setLength(max);
    s.pos.addScaledVector(s.vel,h);s.pos.y=0;
    // Truck wheel spin and steering articulation.
    for(let i=0;i<s.truck.userData.wheels.length;i++){const w=s.truck.userData.wheels[i];w.rotation.x+=speed*h/0.48;if(i<2)w.rotation.y=s.steer*.28;}
    s.truck.position.copy(s.pos);s.truck.rotation.y=-s.yaw;
    // Ditch resistance and recovery vehicle interaction.
    const pickForward=V(Math.sin(s.pickYaw),0,-Math.cos(s.pickYaw));
    const pa=s.pos.clone().add(V(0,1.1,0)).add(forward.clone().multiplyScalar(-2.3));
    const pb=s.pickPos.clone().add(V(0,1,0)).add(pickForward.clone().multiplyScalar(2.0));
    const delta=pb.clone().sub(pa);const dist=delta.length();const dir=delta.normalize();
    if(s.hook){
      if(s.winch)s.cableLength=Math.max(3.2,s.cableLength-2.4*h);
      const rel=s.pickVel.clone().sub(s.vel).dot(dir);s.tension=Math.max(0,(dist-s.cableLength)*6200+rel*780);
      if(s.tension>32000){s.hook=false;s.tension=0;}
      else if(dist>s.cableLength){const f=Math.min(s.tension,32000);s.pickVel.addScaledVector(dir,-f/2350*h);s.vel.addScaledVector(dir,f/6200*h);}
    } else s.tension=0;
    // Pickup's soft-ground drag and rolling resistance.
    const pside=s.pickVel.dot(V(Math.cos(s.pickYaw),0,Math.sin(s.pickYaw)));s.pickVel.addScaledVector(V(Math.cos(s.pickYaw),0,Math.sin(s.pickYaw)),-pside*Math.min(1,2.6*h));
    s.pickVel.multiplyScalar(Math.pow(.994,h*60));s.pickPos.addScaledVector(s.pickVel,h);
    if(s.pickPos.x>7.4)s.pickVel.x*=Math.pow(.82,h*60);
    if(s.pickPos.z>6)s.pickVel.z*=Math.pow(.85,h*60);
    s.pickYaw+=clamp(s.pickVel.x*.018,-.35,.35)*h;
    s.pickup.position.copy(s.pickPos);s.pickup.rotation.y=-s.pickYaw;
    if(s.hook){cable.visible=true;cable.geometry.setFromPoints([pa,pb]);}else cable.visible=false;
   }
   // Orbit follow camera, pinch zoom is handled by pointer distance.
   const focus=s.pos.clone().add(V(0,1.2,0));const distance=s.zoom;const cy=Math.cos(s.cameraPitch),sy=Math.sin(s.cameraPitch);
   const offset=V(Math.sin(s.cameraYaw)*cy*distance,sy*distance,Math.cos(s.cameraYaw)*cy*distance);
   camera.position.copy(focus).add(offset);camera.lookAt(focus.clone().add(V(0,0,-2)));
   if(now-s.lastHud>120){const sp=s.vel.length()*3.6;setHud({speed:sp,gear:s.throttle<-.1?'R':'D',hook:s.hook,tension:s.tension/1000,winch:s.winch?'REELING':'IDLE',parking:s.winch||s.parkingBrake});s.lastHud=now;}
   renderer.render(scene,camera);raf=requestAnimationFrame(update);
  };raf=requestAnimationFrame(update);
  const onKey=(e)=>{const down=e.type==='keydown';if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();if(e.key==='w'||e.key==='ArrowUp')s.throttle=down?1:0;if(e.key==='s'||e.key==='ArrowDown')s.brake=down;if(e.key==='a'||e.key==='ArrowLeft')s.steer=down?-1:0;if(e.key==='d'||e.key==='ArrowRight')s.steer=down?1:0;if(e.key.toLowerCase()==='r')s.winch=down;if(down&&e.key.toLowerCase()==='h')s.hook=!s.hook;};
  window.addEventListener('keydown',onKey);window.addEventListener('keyup',onKey);
  const onPointerDown=e=>{renderer.domElement.setPointerCapture(e.pointerId);s.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(s.pointers.size===1)s.drag={x:e.clientX,y:e.clientY,yaw:s.cameraYaw,pitch:s.cameraPitch};};
  const onPointerMove=e=>{if(!s.pointers.has(e.pointerId))return;s.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(s.pointers.size===1&&s.drag){s.cameraYaw=s.drag.yaw-(e.clientX-s.drag.x)*.006;s.cameraPitch=clamp(s.drag.pitch+(e.clientY-s.drag.y)*.004,-.05,.85);}if(s.pointers.size===2){const p=[...s.pointers.values()];const d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(s.pinch)s.zoom=clamp(s.pinch.zoom*s.pinch.d/Math.max(20,d),6,26);else s.pinch={d,zoom:s.zoom};}};
  const onPointerUp=e=>{s.pointers.delete(e.pointerId);s.drag=null;if(s.pointers.size<2)s.pinch=null;};
  renderer.domElement.addEventListener('pointerdown',onPointerDown);renderer.domElement.addEventListener('pointermove',onPointerMove);renderer.domElement.addEventListener('pointerup',onPointerUp);renderer.domElement.addEventListener('pointercancel',onPointerUp);
  return()=>{cancelAnimationFrame(raf);ro.disconnect();window.removeEventListener('keydown',onKey);window.removeEventListener('keyup',onKey);renderer.dispose();host.removeChild(renderer.domElement);scene.traverse(o=>{o.geometry?.dispose?.();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});};
 },[]);
 const press=(key,val)=>e=>{e.preventDefault();if(sim.current)sim.current[key]=val;};
 const joystickMove=e=>{const el=e.currentTarget,rect=el.getBoundingClientRect(),dx=(e.clientX-(rect.left+rect.width/2))/(rect.width*.42),dy=(e.clientY-(rect.top+rect.height/2))/(rect.height*.42);if(sim.current){sim.current.steer=clamp(dx,-1,1);sim.current.throttle=clamp(-dy,0,1);}};
 const joystickStop=e=>{e.preventDefault();if(sim.current){sim.current.steer=0;sim.current.throttle=0;}};
 const toggleHook=()=>{const s=sim.current;if(!s)return;s.hook=!s.hook;if(s.hook){const f=V(Math.sin(s.yaw),0,-Math.cos(s.yaw));const a=s.pos.clone().add(f.multiplyScalar(-2.3));s.cableLength=clamp(a.distanceTo(s.pickPos),4,25);}};
 const reset=()=>{const s=sim.current;if(!s)return;s.pos.set(0,0,7);s.vel.set(0,0,0);s.yaw=0;s.pickPos.set(10.2,0,-18);s.pickVel.set(0,0,0);s.hook=false;s.winch=false;s.cableLength=14;};
 const Hold=({label,onDown,onUp,wide=false})=><button className={wide?'control wide':'control'} onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={onUp} onContextMenu={e=>e.preventDefault()}>{label}</button>;
 return <main className="game-shell"><div className="scene" ref={mount}/>
  <header className="topbar"><div><strong>TOWING & RECOVERY</strong><small>FIELD TEST • MEDIUM DUTY WRECKER</small></div><div className="speed"><b>{hud.speed.toFixed(0)}</b><span>KM/H</span></div></header>
  <section className="mission"><div className="eyebrow">ACTIVE CALL · 01</div><b>Pickup in the ditch</b><span>Hook the disabled truck and recover it to the roadway.</span><div className="stats"><span>{hud.hook?'CABLE CONNECTED':'CABLE DISCONNECTED'}</span><span>{hud.tension.toFixed(1)} kN</span></div></section>
  <div className="bottom-ui"><div className="joystick" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);joystickMove(e);}} onPointerMove={joystickMove} onPointerUp={joystickStop} onPointerCancel={joystickStop}><div className="stick-knob">●</div><span>DRIVE</span></div><div className="recovery"><div className={'park-indicator '+(hud.parking?'on':'')}>PARK BRAKE {hud.parking?'ON':'OFF'}</div><button className={'action '+(hud.hook?'active':'')} onClick={toggleHook}>{hud.hook?'UNHOOK':'HOOK'}</button><Hold label="WINCH IN" onDown={press('winch',true)} onUp={press('winch',false)}/></div><div className="drive"><Hold label="BRAKE" onDown={press('brake',true)} onUp={press('brake',false)}/><Hold label="GAS" wide onDown={press('throttle',1)} onUp={press('throttle',0)}/></div></div>
  <div className="toolbar"><button onClick={reset}>RESET</button><button onClick={()=>{const s=sim.current;if(s){s.cameraYaw=0;s.cameraPitch=.24;s.zoom=13;}}}>RESET CAMERA</button><button onClick={()=>setHelp(v=>!v)}>CONTROLS</button></div>
  {help&&<aside className="help"><button onClick={()=>setHelp(false)}>×</button><b>HOW TO OPERATE</b><span>Use the left joystick to steer and accelerate. Gas and brake pedals are on the right. Winching automatically applies the parking brake. Drag the scene to orbit; pinch to zoom. Hook the pickup, then hold WINCH IN to shorten the line.</span><small>Keyboard: W/S drive & brake · A/D steer · H hook · R winch</small></aside>}
 </main>;
}
