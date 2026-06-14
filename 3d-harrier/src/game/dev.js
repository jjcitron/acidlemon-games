export const DEV = (() => {
  const params = new URLSearchParams(window.location.search);
  const enabled = ['1', 'true', 'yes'].includes((params.get('dev') || '').toLowerCase());
  const startStage = Number(params.get('stage') || 0) || null;
  return {
    enabled,
    startStage,
    invulnerable: enabled && params.get('invulnerable') === '1',
    fastStageClear: enabled && params.get('fastClear') === '1',
    showHitSpheres: enabled && params.get('hitSpheres') === '1',
    qaSeconds: enabled ? Math.max(0, Number(params.get('qaSeconds') || 0) || 0) : 0
  };
})();
