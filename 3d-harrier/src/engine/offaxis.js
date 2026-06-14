// Off-axis (asymmetric frustum) projection.
// Treats the screen as a fixed window at world z=0 with corners at (±W/2, ±H/2, 0).
// Camera = the viewer's eye. Asymmetric frustum keeps the screen edges
// locked to the physical screen edges no matter where the eye sits.
// This is what makes the head-tracked "window into a diorama" illusion work.

export function setOffAxisProjection(cam, eye, screenW, screenH, near, far) {
  const n = near;
  const dist = eye.z;
  const l = (-screenW / 2 - eye.x) * n / dist;
  const r = ( screenW / 2 - eye.x) * n / dist;
  const b = (-screenH / 2 - eye.y) * n / dist;
  const t = ( screenH / 2 - eye.y) * n / dist;
  cam.projectionMatrix.makePerspective(l, r, t, b, n, far);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.position.copy(eye);
  cam.quaternion.identity();
  cam.updateMatrixWorld();
}
