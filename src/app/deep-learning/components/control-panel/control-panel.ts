/**
 * ControlPanel — Compact sidebar with essential training controls and
 * collapsible architecture/hyperparameter configuration.
 */

import {
  Component,
  input,
  output,
  computed,
  signal,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NetworkConfig,
  TrainingState,
  DisplayMode,
  ActivationFnType,
} from '../../engine/neural-network.types';

const ACTIVATION_LABELS: Record<ActivationFnType, string> = {
  sigmoid: 'Sigmoid',
  relu: 'ReLU',
  tanh: 'Tanh',
};

@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './control-panel.html',
  styleUrl: './control-panel.css',
})
export class ControlPanelComponent {
  /** Current network configuration */
  readonly config = input.required<NetworkConfig>();
  /** Current training state */
  readonly trainingState = input.required<TrainingState>();
  /** Display mode */
  readonly displayMode = input<DisplayMode>('beginner');
  /** Default inference input vector (updated when preset/dataset changes) */
  readonly defaultInferenceInput = input<number[]>([0, 0]);

  // Outputs
  readonly forwardPass = output<void>();
  readonly trainStep = output<void>();
  readonly autoTrain = output<void>();
  readonly reset = output<void>();
  readonly modeToggle = output<DisplayMode>();
  readonly learningRateChange = output<number>();
  readonly activationFnChange = output<ActivationFnType>();
  readonly addLayer = output<void>();
  readonly removeLayer = output<void>();
  readonly layerSizeChange = output<{ index: number; delta: number }>();
  readonly speedChange = output<number>();
  readonly runInference = output<number[]>();

  readonly animationSpeed = signal(5);
  readonly inferenceInputs = signal<number[]>([0, 0]);

  // Collapsible section states (essential sections open, secondary collapsed)
  readonly trainingOpen = signal(true);
  readonly trainingInfoOpen = signal(true);
  readonly architectureOpen = signal(false);
  readonly hyperparametersOpen = signal(false);

  readonly isAutoTraining = computed(() => this.trainingState().isTraining);
  readonly hiddenLayerCount = computed(() => this.config().hiddenLayers.length);
  readonly hiddenLayerSizes = computed(() => this.config().hiddenLayers);
  readonly architectureSummary = computed(() => {
    const cfg = this.config();
    return [cfg.inputSize, ...cfg.hiddenLayers, cfg.outputSize].join(' -> ');
  });
  readonly learningRate = computed(() => this.config().learningRate);
  readonly activationFn = computed(() => this.config().activationFn);
  readonly activationLabel = computed(
    () => ACTIVATION_LABELS[this.config().activationFn]
  );
  readonly epoch = computed(() => this.trainingState().epoch);
  readonly currentLoss = computed(() => this.trainingState().currentLoss);
  readonly currentInputs = computed(() => this.trainingState().currentInputs);
  readonly currentNormalizedInputs = computed(
    () => this.trainingState().currentNormalizedInputs
  );
  readonly currentOutputs = computed(() => this.trainingState().currentOutputs);
  readonly currentTargets = computed(() => this.trainingState().currentTargets);

  constructor() {
    effect(() => {
      const defaults = this.defaultInferenceInput();
      const inputSize = this.config().inputSize;
      const synced = Array.from(
        { length: inputSize },
        (_, i) => defaults[i] ?? 0
      );
      this.inferenceInputs.set(synced);
    });
  }

  onForwardPass(): void {
    this.forwardPass.emit();
  }

  onTrainStep(): void {
    this.trainStep.emit();
  }

  onAutoTrain(): void {
    this.autoTrain.emit();
  }

  onReset(): void {
    this.reset.emit();
  }

  onToggleMode(): void {
    const newMode: DisplayMode =
      this.displayMode() === 'beginner' ? 'advanced' : 'beginner';
    this.modeToggle.emit(newMode);
  }

  onLearningRateChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.learningRateChange.emit(value);
  }

  onActivationChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as ActivationFnType;
    this.activationFnChange.emit(value);
  }

  onAddLayer(): void {
    this.addLayer.emit();
  }

  onRemoveLayer(): void {
    this.removeLayer.emit();
  }

  onChangeLayerSize(index: number, delta: number): void {
    this.layerSizeChange.emit({ index, delta });
  }

  onSpeedChange(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.animationSpeed.set(value);
    this.speedChange.emit(value);
  }

  // ─── Live Inference ───
  onInferenceChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    const parsed = val
      .split(',')
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n));
    const inputSize = this.config().inputSize;
    const normalized = Array.from(
      { length: inputSize },
      (_, i) => parsed[i] ?? 0
    );
    this.inferenceInputs.set(normalized);
  }

  onRunInference(): void {
    this.runInference.emit(this.inferenceInputs());
  }

  formatArray(arr: number[]): string {
    return '[' + arr.map((v) => v.toFixed(2)).join(', ') + ']';
  }
}
