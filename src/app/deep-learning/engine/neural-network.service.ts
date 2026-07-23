/**
 * NeuralNetworkService — Angular injectable managing the entire neural network state.
 * Uses signals for reactive state management. Implements real forward/backpropagation.
 */

import { Injectable, signal, computed } from '@angular/core';
import {
  NetworkConfig,
  NetworkState,
  LayerState,
  NeuronState,
  ConnectionState,
  TrainingState,
  TrainingSample,
  ForwardPassStep,
  BackpropStep,
  ActivationFnType,
  DEFAULT_NETWORK_CONFIG,
  DEFAULT_TRAINING_DATA,
} from './neural-network.types';
import {
  getActivationFn,
  getActivationDerivative,
  matVecMul,
  addBias,
  applyActivation,
  meanSquaredError,
  mseDerivative,
  xavierInit,
  randomBias,
  gradientDescentUpdate,
} from './math.utils';

@Injectable()
export class NeuralNetworkService {
  // ─── Configuration ───────────────────────────────────────────────
  readonly config = signal<NetworkConfig>({ ...DEFAULT_NETWORK_CONFIG });

  // ─── Network State ───────────────────────────────────────────────
  readonly network = signal<NetworkState>({
    layers: [],
    connections: [],
    activationFn: 'sigmoid',
  });

  // ─── Training Data (user-editable) ──────────────────────────────
  readonly trainingData = signal<TrainingSample[]>([...DEFAULT_TRAINING_DATA]);

  // ─── Training State ──────────────────────────────────────────────
  readonly training = signal<TrainingState>({
    epoch: 0,
    currentLoss: 0,
    lossHistory: [],
    isTraining: false,
    currentInputs: [0, 0],
    currentTargets: [0],
    currentOutputs: [0],
  });

  // ─── Animation Step Data ─────────────────────────────────────────
  readonly forwardSteps = signal<ForwardPassStep[]>([]);
  readonly backpropSteps = signal<BackpropStep[]>([]);

  // ─── Computed ────────────────────────────────────────────────────
  readonly layerSizes = computed(() => {
    const cfg = this.config();
    return [cfg.inputSize, ...cfg.hiddenLayers, cfg.outputSize];
  });

  readonly totalNeurons = computed(() =>
    this.layerSizes().reduce((sum, s) => sum + s, 0)
  );

  /** Current sample index cycling through training data */
  sampleIndex = 0;

  constructor() {
    this.buildNetwork(this.config());
  }

  // ─── Network Construction ────────────────────────────────────────

  /** Build network from configuration. Initializes weights + biases. */
  buildNetwork(config: NetworkConfig): void {
    this.config.set({ ...config });
    const sizes = [config.inputSize, ...config.hiddenLayers, config.outputSize];
    const layers: LayerState[] = [];
    const connections: ConnectionState[] = [];

    // Create layers and neurons
    for (let li = 0; li < sizes.length; li++) {
      const neurons: NeuronState[] = [];
      const layerType: LayerState['type'] =
        li === 0 ? 'input' : li === sizes.length - 1 ? 'output' : 'hidden';

      for (let ni = 0; ni < sizes[li]; ni++) {
        neurons.push({
          id: `n-${li}-${ni}`,
          layerIndex: li,
          neuronIndex: ni,
          preActivation: 0,
          activation: 0,
          bias: layerType === 'input' ? 0 : randomBias(),
          delta: 0,
          position: { x: 0, y: 0 },
        });
      }

      layers.push({ index: li, type: layerType, neurons });
    }

    // Create connections between consecutive layers
    for (let li = 0; li < layers.length - 1; li++) {
      const fromLayer = layers[li];
      const toLayer = layers[li + 1];
      for (const fromNeuron of fromLayer.neurons) {
        for (const toNeuron of toLayer.neurons) {
          connections.push({
            id: `c-${fromNeuron.id}-${toNeuron.id}`,
            fromNeuronId: fromNeuron.id,
            toNeuronId: toNeuron.id,
            weight: xavierInit(fromLayer.neurons.length, toLayer.neurons.length),
            gradient: 0,
          });
        }
      }
    }

    this.network.set({ layers, connections, activationFn: config.activationFn });

    // Reset training state
    this.training.set({
      epoch: 0,
      currentLoss: 0,
      lossHistory: [],
      isTraining: false,
      currentInputs: new Array(config.inputSize).fill(0),
      currentTargets: new Array(config.outputSize).fill(0),
      currentOutputs: new Array(config.outputSize).fill(0),
    });
    this.forwardSteps.set([]);
    this.backpropSteps.set([]);
    this.sampleIndex = 0;

    // Adjust training data to match new input/output sizes
    this.adjustTrainingData(config.inputSize, config.outputSize);
  }

  // ─── Forward Propagation ─────────────────────────────────────────

  /**
   * Runs a complete forward pass through the network.
   * Stores step-by-step data for animation.
   * Returns the output activations.
   */
  forwardPass(inputs: number[]): number[] {
    const net = this.deepCloneNetwork(this.network());
    const activationFn = getActivationFn(net.activationFn);
    const steps: ForwardPassStep[] = [];

    // Set input layer activations
    for (let i = 0; i < net.layers[0].neurons.length; i++) {
      net.layers[0].neurons[i].activation = inputs[i] ?? 0;
      net.layers[0].neurons[i].preActivation = inputs[i] ?? 0;
    }

    steps.push({
      layerIndex: 0,
      preActivations: net.layers[0].neurons.map((n) => n.preActivation),
      activations: net.layers[0].neurons.map((n) => n.activation),
    });

    // Propagate through each subsequent layer
    for (let li = 1; li < net.layers.length; li++) {
      const prevLayer = net.layers[li - 1];
      const currLayer = net.layers[li];

      // Build weight matrix for this layer pair
      const weights: number[][] = currLayer.neurons.map((toN) =>
        prevLayer.neurons.map((fromN) => {
          const conn = net.connections.find(
            (c) => c.fromNeuronId === fromN.id && c.toNeuronId === toN.id
          );
          return conn ? conn.weight : 0;
        })
      );

      const prevActivations = prevLayer.neurons.map((n) => n.activation);
      const biases = currLayer.neurons.map((n) => n.bias);

      // z = W · a_prev + b
      const z = addBias(matVecMul(weights, prevActivations), biases);
      // a = σ(z)
      const a = applyActivation(z, activationFn);

      for (let ni = 0; ni < currLayer.neurons.length; ni++) {
        currLayer.neurons[ni].preActivation = z[ni];
        currLayer.neurons[ni].activation = a[ni];
      }

      steps.push({
        layerIndex: li,
        preActivations: z,
        activations: a,
      });
    }

    this.network.set(net);
    this.forwardSteps.set(steps);

    const outputActivations = net.layers[net.layers.length - 1].neurons.map(
      (n) => n.activation
    );

    this.training.update((t) => ({
      ...t,
      currentInputs: [...inputs],
      currentOutputs: [...outputActivations],
    }));

    return outputActivations;
  }

  // ─── Backpropagation ─────────────────────────────────────────────

  /**
   * Runs backpropagation: computes gradients and updates weights.
   * Must be called after forwardPass().
   */
  backpropagate(targets: number[]): number {
    const net = this.deepCloneNetwork(this.network());
    const cfg = this.config();
    const activationDeriv = getActivationDerivative(net.activationFn);
    const steps: BackpropStep[] = [];

    const outputLayer = net.layers[net.layers.length - 1];
    const predictions = outputLayer.neurons.map((n) => n.activation);
    const loss = meanSquaredError(predictions, targets);
    const dLoss = mseDerivative(predictions, targets);

    // ── Output layer deltas ──
    for (let ni = 0; ni < outputLayer.neurons.length; ni++) {
      const neuron = outputLayer.neurons[ni];
      neuron.delta = dLoss[ni] * activationDeriv(neuron.preActivation);
    }

    steps.push({
      layerIndex: outputLayer.index,
      deltas: outputLayer.neurons.map((n) => n.delta),
      weightGradients: [],
    });

    // ── Hidden layer deltas (backward) ──
    for (let li = net.layers.length - 2; li >= 1; li--) {
      const currLayer = net.layers[li];
      const nextLayer = net.layers[li + 1];

      for (let ni = 0; ni < currLayer.neurons.length; ni++) {
        const neuron = currLayer.neurons[ni];
        let errorSum = 0;

        for (const nextNeuron of nextLayer.neurons) {
          const conn = net.connections.find(
            (c) =>
              c.fromNeuronId === neuron.id && c.toNeuronId === nextNeuron.id
          );
          if (conn) {
            errorSum += conn.weight * nextNeuron.delta;
          }
        }

        neuron.delta = errorSum * activationDeriv(neuron.preActivation);
      }

      steps.push({
        layerIndex: li,
        deltas: currLayer.neurons.map((n) => n.delta),
        weightGradients: [],
      });
    }

    // ── Compute weight gradients and update weights ──
    for (const conn of net.connections) {
      const fromNeuron = this.findNeuron(net, conn.fromNeuronId);
      const toNeuron = this.findNeuron(net, conn.toNeuronId);
      if (!fromNeuron || !toNeuron) continue;

      // gradient = δ_to * a_from
      conn.gradient = toNeuron.delta * fromNeuron.activation;
      conn.weight = gradientDescentUpdate(
        conn.weight,
        conn.gradient,
        cfg.learningRate
      );

      // Add weight gradient to corresponding backprop step
      const step = steps.find((s) => s.layerIndex === toNeuron.layerIndex);
      if (step) {
        step.weightGradients.push({
          connectionId: conn.id,
          gradient: conn.gradient,
        });
      }
    }

    // ── Update biases ──
    for (let li = 1; li < net.layers.length; li++) {
      for (const neuron of net.layers[li].neurons) {
        neuron.bias = gradientDescentUpdate(
          neuron.bias,
          neuron.delta,
          cfg.learningRate
        );
      }
    }

    this.network.set(net);
    this.backpropSteps.set(steps);

    this.training.update((t) => ({
      ...t,
      currentLoss: loss,
      currentTargets: [...targets],
      lossHistory: [...t.lossHistory, loss],
    }));

    return loss;
  }

  // ─── Training Step ───────────────────────────────────────────────

  /**
   * Executes one full training step using user-supplied training data.
   * Cycles through the training samples.
   */
  trainStep(): { loss: number; outputs: number[] } {
    const data = this.trainingData();
    if (data.length === 0) return { loss: 0, outputs: [] };

    const sample = data[this.sampleIndex % data.length];
    this.sampleIndex++;

    const outputs = this.forwardPass(sample.inputs);
    const loss = this.backpropagate(sample.targets);

    this.training.update((t) => ({
      ...t,
      epoch: t.epoch + 1,
    }));

    return { loss, outputs };
  }

  /**
   * Run a forward pass on a user-provided data point (prediction only, no training).
   */
  predict(inputs: number[]): number[] {
    return this.forwardPass(inputs);
  }

  /**
   * Run multiple training steps rapidly (for auto-training).
   */
  trainEpoch(stepsPerEpoch?: number): number {
    const data = this.trainingData();
    const steps = stepsPerEpoch ?? data.length;
    let totalLoss = 0;
    for (let i = 0; i < steps; i++) {
      const { loss } = this.trainStep();
      totalLoss += loss;
    }
    return totalLoss / steps;
  }

  // ─── Training Data Management ────────────────────────────────────

  /** Set training data from user input */
  setTrainingData(data: TrainingSample[]): void {
    this.trainingData.set(data);
    this.sampleIndex = 0;
  }

  /** Add a single training sample */
  addTrainingSample(sample: TrainingSample): void {
    this.trainingData.update((d) => [...d, sample]);
  }

  /** Remove a training sample by index */
  removeTrainingSample(index: number): void {
    this.trainingData.update((d) => d.filter((_, i) => i !== index));
    this.sampleIndex = 0;
  }

  /** Update a training sample */
  updateTrainingSample(index: number, sample: TrainingSample): void {
    this.trainingData.update((d) =>
      d.map((s, i) => (i === index ? sample : s))
    );
  }

  /** Adjust training data when input/output sizes change */
  private adjustTrainingData(inputSize: number, outputSize: number): void {
    this.trainingData.update((data) =>
      data.map((s) => ({
        inputs: Array.from({ length: inputSize }, (_, i) => s.inputs[i] ?? 0),
        targets: Array.from({ length: outputSize }, (_, i) => s.targets[i] ?? 0),
      }))
    );
  }

  // ─── Configuration Mutations ─────────────────────────────────────

  /** Update a single connection's weight */
  updateWeight(connectionId: string, newWeight: number): void {
    this.network.update((net) => {
      const connections = net.connections.map((c) =>
        c.id === connectionId ? { ...c, weight: newWeight } : c
      );
      return { ...net, connections };
    });
  }

  /** Update a neuron's bias */
  updateNeuronBias(neuronId: string, newBias: number): void {
    this.network.update((net) => ({
      ...net,
      layers: net.layers.map((layer) => ({
        ...layer,
        neurons: layer.neurons.map((n) =>
          n.id === neuronId ? { ...n, bias: newBias } : n
        ),
      })),
    }));
  }

  /** Change the activation function and rebuild */
  setActivationFunction(fn: ActivationFnType): void {
    const cfg = this.config();
    this.buildNetwork({ ...cfg, activationFn: fn });
  }

  /** Set learning rate */
  setLearningRate(lr: number): void {
    this.config.update((c) => ({ ...c, learningRate: lr }));
  }

  /** Update hidden layers and rebuild */
  setHiddenLayers(layers: number[]): void {
    const cfg = this.config();
    this.buildNetwork({ ...cfg, hiddenLayers: [...layers] });
  }

  /** Add a hidden layer */
  addHiddenLayer(neuronCount: number = 3): void {
    const cfg = this.config();
    this.buildNetwork({
      ...cfg,
      hiddenLayers: [...cfg.hiddenLayers, neuronCount],
    });
  }

  /** Remove the last hidden layer */
  removeHiddenLayer(): void {
    const cfg = this.config();
    if (cfg.hiddenLayers.length === 0) return;
    this.buildNetwork({
      ...cfg,
      hiddenLayers: cfg.hiddenLayers.slice(0, -1),
    });
  }

  /** Update neuron position (for drag interactions) */
  updateNeuronPosition(
    neuronId: string,
    position: { x: number; y: number }
  ): void {
    this.network.update((net) => {
      const layers = net.layers.map((layer) => ({
        ...layer,
        neurons: layer.neurons.map((n) =>
          n.id === neuronId ? { ...n, position } : n
        ),
      }));
      return { ...net, layers };
    });
  }

  /** Set input values */
  setInputs(inputs: number[]): void {
    this.training.update((t) => ({
      ...t,
      currentInputs: [...inputs],
    }));
  }

  /** Reset training state and rebuild the network */
  resetTraining(): void {
    this.training.set({
      epoch: 0,
      currentLoss: 0,
      lossHistory: [],
      isTraining: false,
      currentInputs: new Array(this.config().inputSize).fill(0),
      currentTargets: new Array(this.config().outputSize).fill(0),
      currentOutputs: new Array(this.config().outputSize).fill(0),
    });
    this.forwardSteps.set([]);
    this.backpropSteps.set([]);
    this.sampleIndex = 0;
    // Re-initialize weights
    this.buildNetwork(this.config());
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private findNeuron(net: NetworkState, id: string): NeuronState | undefined {
    for (const layer of net.layers) {
      const neuron = layer.neurons.find((n) => n.id === id);
      if (neuron) return neuron;
    }
    return undefined;
  }

  private deepCloneNetwork(net: NetworkState): NetworkState {
    return {
      activationFn: net.activationFn,
      layers: net.layers.map((l) => ({
        ...l,
        neurons: l.neurons.map((n) => ({
          ...n,
          position: { ...n.position },
        })),
      })),
      connections: net.connections.map((c) => ({ ...c })),
    };
  }
}
