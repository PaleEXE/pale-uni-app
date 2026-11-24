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
} from './math.utils';

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
});
