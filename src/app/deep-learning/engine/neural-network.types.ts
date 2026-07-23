/**
 * Type definitions for the Deep Learning Interactive Visualizer.
 * All neural network data structures and configuration types.
 */

/** Supported activation functions */
export type ActivationFnType = 'relu' | 'sigmoid' | 'tanh';

/** A single neuron's state */
export interface NeuronState {
  /** Unique identifier */
  id: string;
  /** Layer index this neuron belongs to */
  layerIndex: number;
  /** Index within its layer */
  neuronIndex: number;
  /** Current pre-activation value (z = Σ(w·x) + b) */
  preActivation: number;
  /** Current post-activation value a = σ(z) */
  activation: number;
  /** Bias term */
  bias: number;
  /** Gradient of loss w.r.t. this neuron's pre-activation (δ) */
  delta: number;
  /** Visual position (for dragging) */
  position: { x: number; y: number };
}

/** A weighted connection between two neurons */
export interface ConnectionState {
  /** Unique identifier */
  id: string;
  /** Source neuron ID */
  fromNeuronId: string;
  /** Target neuron ID */
  toNeuronId: string;
  /** Weight value */
  weight: number;
  /** Gradient of loss w.r.t. this weight */
  gradient: number;
}

/** A layer in the network */
export interface LayerState {
  /** Layer index */
  index: number;
  /** Type of layer */
  type: 'input' | 'hidden' | 'output';
  /** Neurons in this layer */
  neurons: NeuronState[];
}

/** Full network state */
export interface NetworkState {
  layers: LayerState[];
  connections: ConnectionState[];
  /** Current activation function */
  activationFn: ActivationFnType;
}

/** Configuration to build a network */
export interface NetworkConfig {
  /** Number of input neurons */
  inputSize: number;
  /** Array where each element is the neuron count for that hidden layer */
  hiddenLayers: number[];
  /** Number of output neurons */
  outputSize: number;
  /** Activation function to use */
  activationFn: ActivationFnType;
  /** Learning rate for gradient descent */
  learningRate: number;
}

/** A single training sample */
export interface TrainingSample {
  inputs: number[];
  targets: number[];
}

/** Training state tracked across steps */
export interface TrainingState {
  /** Current epoch number */
  epoch: number;
  /** Current loss value */
  currentLoss: number;
  /** History of loss values per step */
  lossHistory: number[];
  /** Whether training is currently running */
  isTraining: boolean;
  /** Current input values */
  currentInputs: number[];
  /** Current target values */
  currentTargets: number[];
  /** Current output/prediction values */
  currentOutputs: number[];
}

/** Data for animating a single forward-pass step */
export interface ForwardPassStep {
  /** Index of the layer being activated */
  layerIndex: number;
  /** Pre-activation values for neurons in this layer */
  preActivations: number[];
  /** Post-activation values for neurons in this layer */
  activations: number[];
}

/** Data for animating a single backprop step */
export interface BackpropStep {
  /** Index of the layer receiving gradients */
  layerIndex: number;
  /** Deltas computed for neurons in this layer */
  deltas: number[];
  /** Weight gradients for connections entering this layer */
  weightGradients: { connectionId: string; gradient: number }[];
}

/** Display mode for UI */
export type DisplayMode = 'beginner' | 'advanced';

/** Animation playback state */
export type AnimationState = 'idle' | 'forward' | 'backward' | 'paused';

/** Default network configuration */
export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  inputSize: 2,
  hiddenLayers: [4, 3],
  outputSize: 1,
  activationFn: 'sigmoid',
  learningRate: 0.1,
};

/** Default XOR training data */
export const DEFAULT_TRAINING_DATA: TrainingSample[] = [
  { inputs: [0, 0], targets: [0] },
  { inputs: [0, 1], targets: [1] },
  { inputs: [1, 0], targets: [1] },
  { inputs: [1, 1], targets: [0] },
];
