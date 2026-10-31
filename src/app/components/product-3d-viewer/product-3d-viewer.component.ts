import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  signal,
  ViewChild,
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { designObject } from '../../models/design-object.model';
import { TranslatePipe } from '@ngx-translate/core';
import { PrintArea, ProductComposer } from './compose-product';
import { downloadCanvas } from '../../shared/download-canvas';

// Long side of the texture: the template is upscaled so designs and texts are drawn sharp
const TEXTURE_SIZE = 2048;
// Higher ratios cost a lot of GPU for no visible gain (antialias already smooths the edges)
const MAX_PIXEL_RATIO = 2;
const MAX_ANISOTROPY = 8;
// How much the sides of the shirt bend backwards
const CURVE_DEPTH = 0.35;
// Empty space kept around the shirt when the camera frames it
const FIT_PADDING = 1.08;

@Component({
    selector: 'app-product-3d-viewer',
    imports: [TranslatePipe],
    templateUrl: './product-3d-viewer.component.html',
    styleUrl: './product-3d-viewer.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class Product3dViewerComponent implements OnChanges, OnDestroy {
  @ViewChild('hostRef', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  @Input() templateUrl = '';
  @Input() designs: designObject[] = [];
  @Input() printArea: PrintArea | null = null;

  // True until the first texture is ready
  loading = signal(true);
  // The browser has no WebGL (disabled, or the GPU is out of memory)
  failed = signal(false);

  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private controls?: OrbitControls;
  private mesh?: THREE.Mesh;
  // Width / height of the shirt plane (its height is always 2)
  private meshAspect = 1;
  private material?: THREE.MeshLambertMaterial;
  private textureCanvas?: HTMLCanvasElement;
  private texture?: THREE.CanvasTexture;
  private bumpTexture?: THREE.Texture;
  private resizeObserver?: ResizeObserver;
  private frameId = 0;
  private drawToken = 0;
  private renderRequested = false;
  private composer = new ProductComposer();
  private zone = inject(NgZone);

  constructor() {
    // WebGL only exists in the browser (the app is also rendered on the server)
    // Outside Angular: the render loop and the controls events don't need change detection
    afterNextRender(() => this.zone.runOutsideAngular(() => this.init()));
  }

  ngOnChanges(): void {
    if (this.renderer) this.zone.runOutsideAngular(() => this.redraw());
  }

  private init() {
    const host = this.hostRef.nativeElement;
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      console.warn('The 3D view needs WebGL', err);
      this.loading.set(false);
      this.failed.set(true);
      return;
    }
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 0, 1);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.8;
    this.controls.maxDistance = 5;
    // The template only has a front side: keep the camera in front of it
    // ±20° left/right
    this.controls.minAzimuthAngle = -Math.PI / 9;
    this.controls.maxAzimuthAngle = Math.PI / 9;
    this.controls.minPolarAngle = Math.PI / 3;
    this.controls.maxPolarAngle = (2 * Math.PI) / 3;
    // Also fired by update() while the damping is still moving the camera
    this.controls.addEventListener('change', this.requestRender);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(1.5, 2, 3);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.5);
    fill.position.set(-2, -1, 2);
    this.scene.add(fill);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();

    this.redraw();
  }

  // Renders on demand instead of every frame: nothing moves unless the user drags or the texture changes
  private requestRender = () => {
    if (this.renderRequested) return;
    this.renderRequested = true;
    this.frameId = requestAnimationFrame(() => {
      this.renderRequested = false;
      this.controls?.update();
      this.renderer?.render(this.scene, this.camera);
    });
  };

  // Saves the current view (angle + zoom) as a transparent PNG
  downloadPng(fileName = 'product-3d.png') {
    if (!this.renderer || this.loading()) return;
    // The WebGL buffer is cleared once displayed: render a fresh frame and read it in the same task
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
    downloadCanvas(this.renderer.domElement, fileName);
  }

  private resize() {
    const { clientWidth, clientHeight } = this.hostRef.nativeElement;
    if (!this.renderer || !clientWidth || !clientHeight) return;
    this.renderer.setSize(clientWidth, clientHeight);
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.fitCamera();
    this.requestRender();
  }

  // Distance at which the whole shirt fits the viewport: on narrow (mobile) screens the width is the limit
  private fitCamera() {
    if (!this.controls) return;
    const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const fitHeight = 1 / tanHalfFov;
    const fitWidth = this.meshAspect / (tanHalfFov * this.camera.aspect);
    const distance = Math.max(fitHeight, fitWidth) * FIT_PADDING;
    this.controls.maxDistance = Math.max(5, distance * 1.5);
    // Keep the current viewing angle, only change the zoom
    this.camera.position.setLength(distance);
    this.controls.update();
  }

  // Composite template + designs into the texture, then (re)build the mesh if the template changed
  private async redraw() {
    if (!this.templateUrl) return;
    const token = ++this.drawToken;
    const canvas = (this.textureCanvas ??= document.createElement('canvas'));
    const { width, height } = canvas;
    const base = await this.composer.compose(
      canvas,
      {
        templateUrl: this.templateUrl,
        designs: this.designs,
        printArea: this.printArea,
      },
      Math.min(TEXTURE_SIZE, this.renderer!.capabilities.maxTextureSize),
      () => token !== this.drawToken,
    );
    if (!base) return;
    const sizeChanged = canvas.width !== width || canvas.height !== height;

    if (!this.mesh || sizeChanged) this.buildMesh(canvas.width / canvas.height);
    this.updateBumpMap(base);
    this.texture!.needsUpdate = true;
    this.requestRender();
    // Back in Angular: loading is shown by the template
    this.zone.run(() => this.loading.set(false));
  }

  private buildMesh(aspect: number) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    this.texture?.dispose();
    this.texture = new THREE.CanvasTexture(this.textureCanvas!);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = Math.min(
      this.renderer!.capabilities.getMaxAnisotropy(),
      MAX_ANISOTROPY,
    );
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = true;

    // Subdivided plane bent like a cylinder so the flat template gets volume
    this.meshAspect = aspect;
    this.fitCamera();
    const geometry = new THREE.PlaneGeometry(2 * aspect, 2, 96, 96);
    const position = geometry.attributes['position'];
    const halfWidth = aspect;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) / halfWidth;
      const y = position.getY(i);
      // Strong curve on the sides, light curve on the height (chest/belly)
      position.setZ(i, -CURVE_DEPTH * x * x - 0.06 * y * y);
    }
    geometry.computeVertexNormals();

    // Lambert = diffuse only: a PBR material always adds a ~4% specular reflection,
    // invisible on white but it turns black fabric into dark grey compared to the 2D template
    this.material ??= new THREE.MeshLambertMaterial({
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
    });
    this.material.map = this.texture;
    this.material.needsUpdate = true;

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }

  // The template photo already contains the fabric folds: reuse it as a bump map for relief
  private updateBumpMap(base: HTMLImageElement) {
    if (this.bumpTexture?.image === base) return;
    this.bumpTexture?.dispose();
    this.bumpTexture = new THREE.Texture(base);
    this.bumpTexture.needsUpdate = true;
    this.material!.bumpMap = this.bumpTexture;
    // Subtle: a strong bump on an upscaled photo looks grainy
    this.material!.bumpScale = 0.4;
    this.material!.needsUpdate = true;
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    this.controls?.removeEventListener('change', this.requestRender);
    this.controls?.dispose();
    this.mesh?.geometry.dispose();
    this.material?.dispose();
    this.texture?.dispose();
    this.bumpTexture?.dispose();
    // Gives the context back now: the browser only allows a few at once
    this.renderer?.forceContextLoss();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
