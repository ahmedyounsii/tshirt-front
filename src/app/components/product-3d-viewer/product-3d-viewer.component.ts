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

// Print zone of the 2D editor, normalized to the template image (0..1),
// plus the on-screen width of the image so editor pixels can be mapped to texture pixels
export type PrintArea = {
  left: number;
  top: number;
  width: number;
  height: number;
  imageDomWidth: number;
};

// Long side of the texture: the template is upscaled so designs and texts are drawn sharp
const TEXTURE_SIZE = 2048;
// Higher ratios cost a lot of GPU for no visible gain (antialias already smooths the edges)
const MAX_PIXEL_RATIO = 2;
const MAX_ANISOTROPY = 8;
// How much the sides of the shirt bend backwards
const CURVE_DEPTH = 0.35;

@Component({
  selector: 'app-product-3d-viewer',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './product-3d-viewer.component.html',
  styleUrl: './product-3d-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Product3dViewerComponent implements OnChanges, OnDestroy {
  @ViewChild('hostRef', { static: true }) hostRef!: ElementRef<HTMLDivElement>;

  @Input() templateUrl = '';
  @Input() designs: designObject[] = [];
  @Input() printArea: PrintArea | null = null;

  // True until the first texture is ready
  loading = signal(true);

  private renderer?: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private controls?: OrbitControls;
  private mesh?: THREE.Mesh;
  private material?: THREE.MeshStandardMaterial;
  private textureCanvas?: HTMLCanvasElement;
  private texture?: THREE.CanvasTexture;
  private bumpTexture?: THREE.Texture;
  private resizeObserver?: ResizeObserver;
  private frameId = 0;
  private drawToken = 0;
  private renderRequested = false;
  private imageCache = new Map<string, Promise<HTMLImageElement>>();
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
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO),
    );
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 0, 3.2);

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

  private resize() {
    const { clientWidth, clientHeight } = this.hostRef.nativeElement;
    if (!this.renderer || !clientWidth || !clientHeight) return;
    this.renderer.setSize(clientWidth, clientHeight);
    this.camera.aspect = clientWidth / clientHeight;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  // Composite template + designs into the texture, then (re)build the mesh if the template changed
  private async redraw() {
    if (!this.templateUrl) return;
    const token = ++this.drawToken;
    const base = await this.loadImage(this.templateUrl);
    await document.fonts?.ready;
    if (token !== this.drawToken) return;

    const maxSize = Math.min(
      TEXTURE_SIZE,
      this.renderer!.capabilities.maxTextureSize,
    );
    const scale = maxSize / Math.max(base.naturalWidth, base.naturalHeight);
    const width = Math.round(base.naturalWidth * scale);
    const height = Math.round(base.naturalHeight * scale);

    const canvas = (this.textureCanvas ??= document.createElement('canvas'));
    const sizeChanged = canvas.width !== width || canvas.height !== height;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(base, 0, 0, width, height);

    if (this.printArea) {
      // Designs only show where the shirt is (not on the transparent background)
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      for (const design of this.designs) {
        if (token !== this.drawToken) return;
        await this.drawDesign(ctx, design, this.printArea, width, height);
      }
      ctx.restore();
    }
    if (token !== this.drawToken) return;

    if (!this.mesh || sizeChanged) this.buildMesh(width / height);
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

    this.material ??= new THREE.MeshStandardMaterial({
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0,
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

  private async drawDesign(
    ctx: CanvasRenderingContext2D,
    design: designObject,
    area: PrintArea,
    texWidth: number,
    texHeight: number,
  ) {
    // Editor pixel -> texture pixel
    const s = texWidth / area.imageDomWidth;
    const originX = area.left * texWidth + design.left * s;
    const originY = area.top * texHeight + design.top * s;

    if (design.type === 'text' && design.text) {
      this.drawText(ctx, design, originX, originY, s);
      return;
    }
    if (!design.url) return;
    let img: HTMLImageElement;
    try {
      img = await this.loadImage(design.url);
    } catch {
      return;
    }
    // Same as max-width/max-height: 100% + object-fit: contain inside the design box
    const fit = Math.min(
      1,
      design.width / img.naturalWidth,
      design.height / img.naturalHeight,
    );
    const w = img.naturalWidth * fit * s;
    const h = img.naturalHeight * fit * s;
    const boxW = design.width * s;
    const boxH = design.height * s;
    this.withTransform(
      ctx,
      design,
      originX + boxW / 2,
      originY + boxH / 2,
      () => ctx.drawImage(img, -w / 2, -h / 2, w, h),
    );
  }

  private drawText(
    ctx: CanvasRenderingContext2D,
    design: designObject,
    originX: number,
    originY: number,
    s: number,
  ) {
    const text = design.text!;
    const fontSize = text.fontSize * s;
    const lineHeight = fontSize * 1.2;
    const lines = text.content.split('\n');

    ctx.save();
    ctx.font = `${text.italic ? 'italic ' : ''}${text.bold ? 700 : 400} ${fontSize}px ${text.fontFamily}`;
    if ('letterSpacing' in ctx) {
      (ctx as any).letterSpacing = `${text.letterSpacing * s}px`;
    }
    const lineWidths = lines.map((line: any) => ctx.measureText(line).width);
    const blockW = Math.max(...lineWidths, 0);
    const blockH = lines.length * lineHeight;
    // The editor box has a 2px 4px padding around the text
    const centerX = originX + 4 * s + blockW / 2;
    const centerY = originY + 2 * s + blockH / 2;

    this.withTransform(ctx, design, centerX, centerY, () => {
      ctx.fillStyle = text.color;
      ctx.strokeStyle = text.color;
      ctx.textBaseline = 'middle';
      lines.forEach((line: any, i: any) => {
        const lineW = lineWidths[i];
        let x = -blockW / 2;
        if (text.align === 'center') x += (blockW - lineW) / 2;
        if (text.align === 'right') x += blockW - lineW;
        const y = -blockH / 2 + lineHeight * (i + 0.5);
        ctx.fillText(line, x, y);
        if (text.underline) {
          ctx.lineWidth = Math.max(1, fontSize / 15);
          ctx.beginPath();
          ctx.moveTo(x, y + fontSize * 0.45);
          ctx.lineTo(x + lineW, y + fontSize * 0.45);
          ctx.stroke();
        }
      });
    });
    ctx.restore();
  }

  // Rotation and flips are applied around the center, like the CSS transform in the editor
  private withTransform(
    ctx: CanvasRenderingContext2D,
    design: designObject,
    centerX: number,
    centerY: number,
    draw: () => void,
  ) {
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(((design.rotation || 0) * Math.PI) / 180);
    ctx.scale(design.flipX ? -1 : 1, design.flipY ? -1 : 1);
    draw();
    ctx.restore();
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    let promise = this.imageCache.get(url);
    if (!promise) {
      promise = new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
      promise.catch(() => this.imageCache.delete(url));
      this.imageCache.set(url, promise);
    }
    return promise;
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
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}
