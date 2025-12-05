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

interface GraphNode {
  id: number;
  label: string;
  pos: Point;
  neighbors: number[];
}

@Component({
  selector: 'app-graph',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './graph.html',
  styleUrl: './graph.css',
})
export class Graph implements AfterViewInit {
  @ViewChild('plotArea')
  plotAreaRef!: ElementRef<HTMLDivElement>;

  readonly width = signal(0);
  readonly height = signal(0);

  readonly nodes = signal<GraphNode[]>([]);
  readonly edges = signal<[number, number][]>([]);

  readonly deleteMode = signal(false);
  readonly linkMode = signal(false);

  readonly selectedNodeId = signal<number | null>(null);

  readonly nodeSize = signal(12);

  readonly draggingNodeId = signal<number | null>(null);

  private nextNodeId = 0;

  constructor(private location: Location) {}

  ngAfterViewInit(): void {
    const el = this.plotAreaRef.nativeElement;
    this.width.set(el.offsetWidth);
    this.height.set(el.offsetHeight);
  }

  // ======================
  // Position Helpers
  // ======================

  getPosX([x]: Point): number {
    return this.width() / 2 + x - this.nodeSize() / 2;
  }

  getPosY([, y]: Point): number {
    return this.height() / 2 - y - this.nodeSize() / 2;
  }

  private screenToGraph(screenX: number, screenY: number): Point {
    const x = screenX - this.width() / 2;
    const y = this.height() / 2 - screenY;

    return [x, y];
  }

  getNodeById(id: number): GraphNode | undefined {
    return this.nodes().find((n) => n.id === id);
  }

  private findNodeAtPosition(
    screenX: number,
    screenY: number
  ): GraphNode | null {
    for (const node of this.nodes()) {
      const posX = this.getPosX(node.pos);
      const posY = this.getPosY(node.pos);

      const dx = screenX - (posX + this.nodeSize() / 2);
      const dy = screenY - (posY + this.nodeSize() / 2);

      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.nodeSize() / 2 + 5) return node;
    }

    return null;
  }

  // ======================
  // Node Management
  // ======================

  private addNodeAtPosition(screenX: number, screenY: number): void {
    const pos = this.screenToGraph(screenX, screenY);

    const id = this.nextNodeId++;

    this.nodes.set([
      ...this.nodes(),
      {
        id,
        label: `N${id}`,
        pos,
        neighbors: [],
      },
    ]);
  }

  private deleteNode(nodeId: number): void {
    this.nodes.set(this.nodes().filter((n) => n.id !== nodeId));

    this.edges.set(
      this.edges().filter(([from, to]) => from !== nodeId && to !== nodeId)
    );
  }

  // ======================
  // Edge Logic
  // ======================

  private tryCreateEdge(nodeId: number): void {
    if (this.selectedNodeId() === null) {
      this.selectedNodeId.set(nodeId);
      return;
    }

    if (this.selectedNodeId() === nodeId) {
      this.selectedNodeId.set(null);
      return;
    }

    const fromId = this.selectedNodeId()!;
    const toId = nodeId;

    const exists = this.edges().some(
      ([a, b]) => (a === fromId && b === toId) || (a === toId && b === fromId)
    );

    if (!exists) {
      this.edges.set([...this.edges(), [fromId, toId]]);
    }

    this.selectedNodeId.set(null);
  }

  // ======================
  // DRAG HANDLING
  // ======================

  onNodeMouseDown(event: MouseEvent, nodeId: number): void {
    // Don't drag while linking or deleting
    if (this.linkMode() || this.deleteMode()) return;

    event.preventDefault();
    event.stopPropagation();

    this.draggingNodeId.set(nodeId);
  }

  onPlotMouseMove(event: MouseEvent): void {
    if (this.draggingNodeId() === null) return;

    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const newPos = this.screenToGraph(x, y);

    // Update node position immutably (signals)
    this.nodes.set(
      this.nodes().map((n) =>
        n.id === this.draggingNodeId() ? { ...n, pos: newPos } : n
      )
    );
  }

  onPlotMouseUp(): void {
    this.draggingNodeId.set(null);
  }

  // ======================
  // Plot Click
  // ======================

  onPlotClick(event: MouseEvent): void {
    if (this.draggingNodeId() !== null) return;

    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const clickedNode = this.findNodeAtPosition(x, y);

    if (this.deleteMode() && clickedNode) {
      this.deleteNode(clickedNode.id);
      return;
    }

    if (this.linkMode() && clickedNode) {
      this.tryCreateEdge(clickedNode.id);
      return;
    }

    if (!clickedNode) this.addNodeAtPosition(x, y);
  }

  // ======================
  // UI + Helpers
  // ======================

  toggleDeleteMode(): void {
    this.deleteMode.update((v) => !v);

    if (this.deleteMode()) {
      this.linkMode.set(false);
      this.selectedNodeId.set(null);
    }
  }

  toggleLinkMode(): void {
    this.linkMode.update((v) => !v);

    if (this.linkMode()) this.deleteMode.set(false);

    this.selectedNodeId.set(null);
  }

  getEdgePath(
    fromNode: GraphNode | undefined,
    toNode: GraphNode | undefined
  ): string {
    if (!fromNode || !toNode) return '';
    const x1 = this.getPosX(fromNode.pos) + this.nodeSize() / 2;
    const y1 = this.getPosY(fromNode.pos) + this.nodeSize() / 2;

    const x2 = this.getPosX(toNode.pos) + this.nodeSize() / 2;
    const y2 = this.getPosY(toNode.pos) + this.nodeSize() / 2;

    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  isNodeSelected(id: number): boolean {
    return this.selectedNodeId() === id;
  }

  reset(): void {
    if (!confirm('Clear all nodes and edges?')) return;

    this.nodes.set([]);
    this.edges.set([]);

    this.selectedNodeId.set(null);
    this.nextNodeId = 0;
  }

  back(): void {
    this.location.back();
  }
}
