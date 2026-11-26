// Game-only capacities for portable anchors and tree slings.
export function anchorCapacity(surface,slope,tree=false){
 if(tree)return 68000;
 if(surface.depth>.2||slope>.85)return 0;
 if(surface.name.includes('MUD'))return 14000;
 if(surface.name==='ICE'||surface.name==='PACKED SNOW')return 18000;
 if(surface.name==='CONCRETE'||surface.name==='BRIDGE DECK'||surface.name==='PAVEMENT')return 44000;
 return slope>.45?23000:58000;
}

export function redirectLoad(tension,previous,anchor,next){
 const a=Math.hypot(previous.x-anchor.x,previous.y-anchor.y,previous.z-anchor.z);
 const b=Math.hypot(next.x-anchor.x,next.y-anchor.y,next.z-anchor.z);
 if(!a||!b)return 0;
 return tension*Math.hypot((previous.x-anchor.x)/a+(next.x-anchor.x)/b,
  (previous.y-anchor.y)/a+(next.y-anchor.y)/b,(previous.z-anchor.z)/a+(next.z-anchor.z)/b);
}
