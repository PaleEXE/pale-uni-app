import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  signal,
  computed,
  HostListener,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

type Point = [number, number];

@Component({
  selector: 'app-plot-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plot-canvas.html',
  exportAs: 'plotCanvas',
})
export class PlotCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('plotArea') plotAreaRef!: ElementRef<HTMLDivElement>;

  @Input() yTickOffset: number = 20;
  @Input() borderClass: string = 'border-primary-500';
  @Input() interactionMode: 'draw' | 'pan' = 'draw';
  @Input() deleteMode: boolean = false;

  @Output() plotClick = new EventEmitter<Point>();

  // --- Constants ---
  readonly LIMIT_MIN = -1000;
  readonly LIMIT_MAX = 1000;

  // --- State ---
  readonly width = signal(0);
  readonly height = signal(0);
  readonly cursorPosition = signal<Point | null>(null);

  readonly isDragging = signal(false);
  private lastMousePos = { x: 0, y: 0 };
  private resizeObserver: ResizeObserver | null = null;

  // --- Scales ---
  readonly minX = signal(-10);
  readonly maxX = signal(10);
  readonly minY = signal(-10);
  readonly maxY = signal(10);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  readonly xTicks = computed(() => this.generateTicks(this.minX(), this.maxX()));
  readonly yTicks = computed(() => this.generateTicks(this.minY(), this.maxY()));

  private generateTicks(min: number, max: number): number[] {
    const range = max - min;
    if (range <= 0 || !isFinite(range)) return [];
    const targetTickCount = 5;
    const rawStep = range / targetTickCount;
    const mag = Math.floor(Math.log10(rawStep));
    const step = Math.pow(10, mag) * (Math.round(rawStep / Math.pow(10, mag)) || 1);
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
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onGlobalMouseMove(event: MouseEvent): void {
    if (!this.isDragging()) return;

    if (this.interactionMode === 'pan') {
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
    } else if (this.interactionMode === 'draw' && this.isTargetInPlot(event.target)) {
      this.emitClick(event);
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

    if (this.interactionMode === 'draw') {
      this.emitClick(event);
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

  private emitClick(event: MouseEvent): void {
    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();
    const x = this.toDataX(event.clientX - rect.left);
    const y = this.toDataY(event.clientY - rect.top);
    this.plotClick.emit([x, y]);
  }

  private isTargetInPlot(target: any): boolean {
    return this.plotAreaRef.nativeElement.contains(target);
  }

  toScreenX(dataX: number): number {
    return ((dataX - this.minX()) / (this.maxX() - this.minX())) * this.width();
  }
  toScreenY(dataY: number): number {
    return this.height() - ((dataY - this.minY()) / (this.maxY() - this.minY())) * this.height();
  }
  toDataX(screenX: number): number {
    return this.minX() + (screenX / this.width()) * (this.maxX() - this.minX());
  }
  toDataY(screenY: number): number {
    return this.maxY() - (screenY / this.height()) * (this.maxY() - this.minY());
  }
}
