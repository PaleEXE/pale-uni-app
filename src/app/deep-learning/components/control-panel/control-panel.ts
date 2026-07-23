/**
 * ControlPanel — Sidebar with all interactive controls for the neural network.
 */

import { Component, input, output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NetworkConfig,
  TrainingState,
  TrainingSample,
  DisplayMode,
  ActivationFnType,
} from '../../engine/neural-network.types';

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
  /** Current training data */
  readonly trainingData = input.required<TrainingSample[]>();
  /** Display mode */
  readonly displayMode = input<DisplayMode>('beginner');

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
  readonly updateTrainingData = output<TrainingSample[]>();
  readonly runInference = output<number[]>();

  readonly isAutoTraining = signal(false);
  readonly animationSpeed = signal(5);
  readonly inferenceInputs = signal<number[]>([0, 0]);

  readonly hiddenLayerCount = computed(() => this.config().hiddenLayers.length);
  readonly hiddenLayerSizes = computed(() => this.config().hiddenLayers);
  readonly learningRate = computed(() => this.config().learningRate);
  readonly activationFn = computed(() => this.config().activationFn);
  readonly epoch = computed(() => this.trainingState().epoch);
  readonly currentLoss = computed(() => this.trainingState().currentLoss);
  readonly currentInputs = computed(() => this.trainingState().currentInputs);
  readonly currentOutputs = computed(() => this.trainingState().currentOutputs);
  readonly currentTargets = computed(() => this.trainingState().currentTargets);

  onForwardPass(): void {
    this.forwardPass.emit();
  }

  onTrainStep(): void {
    this.trainStep.emit();
  }

  onAutoTrain(): void {
    this.isAutoTraining.update((v) => !v);
    this.autoTrain.emit();
  }

  onReset(): void {
    this.isAutoTraining.set(false);
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

  // ─── Training Data Edit Handlers ───
  onSampleChange(index: number, type: 'inputs' | 'targets', event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    const parsed = val.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    const newData = [...this.trainingData()];
    if (type === 'inputs') {
      newData[index] = { ...newData[index], inputs: parsed };
    } else {
      newData[index] = { ...newData[index], targets: parsed };
    }
    this.updateTrainingData.emit(newData);
  }

  onRemoveSample(index: number): void {
    const newData = this.trainingData().filter((_, i) => i !== index);
    this.updateTrainingData.emit(newData);
  }

  onAddSample(): void {
    const cfg = this.config();
    const newData = [...this.trainingData(), {
      inputs: new Array(cfg.inputSize).fill(0),
      targets: new Array(cfg.outputSize).fill(0)
    }];
    this.updateTrainingData.emit(newData);
  }

  // ─── Live Inference ───
  onInferenceChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    const parsed = val.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    this.inferenceInputs.set(parsed);
  }

  onRunInference(): void {
    this.runInference.emit(this.inferenceInputs());
  }

  formatArray(arr: number[]): string {
    return '[' + arr.map((v) => v.toFixed(2)).join(', ') + ']';
  }
}
