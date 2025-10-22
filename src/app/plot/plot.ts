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
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

// Types and constants for better type safety
type AlgorithmType = 'kmeans' | 'Agglomerative' | 'DBSCAN';
type Point = [number, number];

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

// Constants
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
  WIDTH: 'plot-width',
  HEIGHT: 'plot-height',
  POINTS: 'plot-points',
  LABELS: 'plot-labels',
  CENTROIDS: 'plot-centroids',
  ALGORITHM: 'plot-algorithm',
  CLUSTER_COUNT: 'plot-clusterCount',
  EPS: 'plot-eps',
  MIN_SAMPLES: 'plot-minSamples',
} as const;

@Component({
  selector: 'app-plot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plot.html',
  styleUrl: './plot.css',
})
export class Plot implements AfterViewInit, OnDestroy {
  @ViewChild('plotArea') plotAreaRef!: ElementRef<HTMLDivElement>;

  // Dependency injection
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  // State signals
  readonly width = signal(0);
  readonly height = signal(0);
  readonly points = signal<Point[]>([]);
  readonly centroids = signal<Point[]>([]);
  readonly labels = signal<(number | null)[]>([]);

  // UI state
  readonly selectedAlgorithm = signal<AlgorithmType>('kmeans');
  readonly clusterCount = signal(2);
  readonly eps = signal(0.5);
  readonly minSamples = signal(2);
  readonly isDrawing = signal(false);
  readonly deleteMode = signal(false);
  readonly pointSize = signal(8);
  readonly showBorder = signal(true);

  // Computed values
  readonly borderSize = computed(() => this.eps() * 4);
  readonly isBrowser = computed(() => isPlatformBrowser(this.platformId));

  // Event handlers with proper typing
  private readonly boundMouseMove = this.onDocumentMouseMove.bind(this);
  private readonly boundMouseUp = this.onDocumentMouseUp.bind(this);

  // Expose Math for template
  readonly Math = Math;

  ngAfterViewInit(): void {
    const element = this.plotAreaRef.nativeElement;
    this.width.set(element.offsetWidth);
    this.height.set(element.offsetHeight);

    if (this.isBrowser()) {
      this.loadFromLocalStorage();
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser()) {
      this.saveToLocalStorage();
      this.cleanupEventListeners();
    }
  }

  // --- Local Storage Management ---
  private loadFromLocalStorage(): void {
    const getItem = (key: string): string | null => localStorage.getItem(key);
    const parseNumber = (value: string | null): number =>
      value ? Number(value) : 0;
    const parseArray = <T>(value: string | null): T[] => {
      try {
        return value ? JSON.parse(value) : [];
      } catch {
        return [];
      }
    };

    const algorithm = getItem(STORAGE_KEYS.ALGORITHM) as AlgorithmType;
    if (algorithm) this.selectedAlgorithm.set(algorithm);

    this.width.set(parseNumber(getItem(STORAGE_KEYS.WIDTH)) || this.width());
    this.height.set(parseNumber(getItem(STORAGE_KEYS.HEIGHT)) || this.height());
    this.clusterCount.set(
      parseNumber(getItem(STORAGE_KEYS.CLUSTER_COUNT)) || this.clusterCount()
    );
    this.eps.set(parseNumber(getItem(STORAGE_KEYS.EPS)) || this.eps());
    this.minSamples.set(
      parseNumber(getItem(STORAGE_KEYS.MIN_SAMPLES)) || this.minSamples()
    );

    this.labels.set(parseArray<number | null>(getItem(STORAGE_KEYS.LABELS)));
    this.points.set(parseArray<Point>(getItem(STORAGE_KEYS.POINTS)));
    this.centroids.set(parseArray<Point>(getItem(STORAGE_KEYS.CENTROIDS)));
  }

  private saveToLocalStorage(): void {
    const setItem = (key: string, value: string): void => {
      localStorage.setItem(key, value);
    };

    setItem(STORAGE_KEYS.WIDTH, this.width().toString());
    setItem(STORAGE_KEYS.HEIGHT, this.height().toString());
    setItem(STORAGE_KEYS.POINTS, JSON.stringify(this.points()));
    setItem(STORAGE_KEYS.LABELS, JSON.stringify(this.labels()));
    setItem(STORAGE_KEYS.CENTROIDS, JSON.stringify(this.centroids()));
    setItem(STORAGE_KEYS.ALGORITHM, this.selectedAlgorithm());
    setItem(STORAGE_KEYS.CLUSTER_COUNT, this.clusterCount().toString());
    setItem(STORAGE_KEYS.EPS, this.eps().toString());
    setItem(STORAGE_KEYS.MIN_SAMPLES, this.minSamples().toString());
  }

  // --- Plotting Helpers ---
  getPointPosition([x, y]: Point): { x: number; y: number } {
    return {
      x: this.width() / 2 + x - this.pointSize() / 2,
      y: this.height() / 2 - y - this.pointSize() / 2,
    };
  }

  getPointBorderPosition([x, y]: Point): { x: number; y: number } {
    const size = this.borderSize() / 2;
    return {
      x: this.width() / 2 + x - size,
      y: this.height() / 2 - y - size,
    };
  }

  getPointColor(index: number): string {
    const label = this.labels()[index];

    if (label === null || label === undefined) {
      return 'bg-gray-600';
    }

    if (label === -1) {
      return 'bg-gray-400';
    }

    return COLOR_PALETTE.points[label % COLOR_PALETTE.points.length];
  }

  getCentroidColor(index: number): string {
    return (
      COLOR_PALETTE.centroids[index % COLOR_PALETTE.centroids.length] ||
      'bg-gray-700'
    );
  }

  // --- Point Management ---
  private tryDeletePointAt(event: MouseEvent): void {
    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const closestIndex = this.findClosestPointIndex(clickX, clickY, 20);

    if (closestIndex >= 0) {
      this.deletePoint(closestIndex);
    }
  }

  private findClosestPointIndex(
    targetX: number,
    targetY: number,
    maxDistance: number
  ): number {
    let closestIndex = -1;
    let minDistance = Infinity;

    this.points().forEach((point: Point, index: number) => {
      const { x, y } = this.getPointPosition(point);
      const distance = Math.sqrt((targetX - x) ** 2 + (targetY - y) ** 2);

      if (distance < minDistance && distance < maxDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    return closestIndex;
  }

  private addPointFromMouseEvent(event: MouseEvent): void {
    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    if (!this.isPointInBounds(offsetX, offsetY)) {
      return;
    }

    const x = offsetX - this.width() / 2;
    const y = -(offsetY - this.height() / 2);

    this.points.update((points) => [...points, [x, y]]);
    this.labels.update((labels) => [...labels, null]);
  }

  private isPointInBounds(x: number, y: number): boolean {
    return x >= 0 && x <= this.width() && y >= 0 && y <= this.height();
  }

  deletePoint(index: number): void {
    this.points.update((points) => points.filter((_, i) => i !== index));
    this.labels.update((labels) => labels.filter((_, i) => i !== index));
    this.saveToLocalStorage();
  }

  toggleDeleteMode(): void {
    this.deleteMode.update((mode) => !mode);
  }

  // --- Mouse Events ---
  onPlotClick(event: MouseEvent): void {
    if (this.deleteMode()) {
      this.tryDeletePointAt(event);
    }
  }

  onPlotMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isDrawing.set(true);
    this.setupEventListeners();

    if (this.deleteMode()) {
      this.tryDeletePointAt(event);
    } else {
      this.addPointFromMouseEvent(event);
    }
  }

  onPlotMouseMove(event: MouseEvent): void {
    if (!this.isDrawing()) return;

    if (this.deleteMode()) {
      this.tryDeletePointAt(event);
    } else {
      this.addPointFromMouseEvent(event);
    }
  }

  onPlotMouseUp(): void {
    this.stopDrawing();
  }

  // Document-level mouse events
  private onDocumentMouseMove(event: MouseEvent): void {
    if (!this.isDrawing()) return;

    if (this.deleteMode()) {
      this.tryDeletePointAt(event);
    } else {
      this.addPointFromMouseEvent(event);
    }
  }

  private onDocumentMouseUp(): void {
    this.stopDrawing();
  }

  private setupEventListeners(): void {
    if (this.isBrowser()) {
      document.addEventListener('mousemove', this.boundMouseMove);
      document.addEventListener('mouseup', this.boundMouseUp);
    }
  }

  private cleanupEventListeners(): void {
    if (this.isBrowser()) {
      document.removeEventListener('mousemove', this.boundMouseMove);
      document.removeEventListener('mouseup', this.boundMouseUp);
    }
  }

  private stopDrawing(): void {
    this.isDrawing.set(false);
    this.cleanupEventListeners();
  }

  // --- UI Actions ---
  reset(): void {
    if (confirm('Are you sure you want to delete all points?')) {
      this.points.set([]);
      this.centroids.set([]);
      this.labels.set([]);
      this.saveToLocalStorage();
    }
  }

  onAlgorithmChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedAlgorithm.set(target.value as AlgorithmType);
  }

  performClustering(): void {
    if (this.points().length === 0) {
      return;
    }

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
        next: (response: ClusterResponse) => {
          this.centroids.set(response.centroids || []);
          this.labels.set(response.labels || []);
          this.saveToLocalStorage();
        },
        error: (error: Error) => {
          console.error('Error during clustering: ', error);
        },
      });
  }
}
