/**
 * Prebuilt neural network presets for educational exploration.
 * Each preset configures the architecture, activation, learning rate,
 * and truth-table / training dataset for immediate training and testing.
 */

import { NetworkConfig, TrainingSample } from './neural-network.types';

export type PresetCategory = 'Logic Gates' | 'Introductory Examples';

export interface NetworkPreset {
  id: string;
  name: string;
  category: PresetCategory;
  description: string;
  config: NetworkConfig;
  trainingData: TrainingSample[];
  defaultInferenceInput: number[];
}

export const NETWORK_PRESETS: NetworkPreset[] = [
  // ─── Logic Gates ──────────────────────────────────────────────────
  {
    id: 'and',
    name: 'AND Gate',
    category: 'Logic Gates',
    description: 'Outputs 1 only when both inputs are 1 (linearly separable).',
    config: {
      inputSize: 2,
      hiddenLayers: [2],
      outputSize: 1,
      activationFn: 'sigmoid',
      learningRate: 0.5,
    },
    trainingData: [
      { inputs: [0, 0], targets: [0] },
      { inputs: [0, 1], targets: [0] },
      { inputs: [1, 0], targets: [0] },
      { inputs: [1, 1], targets: [1] },
    ],
    defaultInferenceInput: [1, 1],
  },
  {
    id: 'or',
    name: 'OR Gate',
    category: 'Logic Gates',
    description: 'Outputs 1 when at least one input is 1 (linearly separable).',
    config: {
      inputSize: 2,
      hiddenLayers: [2],
      outputSize: 1,
      activationFn: 'sigmoid',
      learningRate: 0.5,
    },
    trainingData: [
      { inputs: [0, 0], targets: [0] },
      { inputs: [0, 1], targets: [1] },
      { inputs: [1, 0], targets: [1] },
      { inputs: [1, 1], targets: [1] },
    ],
    defaultInferenceInput: [0, 1],
  },
  {
    id: 'xor',
    name: 'XOR Gate',
    category: 'Logic Gates',
    description: 'Outputs 1 when inputs differ — classic non-linearly separable problem.',
    config: {
      inputSize: 2,
      hiddenLayers: [4],
      outputSize: 1,
      activationFn: 'sigmoid',
      learningRate: 0.8,
    },
    trainingData: [
      { inputs: [0, 0], targets: [0] },
      { inputs: [0, 1], targets: [1] },
      { inputs: [1, 0], targets: [1] },
      { inputs: [1, 1], targets: [0] },
    ],
    defaultInferenceInput: [1, 0],
  },
  {
    id: 'nand',
    name: 'NAND Gate',
    category: 'Logic Gates',
    description: 'Outputs 0 only when both inputs are 1 (universal logic gate).',
    config: {
      inputSize: 2,
      hiddenLayers: [2],
      outputSize: 1,
      activationFn: 'sigmoid',
      learningRate: 0.5,
    },
    trainingData: [
      { inputs: [0, 0], targets: [1] },
      { inputs: [0, 1], targets: [1] },
      { inputs: [1, 0], targets: [1] },
      { inputs: [1, 1], targets: [0] },
    ],
    defaultInferenceInput: [1, 1],
  },
  {
    id: 'nor',
    name: 'NOR Gate',
    category: 'Logic Gates',
    description: 'Outputs 1 only when both inputs are 0 (universal logic gate).',
    config: {
      inputSize: 2,
      hiddenLayers: [2],
      outputSize: 1,
      activationFn: 'sigmoid',
      learningRate: 0.5,
    },
    trainingData: [
      { inputs: [0, 0], targets: [1] },
      { inputs: [0, 1], targets: [0] },
      { inputs: [1, 0], targets: [0] },
      { inputs: [1, 1], targets: [0] },
    ],
    defaultInferenceInput: [0, 0],
  },
  {
    id: 'not',
    name: 'NOT Gate (Inverter)',
    category: 'Logic Gates',
    description: 'Single-input inverter mapping 0 to 1 and 1 to 0.',
    config: {
      inputSize: 1,
      hiddenLayers: [2],
      outputSize: 1,
      activationFn: 'sigmoid',
      learningRate: 0.5,
    },
    trainingData: [
      { inputs: [0], targets: [1] },
      { inputs: [1], targets: [0] },
    ],
    defaultInferenceInput: [0],
  },

  // ─── Introductory Examples ────────────────────────────────────────
  {
    id: 'xnor',
    name: 'XNOR Gate (Equivalence)',
    category: 'Introductory Examples',
    description: 'Outputs 1 when both inputs are equal — requires a hidden layer.',
    config: {
      inputSize: 2,
      hiddenLayers: [4],
      outputSize: 1,
      activationFn: 'sigmoid',
      learningRate: 0.8,
    },
    trainingData: [
      { inputs: [0, 0], targets: [1] },
      { inputs: [0, 1], targets: [0] },
      { inputs: [1, 0], targets: [0] },
      { inputs: [1, 1], targets: [1] },
    ],
    defaultInferenceInput: [1, 1],
  },
  {
    id: 'half-adder',
    name: 'Binary Half Adder',
    category: 'Introductory Examples',
    description: 'Multi-output network computing [Sum, Carry] for two binary bits.',
    config: {
      inputSize: 2,
      hiddenLayers: [4],
      outputSize: 2,
      activationFn: 'sigmoid',
      learningRate: 0.8,
    },
    trainingData: [
      { inputs: [0, 0], targets: [0, 0] },
      { inputs: [0, 1], targets: [1, 0] },
      { inputs: [1, 0], targets: [1, 0] },
      { inputs: [1, 1], targets: [0, 1] },
    ],
    defaultInferenceInput: [1, 1],
  },
  {
    id: 'majority',
    name: '3-Input Majority Vote',
    category: 'Introductory Examples',
    description: '3-input classifier outputting 1 when at least two inputs are 1.',
    config: {
      inputSize: 3,
      hiddenLayers: [4],
      outputSize: 1,
      activationFn: 'sigmoid',
      learningRate: 0.5,
    },
    trainingData: [
      { inputs: [0, 0, 0], targets: [0] },
      { inputs: [0, 0, 1], targets: [0] },
      { inputs: [0, 1, 0], targets: [0] },
      { inputs: [0, 1, 1], targets: [1] },
      { inputs: [1, 0, 0], targets: [0] },
      { inputs: [1, 0, 1], targets: [1] },
      { inputs: [1, 1, 0], targets: [1] },
      { inputs: [1, 1, 1], targets: [1] },
    ],
    defaultInferenceInput: [1, 1, 0],
  },
];

export const DEFAULT_PRESET_ID = 'xor';

export function getPresetById(id: string): NetworkPreset | undefined {
  return NETWORK_PRESETS.find((preset) => preset.id === id);
}
