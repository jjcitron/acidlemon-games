class Camera {
  constructor(viewportW, viewportH, worldW, worldH){ this.viewportW=viewportW; this.viewportH=viewportH; this.worldW=worldW; this.worldH=worldH; this.x=0; this.y=0; }
  update(target, dt=1/60){
    const marginX=this.viewportW*.25; let desiredX=this.x;
    if(target.x-this.x > this.viewportW-marginX) desiredX=target.x-(this.viewportW-marginX);
    if(target.x-this.x < marginX) desiredX=target.x-marginX;
    desiredX=clamp(desiredX,0,Math.max(0,this.worldW-this.viewportW));
    const marginY=this.viewportH*.28; let desiredY=this.y;
    if(target.y-this.y > this.viewportH-marginY) desiredY=target.y-(this.viewportH-marginY);
    if(target.y-this.y < marginY) desiredY=target.y-marginY;
    desiredY=clamp(desiredY,0,Math.max(0,(this.worldH||this.viewportH)-this.viewportH));
    const k=Math.min(1,dt*8); this.x += (desiredX-this.x)*k; this.y += (desiredY-this.y)*k;
  }
  applyTo(ctx){ ctx.translate(-this.x,-this.y); }
  screenX(worldX){ return worldX-this.x; }
  screenY(worldY){ return worldY-this.y; }
}
window.Camera = Camera;
