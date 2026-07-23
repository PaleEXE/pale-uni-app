import {
  Component,
  ViewChild,
  inject,
  signal,
  computed,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { PageLayoutComponent } from '../components/page-layout/page-layout';
import { SidebarPanelComponent } from '../components/sidebar-panel/sidebar-panel';
import { ModeToggleComponent } from '../components/mode-toggle/mode-toggle';
import { PlotCanvasComponent } from '../components/plot-canvas/plot-canvas';

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
  imports: [
    CommonModule,
    FormsModule,
    PageLayoutComponent,
    SidebarPanelComponent,
    ModeToggleComponent,
    PlotCanvasComponent,
  ],
  templateUrl: './clustering.html',
})
export class Clustering {
  @ViewChild('canvas') canvas!: PlotCanvasComponent;

  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  // --- UI State ---
  readonly interactionMode = signal<Mode>('draw');
  readonly deleteMode = signal(false);

  // --- Clustering Config ---
  readonly selectedAlgorithm = signal<AlgorithmType>('kmeans');
  readonly clusterCount = signal(2);
  readonly eps = signal(0.5);
  readonly minSamples = signal(2);
  readonly pointSize = signal(8);
  readonly showBorder = signal(true);

  // --- Data State ---
  readonly points = signal<Point[]>([]);
  readonly centroids = signal<Point[]>([]);
  readonly labels = signal<(number | null)[]>([]);

  readonly isBrowser = computed(() => isPlatformBrowser(this.platformId));

  ngAfterViewInit(): void {
    if (this.isBrowser()) {
      this.loadFromLocalStorage();
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser()) {
      this.saveToLocalStorage();
    }
  }

  pixelEps(): number {
    if (!this.canvas) return 0;
    const w = this.canvas.width();
    if (w === 0) return 0;
    const rangeX = this.canvas.maxX() - this.canvas.minX();
    const pixelsPerUnit = w / rangeX;
    return this.eps() * pixelsPerUnit * 2;
  }

  handlePlotClick(point: Point): void {
    const [x, y] = point;
    if (this.deleteMode()) {
      const pxThreshold = 20;
      const dataThresholdX =
        (pxThreshold / this.canvas.width()) * (this.canvas.maxX() - this.canvas.minX());

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
        x >= this.canvas.LIMIT_MIN &&
        x <= this.canvas.LIMIT_MAX &&
        y >= this.canvas.LIMIT_MIN &&
        y <= this.canvas.LIMIT_MAX
      ) {
        this.points.update((pts) => [...pts, [x, y]]);
        this.labels.update((lbls) => [...lbls, null]);
      }
    }
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
