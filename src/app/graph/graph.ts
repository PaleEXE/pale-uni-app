import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  signal,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Location } from '@angular/common';
import { GraphService, SavedVisualResponse } from '../services/graph.service';
import { AuthService } from '../services/auth.service';
import { HttpClientModule } from '@angular/common/http';

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
  imports: [CommonModule, FormsModule, HttpClientModule],
  providers: [GraphService],
  templateUrl: './graph.html',
  styleUrl: './graph.css',
})
export class Graph implements AfterViewInit {
  @ViewChild('plotArea')
  plotAreaRef!: ElementRef<HTMLDivElement>;

  @ViewChild('fileInput')
  fileInputRef!: ElementRef<HTMLInputElement>;

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
  // Upload State
  //--------------------------

  readonly uploading = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly uploadSuccess = signal<string | null>(null);

  //--------------------------
  // Drag
  //--------------------------

  readonly draggingNodeId = signal<number | null>(null);

  //--------------------------
  // Algorithms
  //--------------------------

  readonly startNodeId = signal<number | null>(null);

  startNodeModel: number | null = null;

  readonly dfsResult = signal<number[]>([]);
  readonly bfsResult = signal<number[]>([]);
  readonly algorithmMessage = signal('');

  // Tracking algorithm state
  readonly traversalSteps = signal<
    Array<{
      step: number;
      nodeId: number;
      nodeLabel: string;
      visited: number[];
      open: number[];
      closed: number[];
    }>
  >([]);

  //--------------------------
  // Label Management
  //--------------------------

  readonly editingNodeId = signal<number | null>(null);
  readonly editingLabel = signal('');

  //--------------------------
  // Saved Visuals
  //--------------------------

  readonly savingVisual = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saveSuccess = signal<string | null>(null);
  readonly loadingVisuals = signal(false);
  readonly savedVisuals = signal<SavedVisualResponse[]>([]);
  readonly showSavedVisuals = signal(false);
  readonly visualName = signal('');

  //--------------------------
  // Label Corrections
  //--------------------------

  readonly uploadedImagePath = signal<string | null>(null);
  readonly predictedLabels = signal<Record<number, string>>({});
  readonly correctedLabels = signal<Record<number, string>>({});
  readonly showLabelCorrections = signal(false);
  readonly savingCorrections = signal(false);
  readonly correctionsMessage = signal<string | null>(null);

  constructor(
    private location: Location,
    private graphService: GraphService,
    private authService: AuthService
  ) {
    effect(() => {
      this.startNodeModel = this.startNodeId();
    });

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
    const steps: Array<{
      step: number;
      nodeId: number;
      nodeLabel: string;
      visited: number[];
      open: number[];
      closed: number[];
    }> = [];
    const open = new Set<number>([startId]);
    const closed = new Set<number>();

    const visit = (id: number) => {
      visited.add(id);
      open.delete(id);
      result.push(id);

      const node = this.getNodeById(id);
      steps.push({
        step: steps.length + 1,
        nodeId: id,
        nodeLabel: node?.label || '',
        visited: Array.from(visited).sort((a, b) => a - b),
        open: Array.from(open).sort((a, b) => a - b),
        closed: Array.from(closed).sort((a, b) => a - b),
      });

      for (const n of adj.get(id) ?? []) {
        if (!visited.has(n)) {
          open.add(n);
          visit(n);
        }
      }

      closed.add(id);
    };

    visit(startId);
    this.traversalSteps.set(steps);
    this.algorithmMessage.set('DFS traversal completed.');
    return result;
  }

  private bfs(startId: number): number[] {
    const adj = this.buildAdjacencyList();

    const visited = new Set<number>();
    const result: number[] = [];
    const queue: number[] = [startId];
    const steps: Array<{
      step: number;
      nodeId: number;
      nodeLabel: string;
      visited: number[];
      open: number[];
      closed: number[];
    }> = [];
    const open = new Set<number>([startId]);
    const closed = new Set<number>();

    visited.add(startId);

    while (queue.length) {
      const id = queue.shift()!;
      result.push(id);
      open.delete(id);

      const node = this.getNodeById(id);
      steps.push({
        step: steps.length + 1,
        nodeId: id,
        nodeLabel: node?.label || '',
        visited: Array.from(visited).sort((a, b) => a - b),
        open: Array.from(open).sort((a, b) => a - b),
        closed: Array.from(closed).sort((a, b) => a - b),
      });

      for (const n of adj.get(id) ?? []) {
        if (!visited.has(n)) {
          visited.add(n);
          open.add(n);
          queue.push(n);
        }
      }

      closed.add(id);
    }

    this.traversalSteps.set(steps);
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

  setStartNode(id: number): void {
    this.startNodeId.set(id);
    this.startNodeModel = id;

    this.dfsResult.set([]);
    this.bfsResult.set([]);
    this.traversalSteps.set([]);
    this.algorithmMessage.set(`Start node set to ${id}`);
  }

  // ======================================================
  // FILE UPLOAD
  // ======================================================

  triggerFileUpload(): void {
    this.fileInputRef.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];

    if (!file.type.startsWith('image/')) {
      this.uploadError.set('Please select an image file (PNG, JPG, JPEG)');
      this.uploadSuccess.set(null);
      return;
    }

    this.uploadGraph(file);
    input.value = '';
  }

  uploadGraph(file: File): void {
    this.uploading.set(true);
    this.uploadError.set(null);
    this.uploadSuccess.set(null);

    const user = this.authService.currentUserValue;
    if (!user) {
      this.uploadError.set('User not authenticated');
      this.uploading.set(false);
      return;
    }

    this.graphService.extractGraph(file, user.user_id).subscribe({
      next: (response) => {
        this.uploading.set(false);

        // Store predicted labels from response
        const predicted: Record<number, string> = {};
        response.nodes.forEach((node) => {
          predicted[node.id] = node.label;
        });
        this.predictedLabels.set(predicted);
        this.correctedLabels.set({ ...predicted }); // Initialize corrected with predicted

        // Extract image path from filename (user_id is in URL path)
        const user = this.authService.currentUserValue;
        if (user) {
          // Store relative path format
          const timestamp = new Date().getTime();
          this.uploadedImagePath.set(
            `graph_images/${user.user_id}/graph_${timestamp}`
          );
        }

        this.loadGraphFromResponse(response);

        // Show label corrections modal
        this.showLabelCorrections.set(true);

        this.uploadSuccess.set(
          `Successfully extracted ${response.node_count} nodes and ${response.edge_count} edges!`
        );

        setTimeout(() => this.uploadSuccess.set(null), 5000);
      },
      error: (error) => {
        this.uploading.set(false);
        this.uploadError.set(
          error.error?.detail || 'Failed to extract graph from image'
        );

        setTimeout(() => this.uploadError.set(null), 5000);
      },
    });
  }

  private loadGraphFromResponse(response: {
    nodes: GraphNode[];
    node_count: number;
    edge_count: number;
  }): void {
    setTimeout(() => {
      const centeredNodes = this.centerGraph(response.nodes);
      this.nodes.set(centeredNodes);

      const edgeSet = new Set<string>();
      const edges: [number, number][] = [];

      for (const node of centeredNodes) {
        for (const neighbor of node.neighbors) {
          const key =
            node.id < neighbor
              ? `${node.id}-${neighbor}`
              : `${neighbor}-${node.id}`;

          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            edges.push([node.id, neighbor]);
          }
        }
      }

      this.edges.set(edges);

      this.nextNodeId = Math.max(...centeredNodes.map((n) => n.id), -1) + 1;

      this.dfsResult.set([]);
      this.bfsResult.set([]);
      this.algorithmMessage.set('');
    }, 0);
  }

  private centerGraph(nodes: GraphNode[]): GraphNode[] {
    if (nodes.length === 0) return nodes;

    const xCoords = nodes.map((n) => n.pos[0]);
    const yCoords = nodes.map((n) => n.pos[1]);

    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    const w = this.width();
    const h = this.height();

    if (w === 0 || h === 0) {
      return nodes;
    }

    const padding = 100;
    const availableWidth = w - padding * 2;
    const availableHeight = h - padding * 2;

    const scaleX = graphWidth > 0 ? availableWidth / graphWidth : 1;
    const scaleY = graphHeight > 0 ? availableHeight / graphHeight : 1;
    const scale = Math.min(scaleX, scaleY);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    return nodes.map((node) => ({
      ...node,
      pos: [
        (node.pos[0] - centerX) * scale,
        -(node.pos[1] - centerY) * scale,
      ] as Point,
    }));
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
    this.traversalSteps.set([]);
    this.algorithmMessage.set('');

    this.editingNodeId.set(null);
    this.editingLabel.set('');

    this.nextNodeId = 0;

    this.uploadError.set(null);
    this.uploadSuccess.set(null);
  }

  back(): void {
    this.location.back();
  }

  // ======================================================
  // SAVED VISUALS
  // ======================================================

  getGraphData(): Record<string, any> {
    return {
      nodes: this.nodes(),
      edges: this.edges(),
    };
  }

  saveCurrentGraph(): void {
    if (!this.visualName() || this.visualName().trim() === '') {
      this.saveError.set('Please enter a name for the visualization');
      return;
    }

    const user = this.authService.currentUserValue;
    if (!user) {
      this.saveError.set('User not authenticated');
      return;
    }

    this.savingVisual.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(null);

    this.graphService
      .saveVisual(user.user_id, this.getGraphData(), this.visualName())
      .subscribe({
        next: () => {
          this.saveSuccess.set(`Graph saved as "${this.visualName()}"`);
          this.visualName.set('');
          this.savingVisual.set(false);
          setTimeout(() => this.saveSuccess.set(null), 3000);
          this.loadSavedVisuals();
        },
        error: (err) => {
          console.error('Error saving graph:', err);
          this.saveError.set(
            err.error?.detail || 'Failed to save graph. Please try again.'
          );
          this.savingVisual.set(false);
        },
      });
  }

  loadSavedVisuals(): void {
    const user = this.authService.currentUserValue;
    if (!user) {
      this.saveError.set('User not authenticated');
      return;
    }

    this.loadingVisuals.set(true);

    this.graphService.getSavedVisuals(user.user_id).subscribe({
      next: (visuals) => {
        this.savedVisuals.set(visuals);
        this.loadingVisuals.set(false);
      },
      error: (err) => {
        console.error('Error loading saved visuals:', err);
        this.saveError.set('Failed to load saved graphs');
        this.loadingVisuals.set(false);
      },
    });
  }

  loadGraphFromSaved(visual: SavedVisualResponse): void {
    const graphData = visual.saved_visual as any;

    if (
      graphData.nodes &&
      Array.isArray(graphData.nodes) &&
      graphData.edges &&
      Array.isArray(graphData.edges)
    ) {
      this.nodes.set(graphData.nodes);
      this.edges.set(graphData.edges);

      if (graphData.nodes.length > 0) {
        this.nextNodeId =
          Math.max(...graphData.nodes.map((n: GraphNode) => n.id)) + 1;
      }

      this.showSavedVisuals.set(false);
      this.saveSuccess.set(`Loaded graph: "${visual.type}"`);
      setTimeout(() => this.saveSuccess.set(null), 3000);
    } else {
      this.saveError.set('Invalid graph data format');
    }
  }

  deleteGraphFromSaved(visualId: number, visualName: string): void {
    this.graphService.deleteSavedVisual(visualId).subscribe({
      next: () => {
        this.saveSuccess.set(`Graph ${visualName} deleted successfully`);
        setTimeout(() => this.saveSuccess.set(null), 3000);
        this.loadSavedVisuals();
      },
      error: (err) => {
        console.error('Error deleting graph:', err);
        this.saveError.set('Failed to delete graph');
      },
    });
  }

  toggleSavedVisuals(): void {
    if (!this.showSavedVisuals()) {
      this.loadSavedVisuals();
    }
    this.showSavedVisuals.set(!this.showSavedVisuals());
  }

  // ======================================================
  // LABEL CORRECTIONS
  // ======================================================

  updateCorrectedLabel(nodeId: number, newLabel: string): void {
    const corrected = { ...this.correctedLabels() };
    corrected[nodeId] = newLabel.toUpperCase();
    this.correctedLabels.set(corrected);

    // Update node label in display
    this.nodes.set(
      this.nodes().map((n) =>
        n.id === nodeId ? { ...n, label: newLabel.toUpperCase() } : n
      )
    );
  }

  saveLabelCorrections(): void {
    const imagePath = this.uploadedImagePath();
    const user = this.authService.currentUserValue;

    if (!imagePath || !user) {
      this.correctionsMessage.set('Error: Missing image path or user info');
      return;
    }

    const hasCorrections =
      JSON.stringify(this.correctedLabels()) !==
      JSON.stringify(this.predictedLabels());

    if (!hasCorrections) {
      this.correctionsMessage.set('No corrections made');
      return;
    }

    this.savingCorrections.set(true);

    this.graphService
      .saveLabelCorrections(
        user.user_id,
        imagePath,
        this.correctedLabels(),
        this.predictedLabels()
      )
      .subscribe({
        next: () => {
          this.correctionsMessage.set('Label corrections saved successfully!');
          this.savingCorrections.set(false);
          setTimeout(() => {
            this.correctionsMessage.set(null);
            this.showLabelCorrections.set(false);
          }, 2000);
        },
        error: (err) => {
          console.error('Error saving corrections:', err);
          this.correctionsMessage.set('Failed to save corrections');
          this.savingCorrections.set(false);
        },
      });
  }
}
