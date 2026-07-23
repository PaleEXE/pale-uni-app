import {
  Component,
  ViewChild,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PageLayoutComponent } from '../components/page-layout/page-layout';
import { SidebarPanelComponent } from '../components/sidebar-panel/sidebar-panel';
import { ModeToggleComponent } from '../components/mode-toggle/mode-toggle';
import { PlotCanvasComponent } from '../components/plot-canvas/plot-canvas';

type Point = [number, number];
type Mode = 'draw' | 'pan';

@Component({
  selector: 'app-linear-regression',
  standalone: true,
  templateUrl: './linear-regression.html',
  styles: [],
  imports: [
    CommonModule,
    FormsModule,
    PageLayoutComponent,
    SidebarPanelComponent,
    ModeToggleComponent,
    PlotCanvasComponent,
  ],
})
export class LinearRegression {
  @ViewChild('canvas') canvas!: PlotCanvasComponent;

  // --- State ---
  readonly showResiduals = signal(true);
  readonly interactionMode = signal<Mode>('draw');

  readonly points = signal<Point[]>([]);

  // --- Regression Math ---
  readonly regressionStats = computed(() => {
    const pts = this.points();
    if (pts.length < 2) return { slope: 0, intercept: 0, mse: 0, valid: false };

    const n = pts.length;
    const sumX = pts.reduce((acc, p) => acc + p[0], 0);
    const sumY = pts.reduce((acc, p) => acc + p[1], 0);
    const sumXY = pts.reduce((acc, p) => acc + p[0] * p[1], 0);
    const sumX2 = pts.reduce((acc, p) => acc + p[0] * p[0], 0);

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0)
      return { slope: 0, intercept: 0, mse: 0, valid: false };

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    const sumSquaredErrors = pts.reduce((acc, [x, y]) => {
      const predicted = slope * x + intercept;
      return acc + Math.pow(y - predicted, 2);
    }, 0);

    return { slope, intercept, mse: sumSquaredErrors / n, valid: true };
  });

  readonly equationString = computed(() => {
    const { slope, intercept, valid } = this.regressionStats();
    if (!valid) return 'y = mx + b';
    const sign = intercept >= 0 ? '+' : '-';
    return `y = ${slope.toFixed(2)}x ${sign} ${Math.abs(intercept).toFixed(2)}`;
  });

  // --- Helpers ---
  handlePlotClick(point: Point): void {
    const [x, y] = point;
    if (
      x >= this.canvas.LIMIT_MIN &&
      x <= this.canvas.LIMIT_MAX &&
      y >= this.canvas.LIMIT_MIN &&
      y <= this.canvas.LIMIT_MAX
    ) {
      this.points.update((pts) => [...pts, [x, y]]);
    }
  }

  get lineCoordinates() {
    const stats = this.regressionStats();
    if (!stats.valid || !this.canvas) return null;
    return {
      x1: this.canvas.toScreenX(this.canvas.minX()),
      y1: this.canvas.toScreenY(stats.slope * this.canvas.minX() + stats.intercept),
      x2: this.canvas.toScreenX(this.canvas.maxX()),
      y2: this.canvas.toScreenY(stats.slope * this.canvas.maxX() + stats.intercept),
    };
  }

  getResidual(point: Point) {
    const stats = this.regressionStats();
    if (!stats.valid || !this.canvas) return null;
    return {
      x: this.canvas.toScreenX(point[0]),
      y1: this.canvas.toScreenY(point[1]),
      y2: this.canvas.toScreenY(stats.slope * point[0] + stats.intercept),
    };
  }

  onDeletePoint(index: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.points.update((pts) => pts.filter((_, i) => i !== index));
  }

  reset(): void {
    this.points.set([]);
  }
}
