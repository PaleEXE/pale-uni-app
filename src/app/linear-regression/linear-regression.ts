import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  signal,
  computed,
  HostListener,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

type Point = [number, number];
type Mode = 'draw' | 'pan';

@Component({
  selector: 'app-linear-regression',
  standalone: true,
  templateUrl: './linear-regression.html',
  styles: [],
  imports: [CommonModule, FormsModule],
})
export class LinearRegression implements AfterViewInit, OnDestroy {
  @ViewChild('plotArea') plotAreaRef!: ElementRef<HTMLDivElement>;

  // --- Constants ---
  readonly LIMIT_MIN = -1000;
  readonly LIMIT_MAX = 1000;

  // --- State ---
  readonly width = signal(0);
  readonly height = signal(0);
  readonly cursorPosition = signal<Point | null>(null);
  readonly showResiduals = signal(true);
  readonly interactionMode = signal<Mode>('draw');

  readonly points = signal<Point[]>([]);
  readonly isDragging = signal(false);
  private lastMousePos = { x: 0, y: 0 };

  // Keep track of observer to disconnect later
  private resizeObserver: ResizeObserver | null = null;

  // --- Scales ---
  readonly minX = signal(-100);
  readonly maxX = signal(100);
  readonly minY = signal(-100);
  readonly maxY = signal(100);

  // --- Inject Platform ID ---
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  // --- Computed Ticks ---
  readonly xTicks = computed(() =>
    this.generateTicks(this.minX(), this.maxX())
  );
  readonly yTicks = computed(() =>
    this.generateTicks(this.minY(), this.maxY())
  );

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

  ngAfterViewInit(): void {
    // FIX: Only run ResizeObserver in the browser
    if (isPlatformBrowser(this.platformId)) {
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
    // Cleanup to prevent memory leaks
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  // --- Event Handling ---
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

      // Clamp
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
      this.addPointFromEvent(event);
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
    if (this.interactionMode() === 'draw') this.addPointFromEvent(event);
  }

  onPlotMouseMoveLocal(event: MouseEvent): void {
    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();
    this.cursorPosition.set([
      this.toDataX(event.clientX - rect.left),
      this.toDataY(event.clientY - rect.top),
    ]);
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

  // --- Helpers ---
  addPointFromEvent(event: MouseEvent): void {
    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();
    const x = this.toDataX(event.clientX - rect.left);
    const y = this.toDataY(event.clientY - rect.top);
    if (
      x >= this.LIMIT_MIN &&
      x <= this.LIMIT_MAX &&
      y >= this.LIMIT_MIN &&
      y <= this.LIMIT_MAX
    ) {
      this.points.update((pts) => [...pts, [x, y]]);
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

  get lineCoordinates() {
    const stats = this.regressionStats();
    if (!stats.valid) return null;
    return {
      x1: this.toScreenX(this.minX()),
      y1: this.toScreenY(stats.slope * this.minX() + stats.intercept),
      x2: this.toScreenX(this.maxX()),
      y2: this.toScreenY(stats.slope * this.maxX() + stats.intercept),
    };
  }

  getResidual(point: Point) {
    const stats = this.regressionStats();
    if (!stats.valid) return null;
    return {
      x: this.toScreenX(point[0]),
      y1: this.toScreenY(point[1]),
      y2: this.toScreenY(stats.slope * point[0] + stats.intercept),
    };
  }

  onDeletePoint(index: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.points.update((pts) => pts.filter((_, i) => i !== index));
  }

  onPlotLeave(): void {
    this.cursorPosition.set(null);
  }

  reset(): void {
    this.points.set([]);
  }

  getScaleValue(label: string): number {
    switch (label) {
      case 'Min X':
        return this.minX();
      case 'Max X':
        return this.maxX();
      case 'Min Y':
        return this.minY();
      case 'Max Y':
        return this.maxY();
    }
    return 0;
  }

  updateScale(label: string, value: number) {
    if (value < this.LIMIT_MIN) value = this.LIMIT_MIN;
    if (value > this.LIMIT_MAX) value = this.LIMIT_MAX;
    switch (label) {
      case 'Min X':
        this.minX.set(value);
        break;
      case 'Max X':
        this.maxX.set(value);
        break;
      case 'Min Y':
        this.minY.set(value);
        break;
      case 'Max Y':
        this.maxY.set(value);
        break;
    }
  }
}
