class AnimationPlayer {
  constructor(meta){ this.meta=meta; this.current='idle'; this.time=0; this.frameIndex=0; this.done=false; this.hitFired=false; }
  play(name, restart=false){ if(!this.meta?.animations?.[name]) name='idle'; if(this.current!==name || restart){ this.current=name; this.time=0; this.frameIndex=0; this.done=false; this.hitFired=false; } }
  anim(){ return this.meta.animations[this.current]; }
  update(dt){ const a=this.anim(); if(!a) return; this.time += dt; const raw=Math.floor(this.time * (a.fps||8)); if(a.loop){ this.frameIndex = raw % a.frames.length; } else { this.frameIndex = Math.min(a.frames.length-1, raw); this.done = raw >= a.frames.length; } }
  currentFrame(){ const a=this.anim(); return a.frames[this.frameIndex] || 0; }
  isHitFrame(){ const a=this.anim(); if(a.hit_frame === undefined) return false; return this.frameIndex >= a.hit_frame && !this.hitFired; }
  markHitFired(){ this.hitFired = true; }
  iframeActive(){ const a=this.anim(); return a.iframe_start !== undefined && this.frameIndex >= a.iframe_start && this.frameIndex <= a.iframe_end; }
  draw(ctx, image, x, y, facing=1, scale=1){
    if(!image){ return false; }
    const fw=this.meta.frame_w, fh=this.meta.frame_h, frame=this.currentFrame();
    if(image.width < fw || image.height < fh){ const h=190*scale, w=image.width/image.height*h; ctx.save(); ctx.translate(x,y); ctx.scale(facing,1); ctx.drawImage(image,-w*.48,-h,w,h); ctx.restore(); return true; }
    const cols=Math.floor(image.width/fw); const sx=(frame%cols)*fw, sy=Math.floor(frame/cols)*fh;
    ctx.save(); ctx.translate(x,y); ctx.scale(facing*scale, scale); ctx.drawImage(image,sx,sy,fw,fh,-fw/2,-fh,fw,fh); ctx.restore(); return true;
  }
}
window.AnimationPlayer = AnimationPlayer;
