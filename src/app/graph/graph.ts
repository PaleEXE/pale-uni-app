import { Component, ElementRef, ViewChild, signal } from '@angular/core';

@Component({
  selector: 'app-graph',
  imports: [],
  templateUrl: './graph.html',
  styleUrl: './graph.css',
})
export class Graph {
  @ViewChild('plotArea') graphAreaRef!: ElementRef<HTMLDivElement>;
  width = 0;
  height = 0;
  nodes = signal<any[]>([
    {
      id: 0,
      name: 'A',
      pos: [0, 0],
      neighbors: [
        [1, 1, 1],
        [2, 3, 2],
      ],
    },
    {
      id: 1,
      name: 'B',
      pos: [2, 4],
      neighbors: [
        [3, 1, 1],
        [4, 2, 1],
        [5, 4, 3],
      ],
    },
    {
      id: 2,
      name: 'C',
      pos: [9, 18],
      neighbors: [
        [6, 8, 2],
        [7, 18, 14],
      ],
    },
    { id: 3, name: 'D', pos: [10, 14], neighbors: [] },
    { id: 4, name: 'E', pos: [200, 300], neighbors: [] },
    { id: 5, name: 'F', pos: [200, 24], neighbors: [[8, 12, 11]] },
    { id: 6, name: 'H', pos: [14, 9], neighbors: [] },
    { id: 7, name: 'I', pos: [18, 18], neighbors: [] },
    { id: 8, name: 'V', pos: [30, 30], neighbors: [] },
  ]);

  ngAfterViewInit() {
    const el = this.graphAreaRef.nativeElement;
    this.width = el.offsetWidth;
    this.height = el.offsetHeight;
  }

  getPosX([x]: [number, number]): number {
    return this.width / 2 + x - 16;
  }

  getPosY([, y]: [number, number]): number {
    return this.height / 2 - y + 16;
  }

  onClickAddNode(event: MouseEvent): void {
    const rect = this.graphAreaRef.nativeElement.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    // Place new node at clicked position, convert to graph coordinates
    const x = offsetX - this.width / 2;
    const y = -(offsetY - this.height / 2);

    const nodesArr = this.nodes();
    const newId = nodesArr.length
      ? Math.max(...nodesArr.map((n) => n.id)) + 1
      : 0;
    const newName = String.fromCharCode(65 + (newId % 26)); // A-Z cycling

    this.nodes.update((nodes) => [
      ...nodes,
      {
        id: newId,
        name: newName,
        pos: [x, y],
        neighbors: [],
      },
    ]);  
  }
}
