import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  WritableSignal,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-plot',
  standalone: true,
  templateUrl: './plot.html',
  styleUrl: './plot.css',
})
export class Plot implements AfterViewInit {
  @ViewChild('plotArea') plotAreaRef!: ElementRef<HTMLDivElement>;

  width = 0;
  height = 0;

  points: WritableSignal<[number, number][]> = signal([]);

  ngAfterViewInit() {
    const el = this.plotAreaRef.nativeElement;
    this.width = el.offsetWidth;
    this.height = el.offsetHeight;
  }

  getPosX([x]: [number, number]): number {
    return this.width / 2 + x * 5 - 6;
  }

  getPosY([, y]: [number, number]): number {
    return this.height / 2 + y * -5 - 6;
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
  }
}
