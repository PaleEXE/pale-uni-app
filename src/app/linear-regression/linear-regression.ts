import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';

type Point = [number, number];

@Component({
  selector: 'app-linear-regression',
  standalone: true,
  templateUrl: './linear-regression.html',
  styleUrls: ['./linear-regression.css'],
  imports: [CommonModule, FormsModule],
})
export class LinearRegression implements AfterViewInit {
  @ViewChild('plotArea') plotAreaRef!: ElementRef<HTMLDivElement>;

  readonly width = signal(0);
  readonly height = signal(0);
  readonly points = signal<Point[]>([]);
  readonly slope = signal(0);
  readonly intercept = signal(0);
  readonly mse = signal(0);
  readonly iteration = signal(0);
  readonly learningRate = signal(0.0001);
  readonly isDrawing = signal(false);

  constructor(private location: Location) {}

  ngAfterViewInit(): void {
    const el = this.plotAreaRef.nativeElement;
    this.width.set(el.offsetWidth);
    this.height.set(el.offsetHeight);
  }

  // --- Plotting Helpers ---
  getPosX([x]: Point): number {
    return this.width() / 2 + x - 4;
  }

  getPosY([, y]: Point): number {
    return this.height() / 2 - y - 4;
  }

  getRegressionLineY(x: number): number {
    if (this.width() === 0) return 0;
    const dataX = x - this.width() / 2;
    const dataY = this.slope() * dataX + this.intercept();
    return this.height() / 2 - dataY;
  }

  // --- Point Management ---
  private tryDeletePointAt(event: MouseEvent): void {
    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    let closestIndex = -1;
    let minDistance = Infinity;

    this.points().forEach((point: Point, index: number) => {
      const posX = this.getPosX(point);
      const posY = this.getPosY(point);
      const dx = clickX - posX;
      const dy = clickY - posY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < minDistance && distance < 20) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    if (closestIndex >= 0) {
      this.onDeletePoint(closestIndex);
    }
  }

  private addPointFromMouseEvent(event: MouseEvent): void {
    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const x = offsetX - this.width() / 2;
    const y = -(offsetY - this.height() / 2);

    this.points.set([...this.points(), [x, y]]);
  }

  onDeletePoint(index: number): void {
    const newPoints = [...this.points()];
    newPoints.splice(index, 1);
    this.points.set(newPoints);
  }

  // --- Mouse Events ---
  onPlotMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isDrawing.set(true);
    this.addPointFromMouseEvent(event);
  }

  onPlotMouseMove(event: MouseEvent): void {
    if (!this.isDrawing()) return;
    this.addPointFromMouseEvent(event);
  }

  onPlotMouseUp(): void {
    this.isDrawing.set(false);
  }

  onPlotClick(event: MouseEvent): void {
    if (!this.isDrawing()) {
      this.addPointFromMouseEvent(event);
    }
  }

  // --- Regression Calculation ---
  calculateRegression(): void {
    if (this.points().length < 2) {
      alert('Please add at least 2 points');
      return;
    }

    const xs = this.points().map((p) => p[0]);
    const ys = this.points().map((p) => p[1]);

    // Ordinary least squares method
    const n = xs.length;
    const sumX = xs.reduce((a, b) => a + b, 0);
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0);
    const sumX2 = xs.reduce((sum, x) => sum + x * x, 0);

    const denominator = n * sumX2 - sumX * sumX;
    if (denominator === 0) {
      alert('Cannot calculate regression (vertical line)');
      return;
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    this.slope.set(slope);
    this.intercept.set(intercept);
    this.calculateMSE();
  }

  // --- MSE Calculation ---
  private calculateMSE(): void {
    if (this.points().length === 0) {
      this.mse.set(0);
      return;
    }

    const sumSquaredErrors = this.points().reduce((sum, [x, y]) => {
      const predicted = this.slope() * x + this.intercept();
      const error = y - predicted;
      return sum + error * error;
    }, 0);

    this.mse.set(sumSquaredErrors / this.points().length);
  }

  // --- UI Actions ---
  back(): void {
    this.location.back();
  }

  reset(): void {
    if (confirm('Are you sure you want to clear all points?')) {
      this.points.set([]);
      this.slope.set(0);
      this.intercept.set(0);
      this.mse.set(0);
      this.iteration.set(0);
    }
  }
}
