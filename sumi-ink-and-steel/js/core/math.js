window.Math2 = {
  clamp: (v,a,b) => Math.max(a, Math.min(b, v)),
  rand: (a,b) => a + Math.random() * (b-a),
  approach: (v,target,step) => v < target ? Math.min(target, v + step) : Math.max(target, v - step),
  rectsOverlap: (a,b) => a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y,
  deepMerge(base, override){
    const out = Array.isArray(base) ? [...base] : {...base};
    for(const [k,v] of Object.entries(override || {})){
      if(v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = Math2.deepMerge(out[k], v);
      else out[k] = v;
    }
    return out;
  }
};
window.clamp = Math2.clamp; window.rand = Math2.rand; window.approach = Math2.approach; window.rectsOverlap = Math2.rectsOverlap;
