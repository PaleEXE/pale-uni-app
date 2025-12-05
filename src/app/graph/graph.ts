import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  signal,
  effect,
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

  //--------------------------
  // Layout
  //--------------------------

  readonly width = signal(0);
  readonly height = signal(0);

  //--------------------------
  // Graph Data
  //--------------------------

  readonly nodes = signal<GraphNode[]>([]);
  readonly edges = signal<[number, number][]>([]);

  private nextNodeId = 0;

  //--------------------------
  // UI State
  //--------------------------

  readonly deleteMode = signal(false);
  readonly linkMode = signal(false);
  readonly selectedNodeId = signal<number | null>(null);

  readonly nodeSize = signal(32);

  //--------------------------
  // Drag
  //--------------------------

  readonly draggingNodeId = signal<number | null>(null);

  //--------------------------
  // Algorithms
  //--------------------------

  readonly startNodeId = signal<number | null>(null);

  // ✅ ngModel <-> signal sync variable
  startNodeModel: number | null = null;

  readonly dfsResult = signal<number[]>([]);
  readonly bfsResult = signal<number[]>([]);
  readonly algorithmMessage = signal('');

  //--------------------------
  // Label Management
  //--------------------------

  readonly editingNodeId = signal<number | null>(null);
  readonly editingLabel = signal('');

  constructor(private location: Location) {
    // ✅ Auto-sync model with startNodeId signal
    effect(() => {
      this.startNodeModel = this.startNodeId();
    });

    // ✅ Auto-select first node when graph changes
    effect(() => {
      const list = this.nodes();

      if (list.length > 0 && this.startNodeId() === null) {
        this.setStartNode(list[0].id);
      }

      if (list.length === 0) {
        this.startNodeId.set(null);
        this.startNodeModel = null;
      }
    });
  }

  // ======================================================
  // INIT
  // ======================================================

  ngAfterViewInit(): void {
    const el = this.plotAreaRef.nativeElement;
    this.width.set(el.offsetWidth);
    this.height.set(el.offsetHeight);
  }

  // ======================================================
  // POSITIONING
  // ======================================================

  getPosX([x]: Point): number {
    return this.width() / 2 + x - this.nodeSize() / 2;
  }

  getPosY([, y]: Point): number {
    return this.height() / 2 - y - this.nodeSize() / 2;
  }

  private screenToGraph(screenX: number, screenY: number): Point {
    return [screenX - this.width() / 2, this.height() / 2 - screenY];
  }

  getNodeById(id: number): GraphNode | undefined {
    return this.nodes().find((n) => n.id === id);
  }

  // ======================================================
  // HIT TESTING
  // ======================================================

  private findNodeAtPosition(
    screenX: number,
    screenY: number
  ): GraphNode | null {
    const r = this.nodeSize() / 2;

    for (const node of this.nodes()) {
      const x = this.getPosX(node.pos) + r;
      const y = this.getPosY(node.pos) + r;

      const dx = screenX - x;
      const dy = screenY - y;

      if (Math.hypot(dx, dy) <= r + 4) return node;
    }

    return null;
  }

  // ======================================================
  // NODE MANAGEMENT
  // ======================================================

  private addNodeAtPosition(screenX: number, screenY: number): void {
    const pos = this.screenToGraph(screenX, screenY);
    const id = this.nextNodeId++;

    const label = String.fromCharCode(65 + (id % 26));

    const newNode: GraphNode = {
      id,
      label,
      pos,
      neighbors: [],
    };

    this.nodes.set([...this.nodes(), newNode]);
  }

  private deleteNode(nodeId: number): void {
    this.nodes.set(this.nodes().filter((n) => n.id !== nodeId));
    this.edges.set(
      this.edges().filter(([a, b]) => a !== nodeId && b !== nodeId)
    );

    if (this.startNodeId() === nodeId) {
      this.startNodeId.set(null);
    }
  }

  onStartNodeChange(id: number | null | undefined): void {
    console.log('Start node changed:', id);
    if (id == null) return;

    // Convert to number if it's a string (ngModel can return strings)
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;

    if (isNaN(numId)) return;

    this.startNodeId.set(numId);
    this.startNodeModel = numId;

    this.dfsResult.set([]);
    this.bfsResult.set([]);

    this.algorithmMessage.set(`Start node set to ${numId}`);
  }

  // ======================================================
  // LABEL MANAGEMENT
  // ======================================================

  startEditingLabel(nodeId: number): void {
    const node = this.getNodeById(nodeId);
    if (!node) return;

    this.editingNodeId.set(nodeId);
    this.editingLabel.set(node.label);
  }

  saveLabel(): void {
    const nodeId = this.editingNodeId();
    if (nodeId === null) return;

    const newLabel = this.editingLabel().trim().toUpperCase();
    if (!newLabel) {
      this.cancelEditingLabel();
      return;
    }

    this.nodes.set(
      this.nodes().map((n) => (n.id === nodeId ? { ...n, label: newLabel } : n))
    );

    this.editingNodeId.set(null);
    this.editingLabel.set('');
  }

  cancelEditingLabel(): void {
    this.editingNodeId.set(null);
    this.editingLabel.set('');
  }

  // ======================================================
  // EDGE MANAGEMENT
  // ======================================================

  private tryCreateEdge(nodeId: number): void {
    if (this.selectedNodeId() === null) {
      this.selectedNodeId.set(nodeId);
      return;
    }

    if (this.selectedNodeId() === nodeId) {
      this.selectedNodeId.set(null);
      return;
    }

    const from = this.selectedNodeId()!;
    const to = nodeId;

    const exists = this.edges().some(
      ([a, b]) => (a === from && b === to) || (a === to && b === from)
    );

    if (!exists) {
      this.edges.set([...this.edges(), [from, to]]);
    }

    this.selectedNodeId.set(null);
  }

  // ======================================================
  // DRAGGING
  // ======================================================

  onNodeMouseDown(event: MouseEvent, nodeId: number): void {
    if (this.linkMode() || this.deleteMode()) return;

    event.preventDefault();
    event.stopPropagation();

    this.draggingNodeId.set(nodeId);
  }

  onPlotMouseMove(event: MouseEvent): void {
    const dragId = this.draggingNodeId();
    if (dragId === null) return;

    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const newPos = this.screenToGraph(x, y);

    this.nodes.set(
      this.nodes().map((n) => (n.id === dragId ? { ...n, pos: newPos } : n))
    );
  }

  onPlotMouseUp(): void {
    this.draggingNodeId.set(null);
  }

  // ======================================================
  // CLICK HANDLING
  // ======================================================

  onPlotClick(event: MouseEvent): void {
    if (this.draggingNodeId() !== null) return;

    const rect = this.plotAreaRef.nativeElement.getBoundingClientRect();

    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const hit = this.findNodeAtPosition(x, y);

    if (this.deleteMode() && hit) {
      this.deleteNode(hit.id);
      return;
    }

    if (this.linkMode() && hit) {
      this.tryCreateEdge(hit.id);
      return;
    }

    if (!hit) {
      this.addNodeAtPosition(x, y);
    }
  }

  // ======================================================
  // UI CONTROLS
  // ======================================================

  toggleDeleteMode(): void {
    this.deleteMode.update((v) => !v);

    if (this.deleteMode()) {
      this.linkMode.set(false);
      this.selectedNodeId.set(null);
    }
  }

  toggleLinkMode(): void {
    this.linkMode.update((v) => !v);

    if (this.linkMode()) {
      this.deleteMode.set(false);
    }

    this.selectedNodeId.set(null);
  }

  isNodeSelected(id: number): boolean {
    return this.selectedNodeId() === id;
  }

  // ======================================================
  // SVG EDGES
  // ======================================================

  getEdgePath(from: GraphNode | undefined, to: GraphNode | undefined): string {
    if (!from || !to) return '';

    const x1 = this.getPosX(from.pos) + this.nodeSize() / 2;
    const y1 = this.getPosY(from.pos) + this.nodeSize() / 2;

    const x2 = this.getPosX(to.pos) + this.nodeSize() / 2;
    const y2 = this.getPosY(to.pos) + this.nodeSize() / 2;

    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  // ======================================================
  // GRAPH ALGORITHMS
  // ======================================================

  private buildAdjacencyList(): Map<number, number[]> {
    const adj = new Map<number, number[]>();

    for (const n of this.nodes()) {
      adj.set(n.id, []);
    }

    for (const [a, b] of this.edges()) {
      adj.get(a)!.push(b);
      adj.get(b)!.push(a);
    }

    return adj;
  }

  private dfs(startId: number): number[] {
    const adj = this.buildAdjacencyList();
    const visited = new Set<number>();
    const result: number[] = [];

    const visit = (id: number) => {
      visited.add(id);
      result.push(id);

      for (const n of adj.get(id) ?? []) {
        if (!visited.has(n)) {
          visit(n);
        }
      }
    };

    visit(startId);
    this.algorithmMessage.set('DFS traversal completed.');
    return result;
  }

  private bfs(startId: number): number[] {
    const adj = this.buildAdjacencyList();

    const visited = new Set<number>();
    const result: number[] = [];
    const queue: number[] = [startId];

    visited.add(startId);

    while (queue.length) {
      const id = queue.shift()!;
      result.push(id);

      for (const n of adj.get(id) ?? []) {
        if (!visited.has(n)) {
          visited.add(n);
          queue.push(n);
        }
      }
    }

    this.algorithmMessage.set('BFS traversal completed.');
    return result;
  }

  performDFS(): void {
    console.log(this.startNodeId());
    if (!this.nodes().length) {
      this.algorithmMessage.set('Please add nodes first.');
      return;
    }

    const start = this.startNodeId() ?? this.nodes()[0].id;

    this.setStartNode(start);

    this.dfsResult.set(this.dfs(start));
    this.bfsResult.set([]);
  }

  performBFS(): void {
    if (!this.nodes().length) {
      this.algorithmMessage.set('Please add nodes first.');
      return;
    }

    const start = this.startNodeId() ?? this.nodes()[0].id;

    this.setStartNode(start);

    this.bfsResult.set(this.bfs(start));
    this.dfsResult.set([]);
  }

  // ✅ Updated for ngModel sync
  setStartNode(id: number): void {
    this.startNodeId.set(id);
    this.startNodeModel = id;

    this.dfsResult.set([]);
    this.bfsResult.set([]);
    this.algorithmMessage.set(`Start node set to ${id}`);
  }

  // ======================================================
  // RESET + NAV
  // ======================================================

  reset(): void {
    if (!confirm('Clear all nodes and edges?')) return;

    this.nodes.set([]);
    this.edges.set([]);

    this.selectedNodeId.set(null);
    this.startNodeId.set(null);
    this.startNodeModel = null;

    this.draggingNodeId.set(null);

    this.dfsResult.set([]);
    this.bfsResult.set([]);
    this.algorithmMessage.set('');

    this.editingNodeId.set(null);
    this.editingLabel.set('');

    this.nextNodeId = 0;
  }

  back(): void {
    this.location.back();
  }
}
