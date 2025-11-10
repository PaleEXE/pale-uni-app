import { Component, ViewChild, ElementRef, AfterViewInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-linear-regression',
  standalone: true,
  templateUrl: './linear-regression.html',
  styleUrls: ['./linear-regression.css'],
  imports: [CommonModule, FormsModule],
})
export class LinearRegression implements AfterViewInit {
  @ViewChild('plotArea', { static: true }) plotAreaRef!: ElementRef<HTMLDivElement>;
  ctx!: CanvasRenderingContext2D;

  points = signal<[number, number][]>([]);
  slope = signal(0);
  intercept = signal(0);
  mse = signal(0);
  step = signal<'draw' | 'line'>('draw');
  iteration = signal(0);

  // Gradient descent internal state
  private currentSlope = 0;
  private currentIntercept = 0;
  private xs: number[] = [];
  private ys: number[] = [];
  private learningRate = 0.001;
  // Manual line inputs
  manualSlope =0;
  manualIntercept=0;

  ngAfterViewInit(): void {
    const canvasDiv = this.plotAreaRef.nativeElement;
    const width = canvasDiv.offsetWidth;
    const height = canvasDiv.offsetHeight;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvasDiv.appendChild(canvas);

    this.ctx = canvas.getContext('2d')!;

    // White background
    this.ctx.fillStyle =  'white';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);

    canvas.addEventListener('click', (event) => this.addPoint(event));

    this.clearCanvas();
  }
  
  applyManualLine() {
    if (this.manualSlope === null || this.manualIntercept === null) {
    alert('⚠️ Please enter both slope (m) and intercept (b) before drawing.');
    return; //this part didnt work with me 
  } 
    this.currentSlope = this.manualSlope;
    this.currentIntercept = this.manualIntercept;
    this.drawRegressionLine();
    this.step.set('line');
  }

  addPoint(event: MouseEvent) {
    if (this.step() !== 'draw') return;

    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.points.update(p => [...p, [x, y]]);
    this.drawPoints();
  }

  drawPoints() {
    this.clearCanvas();
    this.points().forEach(([x, y]) => {
      this.ctx.beginPath();
      this.ctx.arc(x, y, 5, 0, Math.PI * 2);
      this.ctx.fillStyle = 'blue';
      this.ctx.fill();
    });
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    this.ctx.fillStyle = 'white';
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  drawRegressionLine() {
    this.drawPoints();

    const canvasWidth = this.ctx.canvas.width;
    const y1 = this.currentIntercept;
    const y2 = this.currentSlope * canvasWidth + this.currentIntercept;

    // Draw red regression line
    this.ctx.beginPath();
    this.ctx.moveTo(0, y1);
    this.ctx.lineTo(canvasWidth, y2);
    this.ctx.strokeStyle = 'red';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Draw slope and intercept as text
    this.ctx.fillStyle = 'black';
    this.ctx.font = '16px Arial';
    const slopeText = `y = ${this.currentSlope.toFixed(2)}x + ${this.currentIntercept.toFixed(2)}`;
    this.ctx.fillText(slopeText, 10, 20);

    // Draw iteration number
    const iterText = `Iteration: ${this.iteration()}`;
    this.ctx.fillText(iterText, 10, 40);
  }

  // Advance one trial of gradient descent
  calculateRegression() {
    if (this.points().length < 2) return;

    // Initialize once
    if (this.step() === 'draw') {
      this.xs = this.points().map(p => p[0]);
      this.ys = this.points().map(p => p[1]);
      this.currentSlope = 0;
      this.currentIntercept = 0;
      this.iteration.set(0);
      this.step.set('line');
    }

    const n = this.xs.length;

    // Compute gradients
    let gradientM = 0;
    let gradientB = 0;
    for (let i = 0; i < n; i++) {
      const yPred = this.currentSlope * this.xs[i] + this.currentIntercept;
      const error = yPred - this.ys[i];
      gradientM += (2 / n) * error * this.xs[i];
      gradientB += (2 / n) * error;
    }

    // Update slope and intercept
    this.currentSlope -= this.learningRate * gradientM;
    this.currentIntercept -= this.learningRate * gradientB;

    // Update MSE here .
    const mseVal = this.ys.reduce(
      (acc, y, i) => acc + Math.pow(y - (this.currentSlope * this.xs[i] + this.currentIntercept), 2),
      0
    ) / n;

    this.slope.set(this.currentSlope);
    this.intercept.set(this.currentIntercept);
    this.mse.set(mseVal);

    this.iteration.update(i => i + 1);

    this.drawRegressionLine();
  }

  back() {
    this.step.set('draw');
    this.currentSlope = 0;
    this.currentIntercept = 0;
    this.iteration.set(0);
    this.drawPoints();
  }
}
