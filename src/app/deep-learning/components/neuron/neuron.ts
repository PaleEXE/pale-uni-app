/**
 * Neuron — SVG component rendering a single neuron with activation-based coloring.
 * Uses only theme-consistent primary color tokens with clear distinctions for
 * inactive, positive, and negative activations.
 */

import { Component, input, computed } from '@angular/core';
import { NeuronState } from '../../engine/neural-network.types';

@Component({
  selector: '[appNeuron]',
  standalone: true,
  templateUrl: './neuron.html',
  styleUrl: './neuron.css',
})
export class NeuronComponent {
  /** The neuron data to render */
  readonly neuron = input.required<NeuronState>();
  /** X position */
  readonly x = input.required<number>();
  /** Y position */
  readonly y = input.required<number>();
  /** Whether to show the label */
  readonly showLabel = input<boolean>(false);

  readonly radius = 24;

  /** Whether activation is non-zero (for visual effects) */
  readonly isActive = computed(() => Math.abs(this.neuron().activation) > 0.01);

  /** Whether activation is negative */
  readonly isNegative = computed(() => this.neuron().activation < -0.01);

  /** Glow intensity based on activation magnitude */
  readonly glowIntensity = computed(() => {
    const val = Math.abs(this.neuron().activation);
    return Math.min(val * 3, 4);
  });

  /**
   * Fill color — theme-reactive primary palette only (no gray):
   * - Inactive (≈0): soft primary-100 tint
   * - Positive (>0): ramps from primary-200 to vibrant primary-600
   * - Negative (<0): ramps from primary-300 to deep primary-900 (paired with dashed border)
   */
  readonly fillColor = computed(() => {
    const val = this.neuron().activation;
    if (Math.abs(val) < 0.01) return 'var(--color-primary-100)';
    if (val > 0) {
      const pct = Math.round(Math.min(val, 1) * 85 + 15);
      return `color-mix(in srgb, var(--color-primary-600) ${pct}%, var(--color-primary-100))`;
    } else {
      const pct = Math.round(Math.min(Math.abs(val), 1) * 80 + 20);
      return `color-mix(in srgb, var(--color-primary-900) ${pct}%, var(--color-primary-200))`;
    }
  });

  /** Stroke color — theme-consistent primary shades */
  readonly strokeColor = computed(() => {
    const val = this.neuron().activation;
    if (val > 0.01) return 'var(--color-primary-700)';
    if (val < -0.01) return 'var(--color-primary-900)';
    return 'var(--color-primary-400)';
  });

  /** Ring color for active activation indicator */
  readonly ringColor = computed(() => {
    const val = this.neuron().activation;
    if (val > 0) return 'var(--color-primary-500)';
    if (val < 0) return 'var(--color-primary-800)';
    return 'var(--color-primary-300)';
  });

  /** Text color — high contrast against primary fill */
  readonly textColor = computed(() => {
    const val = this.neuron().activation;
    if (Math.abs(val) > 0.45) return '#ffffff';
    return 'var(--color-primary-900)';
  });

  /** Formatted activation value for display */
  readonly displayValue = computed(() => {
    const val = this.neuron().activation;
    if (Math.abs(val) < 0.001) return '0';
    return val.toFixed(2);
  });

  /** Label text based on layer type */
  readonly labelText = computed(() => {
    const n = this.neuron();
    if (n.layerIndex === 0) return `x${n.neuronIndex + 1}`;
    return `a${n.neuronIndex + 1}`;
  });
}
