import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  inject,
  signal,
  computed,
  PLATFORM_ID,
  HostListener,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

type AlgorithmType = 'kmeans' | 'Agglomerative' | 'DBSCAN';
type Point = [number, number];
type Mode = 'draw' | 'pan';

interface ClusterRequest {
  points: Point[];
  algorithm: AlgorithmType;
  k?: number;
  eps?: number;
  minSamples?: number;
}

interface ClusterResponse {
  centroids: Point[];
  labels: (number | null)[];
}

const COLOR_PALETTE = {
  points: [
    'bg-red-500',
    'bg-green-500',
    'bg-blue-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-emerald-500',
    'bg-fuchsia-500',
    'bg-orange-500',
  ],
  centroids: [
    'bg-red-700',
    'bg-green-700',
    'bg-blue-700',
    'bg-yellow-700',
    'bg-purple-700',
    'bg-pink-700',
    'bg-indigo-700',
    'bg-emerald-700',
    'bg-fuchsia-700',
    'bg-orange-700',
  ],
};

const STORAGE_KEYS = {
  POINTS: 'cluster-points',
  LABELS: 'cluster-labels',
  CENTROIDS: 'cluster-centroids',
  ALGORITHM: 'cluster-algorithm',
  CLUSTER_COUNT: 'cluster-count',
  EPS: 'cluster-eps',
  MIN_SAMPLES: 'cluster-min-samples',
} as const;

@Component({
  selector: 'app-clustering',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clustering.html',
  // Styles removed as requested
})
export class Clustering implements AfterViewInit, OnDestroy {
  @ViewChild('plotArea') plotAreaRef!: ElementRef<HTMLDivElement>;

  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  // --- Constants ---
  readonly LIMIT_MIN = -1000;
  readonly LIMIT_MAX = 1000;

  // --- UI State ---
  readonly width = signal(0);
  readonly height = signal(0);
  readonly cursorPosition = signal<Point | null>(null);
  readonly interactionMode = signal<Mode>('draw');

  // --- Clustering Config ---
  readonly selectedAlgorithm = signal<AlgorithmType>('kmeans');
  readonly clusterCount = signal(2);
  readonly eps = signal(0.5);
  readonly minSamples = signal(2);
  readonly pointSize = signal(8);
  readonly showBorder = signal(true);
  readonly deleteMode = signal(false);

  // --- Data State ---
  readonly points = signal<Point[]>([]);
  readonly centroids = signal<Point[]>([]);
  readonly labels = signal<(number | null)[]>([]);

  // --- View State ---
  readonly minX = signal(-10);
  readonly maxX = signal(10);
  readonly minY = signal(-10);
  readonly maxY = signal(10);

  // --- Internal ---
  readonly isDragging = signal(false);
  private lastMousePos = { x: 0, y: 0 };
  private resizeObserver: ResizeObserver | null = null;

  // --- Computed ---
  readonly isBrowser = computed(() => isPlatformBrowser(this.platformId));

  readonly xTicks = computed(() =>
    this.generateTicks(this.minX(), this.maxX())
  );
  readonly yTicks = computed(() =>
    this.generateTicks(this.minY(), this.maxY())
  );

  readonly pixelEps = computed(() => {
    if (this.width() === 0) return 0;
    const rangeX = this.maxX() - this.minX();
    const pixelsPerUnit = this.width() / rangeX;
    return this.eps() * pixelsPerUnit * 2;
  });

  private generateTicks(min: number, max: number): number[] {
    const range = max - min;
    if (range <= 0 || !isFinite(range)) return [];
    const targetTickCount = 5;
    const rawStep = range / targetTickCount;
    const mag = Math.floor(Math.log10(rawStep));
    const step =
      Math.pow(10, mag) * (Math.round(rawStep / Math.pow(10, mag)) || 1);
    if (step <= 0 || !isFinite(step)) return [];
    const start = Math.ceil(min / step) * step;
    const ticks = [];
    let safeGuard = 0;
    for (let i = start; i <= max; i += step) {
      if (safeGuard++ > 20) break;
      ticks.push(parseFloat(i.toPrecision(10)));
    }
    return ticks;
  }

  ngAfterViewInit(): void {
    if (this.isBrowser()) {
      this.loadFromLocalStorage();

      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            this.width.set(entry.contentRect.width);
            this.height.set(entry.contentRect.height);
          }
        }
      });
      this.resizeObserver.observe(this.plotAreaRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser()) {
      this.saveToLocalStorage();
      if (this.resizeObserver) this.resizeObserver.disconnect();
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onGlobalMouseMove(event: MouseEvent): void {
    if (!this.isDragging()) return;

    if (this.interactionMode() === 'pan') {
      const dx = event.clientX - this.lastMousePos.x;
      const dy = event.clientY - this.lastMousePos.y;
      const rangeX = this.maxX() - this.minX();
      const rangeY = this.maxY() - this.minY();
      const shiftX = (dx / this.width()) * rangeX;
      const shiftY = (dy / this.height()) * rangeY;

      let newMinX = this.minX() - shiftX;
      let newMaxX = this.maxX() - shiftX;
      let newMinY = this.minY() + shiftY;
      let newMaxY = this.maxY() + shiftY;

      if (newMinX < this.LIMIT_MIN) {
        const d = this.LIMIT_MIN - newMinX;
        newMinX += d;
        newMaxX += d;
      } else if (newMaxX > this.LIMIT_MAX) {
        const d = this.LIMIT_MAX - newMaxX;
        newMinX += d;
        newMaxX += d;
      }
      if (newMinY < this.LIMIT_MIN) {
        const d = this.LIMIT_MIN - newMinY;
        newMinY += d;
        newMaxY += d;
      } else if (newMaxY > this.LIMIT_MAX) {
        const d = this.LIMIT_MAX - newMaxY;
        newMinY += d;
        newMaxY += d;
      }

      this.minX.set(newMinX);
      this.maxX.set(newMaxX);
      this.minY.set(newMinY);
      this.maxY.set(newMaxY);
      this.lastMousePos = { x: event.clientX, y: event.clientY };
    } else if (
      this.interactionMode() === 'draw' &&
      this.isTargetInPlot(event.target)
    ) {
      this.handleDrawOrDelete(event);
    }
  }

  @HostListener('document:mouseup')
  onGlobalMouseUp(): void {
    this.isDragging.set(false);
  }

  onPlotMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    this.isDragging.set(true);
    this.lastMousePos = { x: event.clientX, y: event.clientY };

    if (this.interactionMode() === 'draw') {
      this.handleDrawOrDelete(event);
    }
  }

  onPlotMouseMoveLocal(event: MouseEvent): void {
    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();
    this.cursorPosition.set([
      this.toDataX(event.clientX - rect.left),
      this.toDataY(event.clientY - rect.top),
    ]);
  }

  onPlotLeave(): void {
    this.cursorPosition.set(null);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const dataX = this.toDataX(mouseX);
    const dataY = this.toDataY(mouseY);
    const zoom = event.deltaY > 0 ? 1.1 : 0.9;

    const newRangeX = (this.maxX() - this.minX()) * zoom;
    const newRangeY = (this.maxY() - this.minY()) * zoom;

    if (newRangeX < 0.00001 || newRangeY < 0.00001) return;

    const ratioX = mouseX / this.width();
    const ratioY = 1 - mouseY / this.height();

    let nextMinX = dataX - ratioX * newRangeX;
    let nextMaxX = dataX + (1 - ratioX) * newRangeX;
    let nextMinY = dataY - ratioY * newRangeY;
    let nextMaxY = dataY + (1 - ratioY) * newRangeY;

    if (nextMinX < this.LIMIT_MIN) nextMinX = this.LIMIT_MIN;
    if (nextMaxX > this.LIMIT_MAX) nextMaxX = this.LIMIT_MAX;
    if (nextMinY < this.LIMIT_MIN) nextMinY = this.LIMIT_MIN;
    if (nextMaxY > this.LIMIT_MAX) nextMaxY = this.LIMIT_MAX;

    this.minX.set(nextMinX);
    this.maxX.set(nextMaxX);
    this.minY.set(nextMinY);
    this.maxY.set(nextMaxY);
  }

  handleDrawOrDelete(event: MouseEvent): void {
    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();
    const x = this.toDataX(event.clientX - rect.left);
    const y = this.toDataY(event.clientY - rect.top);

    if (this.deleteMode()) {
      const pxThreshold = 20;
      const dataThresholdX =
        (pxThreshold / this.width()) * (this.maxX() - this.minX());

      let closestIndex = -1;
      let minDist = Infinity;

      this.points().forEach((p, i) => {
        const dist = Math.sqrt(Math.pow(p[0] - x, 2) + Math.pow(p[1] - y, 2));
        if (dist < dataThresholdX && dist < minDist) {
          minDist = dist;
          closestIndex = i;
        }
      });

      if (closestIndex !== -1) {
        this.points.update((pts) => pts.filter((_, i) => i !== closestIndex));
        this.labels.update((lbls) => lbls.filter((_, i) => i !== closestIndex));
      }
    } else {
      if (
        x >= this.LIMIT_MIN &&
        x <= this.LIMIT_MAX &&
        y >= this.LIMIT_MIN &&
        y <= this.LIMIT_MAX
      ) {
        this.points.update((pts) => [...pts, [x, y]]);
        this.labels.update((lbls) => [...lbls, null]);
      }
    }
  }

  private isTargetInPlot(target: any): boolean {
    return this.plotAreaRef.nativeElement.contains(target);
  }

  toScreenX(dataX: number): number {
    return ((dataX - this.minX()) / (this.maxX() - this.minX())) * this.width();
  }
  toScreenY(dataY: number): number {
    return (
      this.height() -
      ((dataY - this.minY()) / (this.maxY() - this.minY())) * this.height()
    );
  }
  toDataX(screenX: number): number {
    return this.minX() + (screenX / this.width()) * (this.maxX() - this.minX());
  }
  toDataY(screenY: number): number {
    return (
      this.maxY() - (screenY / this.height()) * (this.maxY() - this.minY())
    );
  }

  getPointColor(index: number): string {
    const label = this.labels()[index];
    if (label === null || label === undefined) return 'bg-gray-500';
    if (label === -1) return 'bg-gray-300';
    return COLOR_PALETTE.points[label % COLOR_PALETTE.points.length];
  }

  getCentroidColor(index: number): string {
    return (
      COLOR_PALETTE.centroids[index % COLOR_PALETTE.centroids.length] ||
      'bg-gray-700'
    );
  }

  performClustering(): void {
    if (this.points().length === 0) return;

    const request: ClusterRequest = {
      points: this.points(),
      algorithm: this.selectedAlgorithm(),
      ...(this.selectedAlgorithm() === 'DBSCAN'
        ? { eps: this.eps(), minSamples: this.minSamples() }
        : { k: this.clusterCount() }),
    };

    this.http
      .post<ClusterResponse>('http://127.0.0.1:8000/cluster', request)
      .subscribe({
        next: (response) => {
          this.centroids.set(response.centroids || []);
          this.labels.set(response.labels || []);
          this.saveToLocalStorage();
        },
        error: (err) => console.error(err),
      });
  }

  reset(): void {
    if (confirm('Clear all points?')) {
      this.points.set([]);
      this.labels.set([]);
      this.centroids.set([]);
      this.saveToLocalStorage();
    }
  }

  private loadFromLocalStorage(): void {
    const get = (k: string) => localStorage.getItem(k);
    const parse = (v: string | null) => (v ? JSON.parse(v) : []);

    if (get(STORAGE_KEYS.ALGORITHM))
      this.selectedAlgorithm.set(get(STORAGE_KEYS.ALGORITHM) as AlgorithmType);
    if (get(STORAGE_KEYS.CLUSTER_COUNT))
      this.clusterCount.set(Number(get(STORAGE_KEYS.CLUSTER_COUNT)));
    if (get(STORAGE_KEYS.EPS)) this.eps.set(Number(get(STORAGE_KEYS.EPS)));
    if (get(STORAGE_KEYS.MIN_SAMPLES))
      this.minSamples.set(Number(get(STORAGE_KEYS.MIN_SAMPLES)));

    this.points.set(parse(get(STORAGE_KEYS.POINTS)));
    this.labels.set(parse(get(STORAGE_KEYS.LABELS)));
    this.centroids.set(parse(get(STORAGE_KEYS.CENTROIDS)));
  }

  private saveToLocalStorage(): void {
    localStorage.setItem(STORAGE_KEYS.ALGORITHM, this.selectedAlgorithm());
    localStorage.setItem(
      STORAGE_KEYS.CLUSTER_COUNT,
      this.clusterCount().toString()
    );
    localStorage.setItem(STORAGE_KEYS.EPS, this.eps().toString());
    localStorage.setItem(
      STORAGE_KEYS.MIN_SAMPLES,
      this.minSamples().toString()
    );
    localStorage.setItem(STORAGE_KEYS.POINTS, JSON.stringify(this.points()));
    localStorage.setItem(STORAGE_KEYS.LABELS, JSON.stringify(this.labels()));
    localStorage.setItem(
      STORAGE_KEYS.CENTROIDS,
      JSON.stringify(this.centroids())
    );
  }
}
