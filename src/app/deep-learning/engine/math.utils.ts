/**
 * Pure math functions for neural network computations.
 * No Angular dependencies — these are stateless utility functions.
 */

import {
  ActivationFnType,
  NormalizationStats,
  TrainingSample,
} from './neural-network.types';

// ─── Activation Functions ────────────────────────────────────────────

/** ReLU: max(0, x) */
export function relu(x: number): number {
  return Math.max(0, x);
}

/** Derivative of ReLU */
export function reluDerivative(x: number): number {
  return x > 0 ? 1 : 0;
}

/** Sigmoid: 1 / (1 + e^(-x)) */
export function sigmoid(x: number): number {
  const clamped = Math.max(-500, Math.min(500, x));
  return 1 / (1 + Math.exp(-clamped));
}

/** Derivative of sigmoid: σ(x) * (1 - σ(x)) */
export function sigmoidDerivative(x: number): number {
  const s = sigmoid(x);
  return s * (1 - s);
}

/** Tanh: (e^x - e^(-x)) / (e^x + e^(-x)) */
export function tanh(x: number): number {
  return Math.tanh(x);
}

/** Derivative of tanh: 1 - tanh²(x) */
export function tanhDerivative(x: number): number {
  const t = Math.tanh(x);
  return 1 - t * t;
}

/** Get activation function by name */
export function getActivationFn(type: ActivationFnType): (x: number) => number {
  switch (type) {
    case 'relu':
      return relu;
    case 'sigmoid':
      return sigmoid;
    case 'tanh':
      return tanh;
  }
}

/** Get activation derivative by name */
export function getActivationDerivative(type: ActivationFnType): (x: number) => number {
  switch (type) {
    case 'relu':
      return reluDerivative;
    case 'sigmoid':
      return sigmoidDerivative;
    case 'tanh':
      return tanhDerivative;
  }
}

// ─── Matrix Operations ───────────────────────────────────────────────

/**
 * Multiply a weight matrix by an input vector.
 * weights[i][j] = weight from input j to output i
 * Returns output vector of length weights.length
 */
export function matVecMul(weights: number[][], input: number[]): number[] {
  return weights.map((row) => row.reduce((sum, w, j) => sum + w * (input[j] ?? 0), 0));
}

/**
 * Add bias vector element-wise.
 */
export function addBias(values: number[], biases: number[]): number[] {
  return values.map((v, i) => v + (biases[i] ?? 0));
}

/**
 * Apply activation function element-wise.
 */
export function applyActivation(
  values: number[],
  fn: (x: number) => number
): number[] {
  return values.map(fn);
}

// ─── Loss Functions ──────────────────────────────────────────────────

/**
 * Mean Squared Error loss.
 * L = (1/n) * Σ(predicted - target)²
 */
export function meanSquaredError(predicted: number[], target: number[]): number {
  const n = predicted.length;
  if (n === 0) return 0;
  const sumSq = predicted.reduce(
    (sum, p, i) => sum + Math.pow(p - (target[i] ?? 0), 2),
    0
  );
  return sumSq / n;
}

/**
 * Derivative of MSE w.r.t. each prediction.
 * dL/dpred_i = (2/n) * (predicted_i - target_i)
 */
export function mseDerivative(predicted: number[], target: number[]): number[] {
  const n = predicted.length;
  if (n === 0) return [];
  return predicted.map((p, i) => (2 / n) * (p - (target[i] ?? 0)));
}

// ─── Weight Initialization ──────────────────────────────────────────

/**
 * Xavier (Glorot) initialization.
 * Samples from uniform distribution [-limit, limit]
 * where limit = sqrt(6 / (fanIn + fanOut))
 */
export function xavierInit(fanIn: number, fanOut: number): number {
  const limit = Math.sqrt(6 / (fanIn + fanOut));
  return (Math.random() * 2 - 1) * limit;
}

/**
 * Small random bias initialization.
 */
export function randomBias(): number {
  return (Math.random() * 2 - 1) * 0.1;
}

// ─── Gradient Descent ────────────────────────────────────────────────

/**
 * Update a weight using gradient descent.
 * w_new = w_old - learningRate * gradient
 */
export function gradientDescentUpdate(
  weight: number,
  gradient: number,
  learningRate: number
): number {
  return weight - learningRate * gradient;
}

// ─── Input Normalization (Min-Max [0, 1]) ────────────────────────────

/**
 * Compute per-feature minimum and maximum values from the training dataset only.
 * Returns identity bounds [0, 1] when the dataset is empty.
 */
export function computeMinMaxStats(
  samples: TrainingSample[],
  inputSize: number
): NormalizationStats {
  if (inputSize <= 0) {
    return { min: [], max: [] };
  }

  if (samples.length === 0) {
    return {
      min: new Array(inputSize).fill(0),
      max: new Array(inputSize).fill(1),
    };
  }

  const min = new Array<number>(inputSize).fill(Infinity);
  const max = new Array<number>(inputSize).fill(-Infinity);

  for (const sample of samples) {
    for (let i = 0; i < inputSize; i++) {
      const raw = sample.inputs[i] ?? 0;
      const value = Number.isFinite(raw) ? raw : 0;
      if (value < min[i]) min[i] = value;
      if (value > max[i]) max[i] = value;
    }
  }

  return { min, max };
}

/**
 * Min-Max normalize a single numerical feature value to [0, 1] using
 * training-set bounds. Safely returns 0 when min === max to avoid division by zero.
 */
export function normalizeValue(value: number, min: number, max: number): number {
  const safeValue = Number.isFinite(value) ? value : 0;
  const range = max - min;
  if (!Number.isFinite(range) || range === 0) {
    return 0;
  }
  return (safeValue - min) / range;
}

/**
 * Normalize an input feature vector using precomputed Min-Max statistics.
 */
export function normalizeInputs(
  inputs: number[],
  stats: NormalizationStats
): number[] {
  return stats.min.map((minVal, i) =>
    normalizeValue(inputs[i] ?? 0, minVal, stats.max[i])
  );
}

// ─── Output Normalization & Inverse Normalization (Min-Max [0, 1]) ───

/**
 * Compute per-target minimum and maximum values from the training dataset only.
 * Returns identity bounds [0, 1] when the dataset is empty.
 */
export function computeTargetMinMaxStats(
  samples: TrainingSample[],
  outputSize: number
): NormalizationStats {
  if (outputSize <= 0) {
    return { min: [], max: [] };
  }

  if (samples.length === 0) {
    return {
      min: new Array(outputSize).fill(0),
      max: new Array(outputSize).fill(1),
    };
  }

  const min = new Array<number>(outputSize).fill(Infinity);
  const max = new Array<number>(outputSize).fill(-Infinity);

  for (const sample of samples) {
    for (let i = 0; i < outputSize; i++) {
      const raw = sample.targets[i] ?? 0;
      const value = Number.isFinite(raw) ? raw : 0;
      if (value < min[i]) min[i] = value;
      if (value > max[i]) max[i] = value;
    }
  }

  return { min, max };
}

/**
 * Min-Max normalize a target vector to [0, 1] using training target bounds.
 */
export function normalizeTargets(
  targets: number[],
  stats: NormalizationStats
): number[] {
  return stats.min.map((minVal, i) =>
    normalizeValue(targets[i] ?? 0, minVal, stats.max[i])
  );
}

/**
 * Inverse Min-Max normalization for a single value.
 * Converts a normalized value back to the original target scale.
 * Safely returns min when min === max (constant target).
 */
export function denormalizeValue(
  normalizedValue: number,
  min: number,
  max: number
): number {
  const safeValue = Number.isFinite(normalizedValue) ? normalizedValue : 0;
  const range = max - min;
  if (!Number.isFinite(range) || range === 0) {
    return Number.isFinite(min) ? min : 0;
  }
  return safeValue * range + min;
}

/**
 * Inverse Min-Max normalization for an output vector.
 */
export function denormalizeOutputs(
  normalizedOutputs: number[],
  stats: NormalizationStats
): number[] {
  return stats.min.map((minVal, i) =>
    denormalizeValue(normalizedOutputs[i] ?? 0, minVal, stats.max[i])
  );
}
