import { NeuralNetworkService } from './neural-network.service';
import { NETWORK_PRESETS, getPresetById } from './network-presets';
import {
  sigmoid,
  sigmoidDerivative,
  relu,
  reluDerivative,
  tanh,
  tanhDerivative,
  meanSquaredError,
  mseDerivative,
  computeMinMaxStats,
  normalizeValue,
  normalizeInputs,
  computeTargetMinMaxStats,
  normalizeTargets,
  denormalizeValue,
  denormalizeOutputs,
} from './math.utils';
import { parseCustomDataset } from './dataset-parser';

/**
 * Deterministic PRNG (Mulberry32) so convergence tests are repeatable
 * while still testing genuine random weight initialization.
 */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('NeuralNetworkService & Presets', () => {
  let service: NeuralNetworkService;

  beforeEach(() => {
    service = new NeuralNetworkService();
  });

  describe('Math utilities', () => {
    it('computes activation functions and derivatives accurately', () => {
      expect(sigmoid(0)).toBeCloseTo(0.5, 6);
      expect(sigmoidDerivative(0)).toBeCloseTo(0.25, 6);
      expect(relu(-3)).toBe(0);
      expect(relu(2.5)).toBe(2.5);
      expect(reluDerivative(-1)).toBe(0);
      expect(reluDerivative(1)).toBe(1);
      expect(tanh(0)).toBeCloseTo(0, 6);
      expect(tanhDerivative(0)).toBeCloseTo(1, 6);
    });

    it('computes MSE and its derivative safely without NaN', () => {
      expect(meanSquaredError([0.8, 0.2], [1, 0])).toBeCloseTo(0.04, 6);
      expect(mseDerivative([0.8, 0.2], [1, 0])[0]).toBeCloseTo(-0.2, 6);
      expect(mseDerivative([0.8, 0.2], [1, 0])[1]).toBeCloseTo(0.2, 6);
      expect(meanSquaredError([], [])).toBe(0);
      expect(Number.isNaN(meanSquaredError([0.5], []))).toBeFalse();
    });
  });

  describe('Prebuilt neural network convergence and truth tables', () => {
    for (const preset of NETWORK_PRESETS) {
      it(`trains and converges accurately on preset: ${preset.name}`, () => {
        const seeded = createSeededRandom(42);
        spyOn(Math, 'random').and.callFake(seeded);

        service.loadPreset(preset);

        // Verify architecture and dataset loaded cleanly
        expect(service.config().inputSize).toBe(preset.config.inputSize);
        expect(service.config().outputSize).toBe(preset.config.outputSize);
        expect(service.config().hiddenLayers).toEqual(preset.config.hiddenLayers);
        expect(service.trainingData().length).toBe(preset.trainingData.length);
        expect(service.training().epoch).toBe(0);
        expect(service.training().lossHistory.length).toBe(0);

        const initialLoss = service.evaluateDatasetLoss();
        const maxSteps = preset.id === 'half-adder' || preset.id === 'xor' || preset.id === 'xnor' ? 12000 : 5000;

        for (let step = 0; step < maxSteps; step++) {
          const { loss } = service.trainStep();
          if (loss < 0.005) break;
        }

        const finalLoss = service.evaluateDatasetLoss();
        expect(finalLoss).toBeLessThan(initialLoss);
        expect(finalLoss).toBeLessThan(0.02);

        // Verify every single row of the preset's truth table
        for (const sample of preset.trainingData) {
          const prediction = service.predict(sample.inputs);
          expect(prediction.length).toBe(sample.targets.length);
          for (let i = 0; i < sample.targets.length; i++) {
            const expected = sample.targets[i];
            const predictedBit = prediction[i] >= 0.5 ? 1 : 0;
            expect(predictedBit)
              .withContext(
                `${preset.name} input [${sample.inputs.join(', ')}] output[${i}] predicted ${prediction[i].toFixed(4)} expected ${expected}`
              )
              .toBe(expected);
            expect(Math.abs(prediction[i] - expected)).toBeLessThan(0.2);
          }
        }
      });
    }
  });

  describe('State integrity and edge cases', () => {
    it('switches presets of different dimensions without leaking state', () => {
      const notPreset = getPresetById('not')!;
      const halfAdderPreset = getPresetById('half-adder')!;
      const majorityPreset = getPresetById('majority')!;

      service.loadPreset(notPreset);
      service.trainEpoch(10);
      expect(service.training().epoch).toBe(10);
      expect(service.network().layers[0].neurons.length).toBe(1);

      service.loadPreset(halfAdderPreset);
      expect(service.training().epoch).toBe(0);
      expect(service.training().lossHistory.length).toBe(0);
      expect(service.training().currentLoss).toBe(0);
      expect(service.network().layers[0].neurons.length).toBe(2);
      expect(
        service.network().layers[service.network().layers.length - 1].neurons.length
      ).toBe(2);

      service.loadPreset(majorityPreset);
      expect(service.network().layers[0].neurons.length).toBe(3);
      expect(service.trainingData().length).toBe(8);
      expect(service.predict([1, 1, 0]).length).toBe(1);
    });

    it('handles empty training data and malformed samples gracefully', () => {
      service.setTrainingData([]);
      const res = service.trainStep();
      expect(res.loss).toBe(0);
      expect(res.outputs).toEqual([]);
      expect(service.evaluateDatasetLoss()).toBe(0);

      service.setTrainingData([{ inputs: [1], targets: [] }]);
      const step = service.trainStep();
      expect(Number.isNaN(step.loss)).toBeFalse();
    });

    it('resets training state and supports layer/activation changes cleanly', () => {
      service.setTrainingStatus(true);
      service.trainEpoch(20);
      expect(service.training().epoch).toBe(20);

      service.resetTraining();
      expect(service.training().epoch).toBe(0);
      expect(service.training().lossHistory.length).toBe(0);
      expect(service.training().isTraining).toBeFalse();

      service.addHiddenLayer(3);
      expect(service.config().hiddenLayers.length).toBe(2);

      service.removeHiddenLayer();
      expect(service.config().hiddenLayers.length).toBe(1);

      service.setActivationFunction('tanh');
      expect(service.config().activationFn).toBe('tanh');
      expect(service.network().activationFn).toBe('tanh');
    });
  });

  describe('Input normalization (Min-Max [0, 1])', () => {
    it('normalizes multi-feature inputs with different ranges into [0, 1]', () => {
      const samples = [
        { inputs: [100, -50, 0.2], targets: [0] },
        { inputs: [300, 0, 0.6], targets: [1] },
        { inputs: [500, 50, 1.0], targets: [1] },
      ];

      const stats = computeMinMaxStats(samples, 3);
      expect(stats.min).toEqual([100, -50, 0.2]);
      expect(stats.max).toEqual([500, 50, 1.0]);

      for (const sample of samples) {
        const normalized = normalizeInputs(sample.inputs, stats);
        expect(normalized.length).toBe(3);
        for (const v of normalized) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }

      expect(normalizeInputs([100, -50, 0.2], stats)).toEqual([0, 0, 0]);
      const mid = normalizeInputs([300, 0, 0.6], stats);
      expect(mid[0]).toBeCloseTo(0.5, 6);
      expect(mid[1]).toBeCloseTo(0.5, 6);
      expect(mid[2]).toBeCloseTo(0.5, 6);
      expect(normalizeInputs([500, 50, 1.0], stats)).toEqual([1, 1, 1]);
    });

    it('handles constant features (identical min and max) safely without division by zero', () => {
      const samples = [
        { inputs: [42, 10], targets: [0] },
        { inputs: [42, 30], targets: [1] },
      ];

      service.setTrainingData(samples);
      expect(service.normalizationStats()).toEqual({
        min: [42, 10],
        max: [42, 30],
      });

      expect(normalizeValue(42, 42, 42)).toBe(0);
      const norm = service.normalizeInputs([42, 20]);
      expect(Number.isNaN(norm[0])).toBeFalse();
      expect(Number.isFinite(norm[0])).toBeTrue();
      expect(norm[0]).toBe(0);
      expect(norm[1]).toBeCloseTo(0.5, 6);

      // Training and prediction should produce finite values without NaN
      const step = service.trainStep();
      expect(Number.isNaN(step.loss)).toBeFalse();
      const pred = service.predict([42, 30]);
      expect(Number.isNaN(pred[0])).toBeFalse();
    });

    it('preserves original input values for display and does not normalize targets', () => {
      const rawSamples = [
        { inputs: [10, 200], targets: [0] },
        { inputs: [30, 400], targets: [1] },
      ];

      service.setTrainingData(rawSamples);

      // Original training data must remain unnormalized
      expect(service.trainingData()).toEqual(rawSamples);

      service.forwardPass([20, 300]);

      // Display state preserves original inputs while exposing normalized inputs
      expect(service.training().currentInputs).toEqual([20, 300]);
      expect(service.training().currentNormalizedInputs[0]).toBeCloseTo(0.5, 6);
      expect(service.training().currentNormalizedInputs[1]).toBeCloseTo(0.5, 6);

      // Input layer neurons receive the normalized inputs
      const inputNeurons = service.network().layers[0].neurons;
      expect(inputNeurons[0].activation).toBeCloseTo(0.5, 6);
      expect(inputNeurons[1].activation).toBeCloseTo(0.5, 6);

      // Target labels remain untouched during training
      service.trainStep();
      expect(service.training().currentTargets).toEqual([0]);
      service.trainStep();
      expect(service.training().currentTargets).toEqual([1]);
    });

    it('uses training-set normalization parameters during prediction and handles out-of-range values', () => {
      service.setTrainingData([
        { inputs: [10, 100], targets: [0] },
        { inputs: [20, 200], targets: [1] },
      ]);

      const statsBefore = service.normalizationStats();
      expect(statsBefore).toEqual({ min: [10, 100], max: [20, 200] });

      // Predict with values outside the training range (below min and above max)
      const outAbove = service.predict([25, 300]);
      expect(Number.isFinite(outAbove[0])).toBeTrue();
      expect(service.training().currentInputs).toEqual([25, 300]);
      expect(service.training().currentNormalizedInputs[0]).toBeCloseTo(1.5, 6);
      expect(service.training().currentNormalizedInputs[1]).toBeCloseTo(2.0, 6);

      const outBelow = service.predict([5, 50]);
      expect(Number.isFinite(outBelow[0])).toBeTrue();
      expect(service.training().currentInputs).toEqual([5, 50]);
      expect(service.training().currentNormalizedInputs[0]).toBeCloseTo(-0.5, 6);
      expect(service.training().currentNormalizedInputs[1]).toBeCloseTo(-0.5, 6);

      // Prediction must not alter training-derived normalization parameters
      expect(service.normalizationStats()).toEqual(statsBefore);

      // Prediction matches evaluateForward identically
      const predInRange = service.predict([15, 150]);
      const evalInRange = service.evaluateForward(service.network(), [15, 150]);
      expect(predInRange[0]).toBeCloseTo(evalInRange[0], 10);
    });

    it('converges on unnormalized large-scale XOR inputs via pipeline normalization', () => {
      const seeded = createSeededRandom(42);
      spyOn(Math, 'random').and.callFake(seeded);

      service.buildNetwork({
        inputSize: 2,
        hiddenLayers: [4],
        outputSize: 1,
        activationFn: 'sigmoid',
        learningRate: 0.8,
      });

      const scaledXor = [
        { inputs: [100, -500], targets: [0] },
        { inputs: [100, 500], targets: [1] },
        { inputs: [200, -500], targets: [1] },
        { inputs: [200, 500], targets: [0] },
      ];
      service.setTrainingData(scaledXor);

      for (let step = 0; step < 12000; step++) {
        const { loss } = service.trainStep();
        if (loss < 0.005) break;
      }

      const finalLoss = service.evaluateDatasetLoss();
      expect(finalLoss).toBeLessThan(0.02);

      for (const sample of scaledXor) {
        const prediction = service.predict(sample.inputs);
        const predictedBit = prediction[0] >= 0.5 ? 1 : 0;
        expect(predictedBit).toBe(sample.targets[0]);
      }
    });
  });

  describe('Custom Dataset Parser & Validation', () => {
    it('parses datasets with different numbers of input features (1, 3, and 4 inputs)', () => {
      const singleInput = parseCustomDataset('10, 100\n20, 200\n30, 300');
      expect(singleInput.isValid).toBeTrue();
      expect(singleInput.errors).toEqual([]);
      expect(singleInput.inputCount).toBe(1);
      expect(singleInput.outputCount).toBe(1);
      expect(singleInput.samples).toEqual([
        { inputs: [10], targets: [100] },
        { inputs: [20], targets: [200] },
        { inputs: [30], targets: [300] },
      ]);

      const threeInputs = parseCustomDataset(
        '1, 2, 3, 10\n\n4.5, -5, 6.25, 25\n'
      );
      expect(threeInputs.isValid).toBeTrue();
      expect(threeInputs.inputCount).toBe(3);
      expect(threeInputs.samples).toEqual([
        { inputs: [1, 2, 3], targets: [10] },
        { inputs: [4.5, -5, 6.25], targets: [25] },
      ]);

      const fourInputs = parseCustomDataset('1, 2, 3, 4, 50\n5, 6, 7, 8, 90');
      expect(fourInputs.isValid).toBeTrue();
      expect(fourInputs.inputCount).toBe(4);
      expect(fourInputs.samples.length).toBe(2);
    });

    it('rejects empty datasets, invalid numbers, missing values, and inconsistent columns', () => {
      const empty = parseCustomDataset('   \n  ');
      expect(empty.isValid).toBeFalse();
      expect(empty.errors.length).toBeGreaterThan(0);

      const badNum = parseCustomDataset('1, 2, 3\n4, abc, 6');
      expect(badNum.isValid).toBeFalse();
      expect(badNum.errors.some((e) => e.includes('Line 2') && e.includes('abc'))).toBeTrue();

      const missingVal = parseCustomDataset('1, , 3\n4, 5, 6');
      expect(missingVal.isValid).toBeFalse();
      expect(missingVal.errors.some((e) => e.includes('Line 1') && e.includes('Missing value'))).toBeTrue();

      const inconsistent = parseCustomDataset('1, 2, 3, 10\n4, 5, 20');
      expect(inconsistent.isValid).toBeFalse();
      expect(inconsistent.errors.some((e) => e.includes('Line 2') && e.includes('Inconsistent column count'))).toBeTrue();

      const tooFew = parseCustomDataset('42');
      expect(tooFew.isValid).toBeFalse();
      expect(tooFew.errors.some((e) => e.includes('Line 1'))).toBeTrue();
    });
  });

  describe('Output Normalization, Inverse Normalization & Custom Dataset Integration', () => {
    it('verifies target Min-Max normalization and inverse normalization mathematically', () => {
      const samples = [
        { inputs: [1, 2], targets: [50] },
        { inputs: [2, 4], targets: [125] },
        { inputs: [3, 6], targets: [200] },
      ];

      const stats = computeTargetMinMaxStats(samples, 1);
      expect(stats).toEqual({ min: [50], max: [200] });

      const norm0 = normalizeTargets([50], stats);
      const normMid = normalizeTargets([125], stats);
      const norm1 = normalizeTargets([200], stats);

      expect(norm0[0]).toBeCloseTo(0, 6);
      expect(normMid[0]).toBeCloseTo(0.5, 6);
      expect(norm1[0]).toBeCloseTo(1, 6);

      // Inverse normalization recovers original values exactly
      expect(denormalizeOutputs(norm0, stats)[0]).toBeCloseTo(50, 6);
      expect(denormalizeOutputs(normMid, stats)[0]).toBeCloseTo(125, 6);
      expect(denormalizeOutputs(norm1, stats)[0]).toBeCloseTo(200, 6);

      // Handles negative target ranges accurately
      const negVal = normalizeValue(-25, -50, 50);
      expect(negVal).toBeCloseTo(0.25, 6);
      expect(denormalizeValue(negVal, -50, 50)).toBeCloseTo(-25, 6);
    });

    it('handles constant target values safely without division by zero', () => {
      const samples = [
        { inputs: [1, 10], targets: [75] },
        { inputs: [2, 20], targets: [75] },
      ];

      service.loadCustomDataset(samples, 2, 1);
      expect(service.targetNormalizationStats()).toEqual({ min: [75], max: [75] });

      const normTarget = service.normalizeTargets([75]);
      expect(normTarget[0]).toBe(0);
      expect(Number.isFinite(normTarget[0])).toBeTrue();

      const denorm = service.denormalizeOutputs([0.42]);
      expect(denorm[0]).toBe(75);

      const step = service.trainStep();
      expect(Number.isNaN(step.loss)).toBeFalse();
      const pred = service.predict([1.5, 15]);
      expect(pred[0]).toBe(75);
    });

    it('handles input and output normalization independently and calculates loss on normalized targets', () => {
      const parsed = parseCustomDataset(
        '10, 100, 1, 50\n20, 200, 2, 100\n30, 300, 3, 250'
      );
      expect(parsed.isValid).toBeTrue();

      service.loadCustomDataset(parsed.samples, parsed.inputCount, parsed.outputCount);

      expect(service.activePresetId()).toBe('custom');
      expect(service.config().inputSize).toBe(3);
      expect(service.config().outputSize).toBe(1);
      expect(service.network().layers[0].neurons.length).toBe(3);

      // Independent normalization stats
      expect(service.normalizationStats()).toEqual({
        min: [10, 100, 1],
        max: [30, 300, 3],
      });
      expect(service.targetNormalizationStats()).toEqual({
        min: [50],
        max: [250],
      });

      // Original dataset values preserved
      expect(service.trainingData()).toEqual(parsed.samples);

      // Loss matches MSE against normalized targets
      const expectedLoss =
        parsed.samples.reduce((sum, sample) => {
          const normOut = service.evaluateForward(service.network(), sample.inputs);
          const normTarget = service.normalizeTargets(sample.targets);
          return sum + meanSquaredError(normOut, normTarget);
        }, 0) / parsed.samples.length;

      expect(service.evaluateDatasetLoss()).toBeCloseTo(expectedLoss, 10);
    });

    it('trains on a custom multi-feature dataset and returns predictions in the original output scale', () => {
      const seeded = createSeededRandom(123);
      spyOn(Math, 'random').and.callFake(seeded);

      const parsed = parseCustomDataset(
        [
          '10, 100, 1, 50',
          '20, 200, 2, 100',
          '30, 300, 3, 150',
          '40, 400, 4, 200',
        ].join('\n')
      );
      expect(parsed.isValid).toBeTrue();

      service.loadCustomDataset(parsed.samples, parsed.inputCount, parsed.outputCount);
      service.setLearningRate(0.5);

      const initialLoss = service.evaluateDatasetLoss();
      for (let step = 0; step < 6000; step++) {
        const { loss } = service.trainStep();
        if (loss < 0.001) break;
      }

      const finalLoss = service.evaluateDatasetLoss();
      expect(finalLoss).toBeLessThan(initialLoss);
      expect(finalLoss).toBeLessThan(0.01);

      // Predictions must be returned in the original [50, 200] output scale
      const predLow = service.predict([10, 100, 1]);
      const predMid = service.predict([25, 250, 2.5]);
      const predHigh = service.predict([40, 400, 4]);

      expect(predLow[0]).toBeGreaterThan(35);
      expect(predLow[0]).toBeLessThan(65);
      expect(predMid[0]).toBeGreaterThan(100);
      expect(predMid[0]).toBeLessThan(150);
      expect(predHigh[0]).toBeGreaterThan(185);
      expect(predHigh[0]).toBeLessThan(215);
      expect(predHigh[0]).toBeGreaterThan(predMid[0]);
      expect(predMid[0]).toBeGreaterThan(predLow[0]);

      // Display state preserves original inputs and denormalized outputs
      expect(service.training().currentInputs).toEqual([40, 400, 4]);
      expect(service.training().currentOutputs[0]).toBeCloseTo(predHigh[0], 6);
    });
  });
});
