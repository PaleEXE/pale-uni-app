/**
 * NeuralCanvas — Main SVG container that renders the full neural network.
 * Handles layout computation, drag interactions, and tooltip state.
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
  output,
  signal,
  computed,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NeuronComponent } from '../neuron/neuron';
import { ConnectionComponent } from '../connection/connection';
import { TooltipComponent, TooltipItem } from '../tooltip/tooltip';
import {
  NetworkState,
  NeuronState,
  ConnectionState,
  DisplayMode,
  AnimationState,
} from '../../engine/neural-network.types';

interface NeuronPosition {
  neuron: NeuronState;
  x: number;
  y: number;
}

interface ConnectionPosition {
  connection: ConnectionState;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  animating: boolean;
  particleProgress: number;
}

interface LayerLabel {
  text: string;
  x: number;
}

@Component({
  selector: 'app-neural-canvas',
  standalone: true,
  imports: [NeuronComponent, ConnectionComponent, TooltipComponent],
  templateUrl: './neural-canvas.html',
  styleUrl: './neural-canvas.css',
})
export class NeuralCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  /** Network state to render */
  readonly network = input.required<NetworkState>();
  /** Display mode (beginner/advanced) */
  readonly displayMode = input<DisplayMode>('beginner');
  /** Current animation state */
  readonly animationState = input<AnimationState>('idle');
  /** Layer currently being animated (for forward/backward pass) */
  readonly animatingLayer = input<number>(-1);
  /** Particle progress 0→1 for animation */
  readonly animParticleProgress = input<number>(0);

  /** Output for neuron drag events */
  readonly neuronDrag = output<{ neuronId: string; x: number; y: number }>();
  /** Output for neuron click events */
  readonly neuronClick = output<NeuronState>();

  readonly canvasWidth = signal(800);
  readonly canvasHeight = signal(500);

  // Tooltip state
  readonly tooltipVisible = signal(false);
  readonly tooltipX = signal(0);
  readonly tooltipY = signal(0);
  readonly tooltipTitle = signal('');
  readonly tooltipItems = signal<TooltipItem[]>([]);
  readonly tooltipFormula = signal('');

  private resizeObserver: ResizeObserver | null = null;
  private dragNeuron: NeuronState | null = null;

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  // ─── Layout ──────────────────────────────────────────────────────

  /** Compute positions for all neurons using even spacing */
  readonly neuronPositions = computed((): NeuronPosition[] => {
    const net = this.network();
    if (!net.layers.length) return [];

    const w = this.canvasWidth();
    const h = this.canvasHeight();
    const padding = 80;
    const topPadding = 50;
    const numLayers = net.layers.length;
    const layerSpacing = (w - padding * 2) / Math.max(numLayers - 1, 1);

    const positions: NeuronPosition[] = [];

    for (const layer of net.layers) {
      const x = padding + layer.index * layerSpacing;
      const numNeurons = layer.neurons.length;
      const neuronSpacing =
        (h - topPadding - padding) / Math.max(numNeurons + 1, 2);

      for (let ni = 0; ni < numNeurons; ni++) {
        const neuron = layer.neurons[ni];
        // Use custom position if dragged, otherwise compute
        const posX =
          neuron.position.x !== 0 ? neuron.position.x : x;
        const posY =
          neuron.position.y !== 0
            ? neuron.position.y
            : topPadding + neuronSpacing * (ni + 1);

        positions.push({ neuron, x: posX, y: posY });
      }
    }

    return positions;
  });

  /** Compute connection line positions */
  readonly connectionPositions = computed((): ConnectionPosition[] => {
    const net = this.network();
    const neuronPos = this.neuronPositions();
    const animState = this.animationState();
    const animLayer = this.animatingLayer();
    const particleProg = this.animParticleProgress();

    if (!neuronPos.length) return [];

    const posMap = new Map<string, NeuronPosition>();
    for (const np of neuronPos) {
      posMap.set(np.neuron.id, np);
    }

    return net.connections.map((conn) => {
      const from = posMap.get(conn.fromNeuronId);
      const to = posMap.get(conn.toNeuronId);

      // Determine if this connection is being animated
      const fromNeuron = from?.neuron;
      const toNeuron = to?.neuron;
      let animating = false;
      let progress = 0;

      if (animState === 'forward' && toNeuron && toNeuron.layerIndex === animLayer) {
        animating = true;
        progress = particleProg;
      } else if (animState === 'backward' && fromNeuron && fromNeuron.layerIndex === animLayer) {
        animating = true;
        progress = 1 - particleProg; // Reverse direction
      }

      return {
        connection: conn,
        x1: from?.x ?? 0,
        y1: from?.y ?? 0,
        x2: to?.x ?? 0,
        y2: to?.y ?? 0,
        animating,
        particleProgress: progress,
      };
    });
  });

  /** Layer labels for the top of the canvas */
  readonly layerLabels = computed((): LayerLabel[] => {
    const net = this.network();
    const w = this.canvasWidth();
    const padding = 80;
    const numLayers = net.layers.length;
    const layerSpacing = (w - padding * 2) / Math.max(numLayers - 1, 1);

    return net.layers.map((layer) => ({
      text:
        layer.type === 'input'
          ? 'Input'
          : layer.type === 'output'
            ? 'Output'
            : `Hidden ${layer.index}`,
      x: padding + layer.index * layerSpacing,
    }));
  });

  // ─── Lifecycle ───────────────────────────────────────────────────

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            this.canvasWidth.set(entry.contentRect.width);
            this.canvasHeight.set(entry.contentRect.height);
          }
        }
      });
      this.resizeObserver.observe(this.containerRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  // ─── Tooltip Handlers ────────────────────────────────────────────

  onNeuronHover(event: MouseEvent, neuron: NeuronState): void {
    const mode = this.displayMode();
    const items: TooltipItem[] = [
      { label: 'Activation', value: neuron.activation.toFixed(4) },
      { label: 'Bias', value: neuron.bias.toFixed(4) },
    ];
    if (mode === 'advanced') {
      items.push(
        { label: 'Pre-activation (z)', value: neuron.preActivation.toFixed(4) },
        { label: 'Delta (δ)', value: neuron.delta.toFixed(6) }
      );
    }

    const formula =
      mode === 'advanced' ? 'a = σ(Σ(w·x) + b)' : '';

    this.tooltipVisible.set(true);
    this.tooltipX.set(event.clientX);
    this.tooltipY.set(event.clientY);
    this.tooltipTitle.set(`Neuron ${neuron.id}`);
    this.tooltipItems.set(items);
    this.tooltipFormula.set(formula);
  }

  onNeuronLeave(): void {
    this.tooltipVisible.set(false);
  }

  onNeuronClick(neuron: NeuronState): void {
    this.neuronClick.emit(neuron);
  }

  onConnectionHover(event: MouseEvent, conn: ConnectionState): void {
    const mode = this.displayMode();
    const items: TooltipItem[] = [
      { label: 'Weight', value: conn.weight.toFixed(4) },
    ];
    if (mode === 'advanced') {
      items.push({
        label: 'Gradient',
        value: conn.gradient.toFixed(6),
      });
    }

    this.tooltipVisible.set(true);
    this.tooltipX.set(event.clientX);
    this.tooltipY.set(event.clientY);
    this.tooltipTitle.set('Connection');
    this.tooltipItems.set(items);
    this.tooltipFormula.set(
      mode === 'advanced' ? 'w_new = w - lr × ∂L/∂w' : ''
    );
  }

  onConnectionLeave(): void {
    this.tooltipVisible.set(false);
  }

  // ─── Drag to Reposition ──────────────────────────────────────────

  onNeuronDragStart(event: MouseEvent, neuron: NeuronState): void {
    event.preventDefault();
    this.dragNeuron = neuron;

    const onMove = (e: MouseEvent) => {
      if (!this.dragNeuron) return;
      const rect = this.containerRef.nativeElement.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.neuronDrag.emit({ neuronId: this.dragNeuron.id, x, y });
    };

    const onUp = () => {
      this.dragNeuron = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  onMouseMove(event: MouseEvent): void {
    if (this.tooltipVisible()) {
      this.tooltipX.set(event.clientX);
      this.tooltipY.set(event.clientY);
    }
  }

  onMouseLeave(): void {
    this.tooltipVisible.set(false);
  }
}
