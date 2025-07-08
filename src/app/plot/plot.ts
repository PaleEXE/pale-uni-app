import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  WritableSignal,
  signal,
  PLATFORM_ID,
  inject,
} from '@angular/core';

@Component({
  selector: 'app-plot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plot.html',
  styleUrl: './plot.css',
})
export class Plot implements AfterViewInit {
  @ViewChild('plotArea') plotAreaRef!: ElementRef<HTMLDivElement>;

  private platformId = inject(PLATFORM_ID);
  width = 0;
  height = 0;

  clusterCount = 2;
  points: WritableSignal<[number, number][]> = signal([]);
  centroids: WritableSignal<[number, number][]> = signal([]);
  labels: (number | null)[] = [];

  constructor(private http: HttpClient) {}

  ngAfterViewInit() {
    const el = this.plotAreaRef.nativeElement;
    this.width = el.offsetWidth;
    this.height = el.offsetHeight;
    if (isPlatformBrowser(this.platformId)) {
      const plotWidth = localStorage.getItem('plot-width');
      const plotHeight = localStorage.getItem('plot-height');
      const plotPoints = localStorage.getItem('plot-points');
      const plotLabels = localStorage.getItem('plot-labels');
      if (plotLabels) {
        try {
          this.labels = JSON.parse(plotLabels);
        } catch (e) {
          console.error('Failed to parse plot labels from localStorage:', e);
        }
      } else {
        this.labels = [];
      }
      if (plotWidth) this.width = parseInt(plotWidth, 10);
      if (plotHeight) this.height = parseInt(plotHeight, 10);
      if (plotPoints) {
        try {
          this.points.set(JSON.parse(plotPoints));
        } catch (e) {
          console.error('Failed to parse plot points from localStorage:', e);
        }
      }
    }
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('plot-width', this.width.toString());
      localStorage.setItem('plot-height', this.height.toString());
      localStorage.setItem('plot-points', JSON.stringify(this.points()));
      localStorage.setItem('plot-labels', JSON.stringify(this.labels));
    }
  }

  getPosX([x]: [number, number]): number {
    return this.width / 2 + x * 5 - 6;
  }

  getPosY([, y]: [number, number]): number {
    return this.height / 2 + y * -5 - 6;
  }

  getColor(index: number): string {
    const label = this.labels?.[index];

    switch (label) {
      case 0:
        return 'bg-red-500';
      case 1:
        return 'bg-green-500';
      case 2:
        return 'bg-blue-500';
      case 3:
        return 'bg-yellow-500';
      case 4:
        return 'bg-purple-500';
      default:
        return 'bg-gray-600';
    }
  }

  getCentroidColor(index: number): string {
    switch (index) {
      case 0:
        return 'bg-red-500';
      case 1:
        return 'bg-green-500';
      case 2:
        return 'bg-blue-500';
      case 3:
        return 'bg-yellow-500';
      case 4:
        return 'bg-purple-500';
      default:
        return 'bg-gray-600';
    }
  }

  onPlotClick(event: MouseEvent): void {
    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();

    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    // Invert: x = (offsetX - width/2 + 6) / 5
    const x = (offsetX - this.width / 2 + 6) / 5;

    // Invert: y = -(offsetY - height/2 + 6) / 5
    const y = -(offsetY - this.height / 2 + 6) / 5;

    this.points.set([...this.points(), [x, y]]);
    this.labels.push(null);
  }

  onReset(): void {
    this.points.set([]);
    this.labels = [];
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('plot-points');
      localStorage.removeItem('plot-labels');
    }
  }

  renderPoints(): void {
    // Re-set the same points to trigger signal update
    this.points.set([...this.points()]);
  }

  onClustering(): void {
    this.http
      .post<any>('http://127.0.0.1:8000/cluster', {
        points: this.points(),
        k: this.clusterCount,
      })
      .subscribe({
        next: (response) => {
          this.centroids.set(response.centroids);
          this.labels = response.labels;

          this.renderPoints();

          console.log(this.labels);
          console.log(this.centroids());

          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('plot-points', JSON.stringify(this.points()));
            localStorage.setItem('plot-labels', JSON.stringify(this.labels));
            localStorage.setItem(
              'plot-centroids',
              JSON.stringify(this.centroids())
            );
          }
        },
        error: (error) => {
          console.error('Error during clustering:', error);
        },
      });
  }
}
