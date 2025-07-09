import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  inject,
  signal,
  PLATFORM_ID,
  OnDestroy,
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
export class Plot implements AfterViewInit, OnDestroy {
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
  isDrawing = false;
  deleteMode = false;
  Math = Math;

  // Store bound event handlers for cleanup
  private boundMouseMove = this.onDocumentMouseMove.bind(this);
  private boundMouseUp = this.onDocumentMouseUp.bind(this);

  constructor(private http: HttpClient) {}

  ngAfterViewInit() {
    const el = this.plotAreaRef.nativeElement;
    this.width = el.offsetWidth;
    this.height = el.offsetHeight;
    if (isPlatformBrowser(this.platformId)) this.loadFromLocalStorage();
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      this.saveToLocalStorage();
      // Clean up any remaining event listeners
      document.removeEventListener('mousemove', this.boundMouseMove);
      document.removeEventListener('mouseup', this.boundMouseUp);
    }
  }

  // --- Local Storage ---
  private loadFromLocalStorage() {
    const get = (key: string) => localStorage.getItem(key);
    if (get('plot-width')) this.width = parseInt(get('plot-width')!, 10);
    if (get('plot-height')) this.height = parseInt(get('plot-height')!, 10);
    if (get('plot-algorithm'))
      this.selectedAlgorithm = get('plot-algorithm') as any;
    if (get('plot-clusterCount'))
      this.clusterCount = parseInt(get('plot-clusterCount')!, 10);
    if (get('plot-eps')) this.eps = parseFloat(get('plot-eps')!);
    if (get('plot-minSamples'))
      this.minSamples = parseInt(get('plot-minSamples')!, 10);

    try {
      this.labels = JSON.parse(get('plot-labels') || '[]');
    } catch {
      this.labels = [];
    }
    try {
      this.points.set(JSON.parse(get('plot-points') || '[]'));
    } catch {
      this.points.set([]);
    }
    try {
      this.centroids.set(JSON.parse(get('plot-centroids') || '[]'));
    } catch {
      this.centroids.set([]);
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

  // --- Plotting Helpers ---
  getPosX([x]: [number, number]): number {
    return this.width / 2 + x - 4;
  }
  getPosY([, y]: [number, number]): number {
    return this.height / 2 - y - 4;
  }
  getPosBorderX([x]: [number, number]): number {
    return this.width / 2 + x - this.getSize() / 2;
  }
  getPosBorderY([, y]: [number, number]): number {
    return this.height / 2 - y - this.getSize() / 2;
  }
  getSize(): number {
    return this.eps * 4;
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
      'bg-emerald-500',
      'bg-fuchsia-500',
      'bg-orange-500',
    ];
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
      'bg-emerald-700',
      'bg-fuchsia-700',
      'bg-orange-700',
    ];
    return colors[index % colors.length] || 'bg-gray-700';
  }

  // --- Point Management ---
  private tryDeletePointAt(event: MouseEvent): void {
    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    let closestIndex = -1,
      minDistance = Infinity;

    this.points().forEach(([x, y]: number[], index: number) => {
      const dx = clickX - this.getPosX([x, y]);
      const dy = clickY - this.getPosY([x, y]);
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minDistance && distance < 20) {
        minDistance = distance;
        closestIndex = index;
      }
    });
    if (closestIndex >= 0) this.onDeletePoint(closestIndex);
  }

  private addPointFromMouseEvent(event: MouseEvent): void {
    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    // Check if the mouse is within the plot area bounds
    if (
      offsetX < 0 ||
      offsetX > this.width ||
      offsetY < 0 ||
      offsetY > this.height
    ) {
      return; // Don't add points outside the plot area
    }

    const x = offsetX - this.width / 2;
    const y = -(offsetY - this.height / 2);
    this.points.set([...this.points(), [x, y]]);
    this.labels.push(null);
  }

  onDeletePoint(index: number): void {
    const newPoints = [...this.points()];
    newPoints.splice(index, 1);
    this.points.set(newPoints);
    if (this.labels.length > index) this.labels.splice(index, 1);
    this.saveToLocalStorage();
  }

  toggleDeleteMode(): void {
    this.deleteMode = !this.deleteMode;
  }

  // --- Mouse Events ---
  onPlotClick(event: MouseEvent): void {
    if (this.deleteMode) this.tryDeletePointAt(event);
  }

  onPlotMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isDrawing = true;

    // Add document-level event listeners when drawing starts
    if (isPlatformBrowser(this.platformId)) {
      document.addEventListener('mousemove', this.boundMouseMove);
      document.addEventListener('mouseup', this.boundMouseUp);
    }

    if (this.deleteMode) {
      this.tryDeletePointAt(event);
    } else {
      this.addPointFromMouseEvent(event);
    }
  }

  onPlotMouseMove(event: MouseEvent): void {
    if (!this.isDrawing) return;
    if (this.deleteMode) {
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
    if (!this.isDrawing) return;

    if (this.deleteMode) {
      this.tryDeletePointAt(event);
    } else {
      this.addPointFromMouseEvent(event);
    }
  }

  private onDocumentMouseUp(): void {
    this.stopDrawing();
  }

  private stopDrawing(): void {
    this.isDrawing = false;

    // Remove document-level event listeners
    if (isPlatformBrowser(this.platformId)) {
      document.removeEventListener('mousemove', this.boundMouseMove);
      document.removeEventListener('mouseup', this.boundMouseUp);
    }
  }

  // --- UI Actions ---
  onReset(): void {
    if (confirm('Are you sure you want to delete all points?')) {
      this.points.set([]);
      this.centroids.set([]);
      this.labels = [];
      this.saveToLocalStorage();
    }
  }

  onAlgorithmChange(event: Event): void {
    this.selectedAlgorithm = (event.target as HTMLSelectElement).value as any;
  }

  onClustering(): void {
    if (this.points().length === 0) return;
    const request: any = {
      points: this.points(),
      algorithm: this.selectedAlgorithm,
      ...(this.selectedAlgorithm === 'DBSCAN'
        ? { eps: this.eps, minSamples: this.minSamples }
        : { k: this.clusterCount }),
    };
    this.http.post<any>('http://127.0.0.1:8000/cluster', request).subscribe({
      next: (response) => {
        this.centroids.set(response.centroids || []);
        this.labels = response.labels || [];
        this.saveToLocalStorage();
      },
      error: (error) => console.error('Error during clustering:', error),
    });
  }
}
