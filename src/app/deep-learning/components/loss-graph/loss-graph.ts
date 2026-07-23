/**
 * LossGraph — D3-style SVG line chart showing loss over training steps.
 */

import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  input,
  signal,
  computed,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-loss-graph',
  standalone: true,
  templateUrl: './loss-graph.html',
  styleUrl: './loss-graph.css',
})
export class LossGraphComponent implements AfterViewInit, OnDestroy {
  @ViewChild('graphContainer') containerRef!: ElementRef<HTMLDivElement>;

  /** Loss history array */
  readonly lossHistory = input<number[]>([]);
  /** Current loss value */
  readonly currentLoss = input<number>(0);

  readonly graphWidth = signal(400);
  readonly graphHeight = signal(160);

  readonly marginLeft = 45;
  readonly marginRight = 15;
  readonly marginTop = 10;
  readonly marginBottom = 25;

  private resizeObserver: ResizeObserver | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  /** Compute Y-axis ticks */
  readonly yTicks = computed(() => {
    const history = this.lossHistory();
    if (history.length === 0) return [0, 0.25, 0.5, 0.75, 1.0];
    const maxLoss = Math.max(...history, 0.01);
    const step = this.niceStep(maxLoss, 5);
    const ticks: number[] = [];
    for (let i = 0; i <= maxLoss + step; i += step) {
      ticks.push(parseFloat(i.toFixed(6)));
      if (ticks.length >= 6) break;
    }
    return ticks;
  });

  /** Compute X-axis ticks */
  readonly xTicks = computed(() => {
    const len = this.lossHistory().length;
    if (len <= 1) return [0];
    const step = Math.max(1, Math.floor(len / 5));
    const ticks: number[] = [];
    for (let i = 0; i < len; i += step) {
      ticks.push(i);
    }
    if (ticks[ticks.length - 1] !== len - 1) ticks.push(len - 1);
    return ticks;
  });

  /** Max Y value for scaling */
  readonly maxY = computed(() => {
    const history = this.lossHistory();
    if (history.length === 0) return 1;
    return Math.max(...history, 0.01) * 1.1;
  });

  /** Scale X: step index → pixel */
  scaleX(index: number): number {
    const history = this.lossHistory();
    const maxIndex = Math.max(history.length - 1, 1);
    const plotWidth = this.graphWidth() - this.marginLeft - this.marginRight;
    return this.marginLeft + (index / maxIndex) * plotWidth;
  }

  /** Scale Y: loss value → pixel */
  scaleY(value: number): number {
    const plotHeight = this.graphHeight() - this.marginTop - this.marginBottom;
    return this.marginTop + (1 - value / this.maxY()) * plotHeight;
  }

  /** SVG path data for the loss line */
  readonly pathData = computed(() => {
    const history = this.lossHistory();
    if (history.length < 2) return '';
    return history
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${this.scaleX(i)},${this.scaleY(v)}`)
      .join(' ');
  });

  /** SVG path data for the filled area under the line */
  readonly areaData = computed(() => {
    const history = this.lossHistory();
    if (history.length < 2) return '';
    const baseline = this.graphHeight() - this.marginBottom;
    const linePath = history
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${this.scaleX(i)},${this.scaleY(v)}`)
      .join(' ');
    return `${linePath} L${this.scaleX(history.length - 1)},${baseline} L${this.scaleX(0)},${baseline} Z`;
  });

  formatTick(val: number): string {
    if (val >= 1) return val.toFixed(1);
    if (val >= 0.01) return val.toFixed(2);
    return val.toFixed(3);
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            this.graphWidth.set(entry.contentRect.width);
          }
        }
      });
      this.resizeObserver.observe(this.containerRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  /** Compute a "nice" step value for tick marks */
  private niceStep(maxVal: number, targetTicks: number): number {
    const rawStep = maxVal / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;
    let step: number;
    if (normalized <= 1) step = 1;
    else if (normalized <= 2) step = 2;
    else if (normalized <= 5) step = 5;
    else step = 10;
    return step * magnitude;
  }
}
