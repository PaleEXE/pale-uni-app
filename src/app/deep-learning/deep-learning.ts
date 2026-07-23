/**
 * DeepLearning — Main page component that orchestrates the neural network visualizer.
 * Manages animation state, connects components, handles keyboard shortcuts.
 */

import {
  Component,
  HostListener,
  Inject,
  OnDestroy,
  PLATFORM_ID,
  signal,
  computed,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NeuralCanvasComponent } from './components/neural-canvas/neural-canvas';
import { ControlPanelComponent } from './components/control-panel/control-panel';
import { LossGraphComponent } from './components/loss-graph/loss-graph';
import { NeuralNetworkService } from './engine/neural-network.service';
import {
  DisplayMode,
  AnimationState,
  ActivationFnType,
  NeuronState,
  ConnectionState,
  TrainingSample,
} from './engine/neural-network.types';

@Component({
  selector: 'app-deep-learning',
  standalone: true,
  imports: [NeuralCanvasComponent, ControlPanelComponent, LossGraphComponent],
  providers: [NeuralNetworkService],
  templateUrl: './deep-learning.html',
  styleUrl: './deep-learning.css',
})
export class DeepLearningComponent implements OnDestroy {
  readonly nnService: NeuralNetworkService;

  readonly displayMode = signal<DisplayMode>('beginner');
  readonly animationState = signal<AnimationState>('idle');
  readonly animatingLayer = signal(-1);
  readonly particleProgress = signal(0);
  readonly selectedNeuron = signal<NeuronState | null>(null);

  // Incoming connections for the selected neuron
  readonly selectedNeuronConnections = computed(() => {
    const neuron = this.selectedNeuron();
    if (!neuron) return [];
    return this.nnService.network().connections.filter(
      (c) => c.toNeuronId === neuron.id
    );
  });

  private autoTrainInterval: ReturnType<typeof setInterval> | null = null;
  private animationFrameId: number | null = null;
  private animationSpeed = 5;
  private isBrowser: boolean;

  constructor(
    nnService: NeuralNetworkService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.nnService = nnService;
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // ─── Forward Pass with Animation ────────────────────────────────

  onForwardPass(): void {
    if (!this.isBrowser) return;
    const data = this.nnService.trainingData();
    if (data.length === 0) return;
    
    const sample = data[this.nnService.sampleIndex % data.length];
    this.nnService.forwardPass(sample.inputs);
    this.nnService.training.update((t) => ({
      ...t,
      currentTargets: [...sample.targets],
    }));
    this.animateForwardPass();
  }

  private animateForwardPass(): void {
    const steps = this.nnService.forwardSteps();
    if (steps.length === 0) return;

    this.animationState.set('forward');
    let currentStep = 0;
    const totalSteps = steps.length;
    const stepDuration = 600 / this.animationSpeed;

    const animate = () => {
      if (currentStep >= totalSteps) {
        this.animationState.set('idle');
        this.animatingLayer.set(-1);
        this.particleProgress.set(0);
        return;
      }

      this.animatingLayer.set(steps[currentStep].layerIndex);
      const startTime = performance.now();

      const frame = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / stepDuration, 1);
        this.particleProgress.set(progress);

        if (progress < 1) {
          this.animationFrameId = requestAnimationFrame(frame);
        } else {
          currentStep++;
          animate();
        }
      };

      this.animationFrameId = requestAnimationFrame(frame);
    };

    animate();
  }

  // ─── Train Step with Animation ──────────────────────────────────

  onTrainStep(): void {
    if (!this.isBrowser) return;
    this.nnService.trainStep();
    this.animateBackpropagation();
  }

  private animateBackpropagation(): void {
    const steps = this.nnService.backpropSteps();
    if (steps.length === 0) return;

    this.animationState.set('backward');
    let currentStep = 0;
    const totalSteps = steps.length;
    const stepDuration = 500 / this.animationSpeed;

    const animate = () => {
      if (currentStep >= totalSteps) {
        this.animationState.set('idle');
        this.animatingLayer.set(-1);
        this.particleProgress.set(0);
        return;
      }

      this.animatingLayer.set(steps[currentStep].layerIndex);
      const startTime = performance.now();

      const frame = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / stepDuration, 1);
        this.particleProgress.set(progress);

        if (progress < 1) {
          this.animationFrameId = requestAnimationFrame(frame);
        } else {
          currentStep++;
          animate();
        }
      };

      this.animationFrameId = requestAnimationFrame(frame);
    };

    animate();
  }

  // ─── Auto Training ──────────────────────────────────────────────

  onAutoTrain(): void {
    if (!this.isBrowser) return;
    if (this.autoTrainInterval) {
      this.stopAutoTrain();
    } else {
      this.startAutoTrain();
    }
  }

  private startAutoTrain(): void {
    const interval = Math.max(50, 500 / this.animationSpeed);
    this.autoTrainInterval = setInterval(() => {
      this.nnService.trainStep();
    }, interval);
  }

  private stopAutoTrain(): void {
    if (this.autoTrainInterval) {
      clearInterval(this.autoTrainInterval);
      this.autoTrainInterval = null;
    }
  }

  // ─── Configuration Handlers ─────────────────────────────────────

  onReset(): void {
    this.stopAutoTrain();
    this.cancelAnimation();
    this.nnService.resetTraining();
  }

  onModeToggle(mode: DisplayMode): void {
    this.displayMode.set(mode);
  }

  onLearningRateChange(lr: number): void {
    this.nnService.setLearningRate(lr);
  }

  onUpdateTrainingData(data: TrainingSample[]): void {
    this.nnService.setTrainingData(data);
  }

  onRunInference(inputs: number[]): void {
    this.nnService.predict(inputs);
    this.animateForwardPass();
  }

  onActivationFnChange(fn: ActivationFnType): void {
    this.stopAutoTrain();
    this.nnService.setActivationFunction(fn);
    this.selectedNeuron.set(null); // Reset view
  }

  onAddLayer(): void {
    this.stopAutoTrain();
    this.nnService.addHiddenLayer();
    this.selectedNeuron.set(null); // Reset view
  }

  onRemoveLayer(): void {
    this.stopAutoTrain();
    this.nnService.removeHiddenLayer();
    this.selectedNeuron.set(null); // Reset view
  }

  onLayerSizeChange(event: { index: number; delta: number }): void {
    this.stopAutoTrain();
    const cfg = this.nnService.config();
    const newLayers = [...cfg.hiddenLayers];
    newLayers[event.index] = Math.max(
      1,
      Math.min(8, newLayers[event.index] + event.delta)
    );
    this.nnService.setHiddenLayers(newLayers);
    this.selectedNeuron.set(null); // Reset view
  }

  onSpeedChange(speed: number): void {
    this.animationSpeed = speed;
    // Restart auto-train with new speed if running
    if (this.autoTrainInterval) {
      this.stopAutoTrain();
      this.startAutoTrain();
    }
  }

  onNeuronDrag(event: { neuronId: string; x: number; y: number }): void {
    this.nnService.updateNeuronPosition(event.neuronId, {
      x: event.x,
      y: event.y,
    });
  }

  onNeuronClick(neuron: NeuronState): void {
    this.selectedNeuron.set(neuron);
  }

  onCloseNodeEditor(): void {
    this.selectedNeuron.set(null);
  }

  onBiasChange(event: Event): void {
    const neuron = this.selectedNeuron();
    if (!neuron) return;
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      this.nnService.updateNeuronBias(neuron.id, value);
    }
  }

  onWeightChange(connectionId: string, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      this.nnService.updateWeight(connectionId, value);
    }
  }

  // ─── Keyboard Shortcuts ─────────────────────────────────────────

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
      return;
    }

    switch (event.key) {
      case ' ':
        event.preventDefault();
        this.onTrainStep();
        break;
      case 'f':
        this.onForwardPass();
        break;
      case 'r':
        this.onReset();
        break;
      case 'a':
        this.onAutoTrain();
        break;
      case 'm':
        this.displayMode.set(
          this.displayMode() === 'beginner' ? 'advanced' : 'beginner'
        );
        break;
    }
  }

  // ─── Cleanup ────────────────────────────────────────────────────

  private cancelAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.animationState.set('idle');
    this.animatingLayer.set(-1);
    this.particleProgress.set(0);
  }

  ngOnDestroy(): void {
    this.stopAutoTrain();
    this.cancelAnimation();
  }
}
