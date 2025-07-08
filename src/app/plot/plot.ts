import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  signal,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-plot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plot.html',
  styleUrl: './plot.css',
})
export class Plot implements AfterViewInit {
  @ViewChild('plotArea') plotAreaRef!: ElementRef<HTMLDivElement>;
  private platformId = inject(PLATFORM_ID);
  width = 0;
  height = 0;
  selectedAlgorithm: 'kmeans' | 'Agglomerative' | 'DBSCAN' = 'kmeans';
  clusterCount = 2;
  eps = 0.5;
  minSamples = 2;
  points = signal<[number, number][]>([]);
  centroids = signal<[number, number][]>([]);
  labels: (number | null)[] = [];

  constructor(private http: HttpClient) {}

  ngAfterViewInit() {
    const el = this.plotAreaRef.nativeElement;
    this.width = el.offsetWidth;
    this.height = el.offsetHeight;

    if (isPlatformBrowser(this.platformId)) {
      this.loadFromLocalStorage();
    }
  }

  private loadFromLocalStorage() {
    const plotWidth = localStorage.getItem('plot-width');
    const plotHeight = localStorage.getItem('plot-height');
    const plotPoints = localStorage.getItem('plot-points');
    const plotLabels = localStorage.getItem('plot-labels');
    const plotCentroids = localStorage.getItem('plot-centroids');
    const plotAlgorithm = localStorage.getItem('plot-algorithm');
    const plotClusterCount = localStorage.getItem('plot-clusterCount');
    const plotEps = localStorage.getItem('plot-eps');
    const plotMinSamples = localStorage.getItem('plot-minSamples');

    if (plotWidth) this.width = parseInt(plotWidth, 10);
    if (plotHeight) this.height = parseInt(plotHeight, 10);
    if (plotAlgorithm) this.selectedAlgorithm = plotAlgorithm as any;
    if (plotClusterCount) this.clusterCount = parseInt(plotClusterCount, 10);
    if (plotEps) this.eps = parseFloat(plotEps);
    if (plotMinSamples) this.minSamples = parseInt(plotMinSamples, 10);

    if (plotLabels) {
      try {
        this.labels = JSON.parse(plotLabels);
      } catch (e) {
        console.error('Failed to parse plot labels from localStorage:', e);
        this.labels = [];
      }
    }

    if (plotPoints) {
      try {
        this.points.set(JSON.parse(plotPoints));
      } catch (e) {
        console.error('Failed to parse plot points from localStorage:', e);
        this.points.set([]);
      }
    }

    if (plotCentroids) {
      try {
        this.centroids.set(JSON.parse(plotCentroids));
      } catch (e) {
        console.error('Failed to parse plot centroids from localStorage:', e);
        this.centroids.set([]);
      }
    }
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      this.saveToLocalStorage();
    }
  }

  private saveToLocalStorage() {
    localStorage.setItem('plot-width', this.width.toString());
    localStorage.setItem('plot-height', this.height.toString());
    localStorage.setItem('plot-points', JSON.stringify(this.points()));
    localStorage.setItem('plot-labels', JSON.stringify(this.labels));
    localStorage.setItem('plot-centroids', JSON.stringify(this.centroids()));
    localStorage.setItem('plot-algorithm', this.selectedAlgorithm);
    localStorage.setItem('plot-clusterCount', this.clusterCount.toString());
    localStorage.setItem('plot-eps', this.eps.toString());
    localStorage.setItem('plot-minSamples', this.minSamples.toString());
  }

  getPosX([x]: [number, number]): number {
    return this.width / 2 + x * 5 - 6;
  }

  getPosY([, y]: [number, number]): number {
    return this.height / 2 + y * -5 - 6;
  }

  getColor(index: number): string {
    const label = this.labels?.[index];
    if (label === null || label === undefined) return 'bg-gray-600';

    const colors = [
      'bg-red-500',
      'bg-green-500',
      'bg-blue-500',
      'bg-yellow-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
    ];

    // Handle DBSCAN noise (label = -1)
    return label === -1 ? 'bg-gray-400' : colors[label % colors.length];
  }

  getCentroidColor(index: number): string {
    const colors = [
      'bg-red-700',
      'bg-green-700',
      'bg-blue-700',
      'bg-yellow-700',
      'bg-purple-700',
      'bg-pink-700',
      'bg-indigo-700',
    ];
    return colors[index % colors.length] || 'bg-gray-700';
  }

  onPlotClick(event: MouseEvent): void {
    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const x = (offsetX - this.width / 2 + 6) / 5;
    const y = -(offsetY - this.height / 2 + 6) / 5;

    this.points.set([...this.points(), [x, y]]);
    this.labels.push(null);
  }

  onReset(): void {
    this.points.set([]);
    this.centroids.set([]);
    this.labels = [];
    this.saveToLocalStorage();
  }

  onAlgorithmChange(event: Event): void {
    this.selectedAlgorithm = (event.target as HTMLSelectElement).value as any;
  }

  onClustering(): void {
    if (this.points().length === 0) return;

    const request: any = {
      points: this.points(),
      algorithm: this.selectedAlgorithm,
    };

    // Add algorithm-specific parameters
    if (this.selectedAlgorithm === 'DBSCAN') {
      request.eps = this.eps;
      request.minSamples = this.minSamples;
    } else {
      request.k = this.clusterCount;
    }

    this.http.post<any>('http://127.0.0.1:8000/cluster', request).subscribe({
      next: (response) => {
        this.centroids.set(response.centroids || []);
        this.labels = response.labels || [];
        this.saveToLocalStorage();
      },
      error: (error) => {
        console.error('Error during clustering:', error);
      },
    });
  }
}
