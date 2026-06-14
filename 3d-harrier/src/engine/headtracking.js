import * as THREE from 'three';
import { FilesetResolver, FaceLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/vision_bundle.mjs';

const IPD_CM = 6.3;
const CAM_HFOV_DEG = 65;
const CAM_HFOV_RAD = CAM_HFOV_DEG * Math.PI / 180;

export class HeadTracker {
  constructor(videoEl) {
    this.video = videoEl;
    this.landmarker = null;
    this.active = false;
    this.lastVideoTime = -1;

    this.headTarget = new THREE.Vector3(0, 0, 50);
    this.headSmooth = new THREE.Vector3(0, 0, 50);
    this.offset = new THREE.Vector3(0, 0, 0);

    this.hasFace = false;
    this.autoOrbit = false;
    // Defaults tuned for gameplay: subtle window-effect, not a wild camera swing.
    // Standalone-demo callers can crank these back up via setSensitivity().
    this.sensitivity = 1.0;
    this.smoothing = 0.22;
    this.cameraToScreenCenterY = 9;
    this.pendingCalibrate = false;
  }

  async start() {
    const fileset = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm'
    );
    this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numFaces: 1
    });
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false
    });
    this.video.srcObject = stream;
    await new Promise(res => this.video.onloadedmetadata = res);
    await this.video.play();
    this.active = true;
  }

  calibrate() { this.pendingCalibrate = true; }
  setAutoOrbit(on) { this.autoOrbit = on; }
  setSensitivity(v) { this.sensitivity = v; }
  setSmoothing(v) { this.smoothing = v; }
  setScreenH(cm) { this.cameraToScreenCenterY = cm / 2; }

  update(now) {
    if (this.autoOrbit) {
      const t = now * 0.001;
      const g = this.sensitivity;
      this.headTarget.set(
        18 * g * Math.sin(t * 0.45),
        6 * g * Math.sin(t * 0.31 + 1.1),
        50 + 8 * Math.sin(t * 0.23 + 2.0)
      );
      this.hasFace = true;
    } else {
      this.estimateFromVideo();
    }
    const s = (this.hasFace || this.autoOrbit) ? this.smoothing : 0.05;
    this.headSmooth.lerp(this.headTarget, s);
  }

  estimateFromVideo() {
    if (!this.landmarker || !this.active || this.video.readyState < 2) return;
    if (this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;

    const res = this.landmarker.detectForVideo(this.video, performance.now());
    if (!res.faceLandmarks || res.faceLandmarks.length === 0) {
      this.hasFace = false;
      return;
    }
    this.hasFace = true;
    const lm = res.faceLandmarks[0];
    const rEye = lm[33], lEye = lm[263];
    const cx = (rEye.x + lEye.x) / 2;
    const cy = (rEye.y + lEye.y) / 2;
    const vw = this.video.videoWidth, vh = this.video.videoHeight;
    const dx = (rEye.x - lEye.x) * vw;
    const dy = (rEye.y - lEye.y) * vh;
    const eyeDistPx = Math.hypot(dx, dy);
    const depth_cm = (IPD_CM * vw) / (eyeDistPx * 2 * Math.tan(CAM_HFOV_RAD / 2));
    const px = (cx - 0.5) * vw;
    const py = (cy - 0.5) * vh;
    const cmPerPx = (2 * depth_cm * Math.tan(CAM_HFOV_RAD / 2)) / vw;
    let hx = -px * cmPerPx * this.sensitivity;
    let hy = -py * cmPerPx * this.sensitivity - this.cameraToScreenCenterY;

    if (this.pendingCalibrate) {
      this.offset.x = hx;
      this.offset.y = hy;
      this.pendingCalibrate = false;
    }

    const depth = Math.max(20, Math.min(120, depth_cm));
    this.headTarget.set(hx - this.offset.x, hy - this.offset.y, depth);
  }

  get eye() { return this.headSmooth; }
}
