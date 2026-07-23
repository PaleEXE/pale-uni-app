/**
 * Pure math functions for neural network computations.
 * No Angular dependencies — these are stateless utility functions.
 */

import { ActivationFnType } from './neural-network.types';

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
  return weights.map((row) => row.reduce((sum, w, j) => sum + w * input[j], 0));
}

/**
 * Add bias vector element-wise.
 */
export function addBias(values: number[], biases: number[]): number[] {
  return values.map((v, i) => v + biases[i]);
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
    (sum, p, i) => sum + Math.pow(p - target[i], 2),
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
  return predicted.map((p, i) => (2 / n) * (p - target[i]));
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
