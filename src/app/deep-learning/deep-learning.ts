/**
 * DeepLearning — Main page component that orchestrates the neural network visualizer.
 * Manages animation state, connects components, handles presets and keyboard shortcuts.
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
import { CustomDatasetComponent } from './components/custom-dataset/custom-dataset';
import { NeuralNetworkService } from './engine/neural-network.service';
import {
  NETWORK_PRESETS,
  NetworkPreset,
  getPresetById,
} from './engine/network-presets';
import {
  DisplayMode,
  AnimationState,
  ActivationFnType,
  NeuronState,
  TrainingSample,
} from './engine/neural-network.types';

@Component({
  selector: 'app-deep-learning',
  standalone: true,
  imports: [
    NeuralCanvasComponent,
    ControlPanelComponent,
    LossGraphComponent,
    CustomDatasetComponent,
  ],
  providers: [NeuralNetworkService],
  templateUrl: './deep-learning.html',
  styleUrl: './deep-learning.css',
})
export class DeepLearningComponent implements OnDestroy {
  readonly nnService: NeuralNetworkService;

  readonly logicGatePresets: NetworkPreset[] = NETWORK_PRESETS.filter(
    (p) => p.category === 'Logic Gates'
  );
  readonly introPresets: NetworkPreset[] = NETWORK_PRESETS.filter(
    (p) => p.category === 'Introductory Examples'
  );

  readonly displayMode = signal<DisplayMode>('beginner');
  readonly animationState = signal<AnimationState>('idle');
  readonly animatingLayer = signal(-1);
  readonly particleProgress = signal(0);
  readonly selectedNeuron = signal<NeuronState | null>(null);

  // Progressive-disclosure UI state (all secondary details hidden by default)
  readonly datasetModalOpen = signal(false);
  readonly editSamplesOpen = signal(false);
  readonly previewDatasetOpen = signal(false);
  readonly normalizationDetailsOpen = signal(false);

  readonly activePreset = computed(() =>
    getPresetById(this.nnService.activePresetId())
  );

  readonly datasetStatusLabel = computed(() => {
    const samples = this.nnService.trainingData().length;
    const inputs = this.nnService.config().inputSize;
    const outputs = this.nnService.config().outputSize;
    return `${samples} sample${samples === 1 ? '' : 's'} · ${inputs} input${inputs === 1 ? '' : 's'} · ${outputs} target${outputs === 1 ? '' : 's'}`;
  });

  readonly inputFeatureLabels = computed(() =>
    Array.from({ length: this.nnService.config().inputSize }, (_, i) => `x${i + 1}`)
  );

  readonly targetFeatureLabels = computed(() => {
    const count = this.nnService.config().outputSize;
    if (count === 1) return ['y'];
    return Array.from({ length: count }, (_, i) => `y${i + 1}`);
  });

  readonly datasetPreviewRows = computed(() => {
    const data = this.nnService.trainingData();
    return data.map((sample, idx) => ({
      index: idx + 1,
      rawInputs: sample.inputs,
      normalizedInputs: this.nnService.normalizeInputs(sample.inputs),
      rawTargets: sample.targets,
      normalizedTargets: this.nnService.normalizeTargets(sample.targets),
    }));
  });

  readonly defaultInferenceInput = computed(() => {
    const preset = this.activePreset();
    if (preset) return preset.defaultInferenceInput;
    const data = this.nnService.trainingData();
    if (data.length > 0) return [...data[0].inputs];
    return new Array(this.nnService.config().inputSize).fill(0);
  });

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

  // ─── Preset Selection ───────────────────────────────────────────

  onPresetChange(event: Event): void {
    const presetId = (event.target as HTMLSelectElement).value;
    const preset = getPresetById(presetId);
    if (!preset) return;

    this.stopAutoTrain();
    this.cancelAnimation();
    this.selectedNeuron.set(null);
    this.nnService.loadPreset(preset);
  }

  onOpenDatasetModal(): void {
    this.datasetModalOpen.set(true);
  }

  onCloseDatasetModal(): void {
    this.datasetModalOpen.set(false);
  }

  onApplyCustomDataset(event: {
    samples: TrainingSample[];
    inputSize: number;
    outputSize: number;
  }): void {
    this.stopAutoTrain();
    this.cancelAnimation();
    this.selectedNeuron.set(null);
    this.nnService.loadCustomDataset(
      event.samples,
      event.inputSize,
      event.outputSize
    );
    this.datasetModalOpen.set(false);
  }

  formatPreviewNumber(val: number): string {
    if (!Number.isFinite(val)) return '0';
    return Number.isInteger(val) ? String(val) : val.toFixed(3);
  }

  formatPreviewArray(arr: number[], decimals: number): string {
    return (
      '[' +
      arr
        .map((v) =>
          decimals === 0 && Number.isInteger(v) ? String(v) : v.toFixed(decimals)
        )
        .join(', ') +
      ']'
    );
  }

  // ─── Forward Pass with Animation ────────────────────────────────

  onForwardPass(): void {
    if (!this.isBrowser) return;
    const data = this.nnService.trainingData();
    if (data.length === 0) return;

    const sample = data[this.nnService.sampleIndex % data.length];
    this.nnService.forwardPass(sample.inputs);
    const normalizedTargets = this.nnService.normalizeTargets(sample.targets);
    this.nnService.training.update((t) => ({
      ...t,
      currentTargets: [...sample.targets],
      currentNormalizedTargets: normalizedTargets,
    }));
    this.animateForwardPass();
  }

  private animateForwardPass(): void {
    const steps = this.nnService.forwardSteps();
    if (steps.length === 0) return;

    this.cancelAnimation();
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

    this.cancelAnimation();
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
    const interval = Math.max(40, 400 / this.animationSpeed);
    const stepsPerTick = Math.max(1, Math.round(this.animationSpeed / 8));
    this.nnService.setTrainingStatus(true);
    this.autoTrainInterval = setInterval(() => {
      for (let i = 0; i < stepsPerTick; i++) {
        this.nnService.trainStep();
      }
    }, interval);
  }

  private stopAutoTrain(): void {
    if (this.autoTrainInterval) {
      clearInterval(this.autoTrainInterval);
      this.autoTrainInterval = null;
    }
    this.nnService.setTrainingStatus(false);
  }

  // ─── Configuration Handlers ─────────────────────────────────────

  onReset(): void {
    this.stopAutoTrain();
    this.cancelAnimation();
    this.selectedNeuron.set(null);
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

  onSampleChange(index: number, type: 'inputs' | 'targets', event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    const parsed = val
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));
    const newData = [...this.nnService.trainingData()];
    if (type === 'inputs') {
      newData[index] = { ...newData[index], inputs: parsed };
    } else {
      newData[index] = { ...newData[index], targets: parsed };
    }
    this.nnService.setTrainingData(newData);
  }

  onRemoveSample(index: number): void {
    const newData = this.nnService.trainingData().filter((_, i) => i !== index);
    this.nnService.setTrainingData(newData);
  }

  onAddSample(): void {
    const cfg = this.nnService.config();
    const newData = [
      ...this.nnService.trainingData(),
      {
        inputs: new Array(cfg.inputSize).fill(0),
        targets: new Array(cfg.outputSize).fill(0),
      },
    ];
    this.nnService.setTrainingData(newData);
  }

  onRunInference(inputs: number[]): void {
    this.nnService.predict(inputs);
    this.animateForwardPass();
  }

  onActivationFnChange(fn: ActivationFnType): void {
    this.stopAutoTrain();
    this.cancelAnimation();
    this.nnService.setActivationFunction(fn);
    this.selectedNeuron.set(null);
  }

  onAddLayer(): void {
    this.stopAutoTrain();
    this.cancelAnimation();
    this.nnService.addHiddenLayer();
    this.selectedNeuron.set(null);
  }

  onRemoveLayer(): void {
    this.stopAutoTrain();
    this.cancelAnimation();
    this.nnService.removeHiddenLayer();
    this.selectedNeuron.set(null);
  }

  onLayerSizeChange(event: { index: number; delta: number }): void {
    this.stopAutoTrain();
    this.cancelAnimation();
    const cfg = this.nnService.config();
    const newLayers = [...cfg.hiddenLayers];
    newLayers[event.index] = Math.max(
      1,
      Math.min(8, newLayers[event.index] + event.delta)
    );
    this.nnService.setHiddenLayers(newLayers);
    this.selectedNeuron.set(null);
  }

  onSpeedChange(speed: number): void {
    this.animationSpeed = speed;
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
    if (event.key === 'Escape') {
      if (this.datasetModalOpen()) {
        this.onCloseDatasetModal();
        return;
      }
      if (this.selectedNeuron()) {
        this.onCloseNodeEditor();
        return;
      }
    }

    if (
      this.datasetModalOpen() ||
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
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
