/**
 * Neuron — SVG component rendering a single neuron with activation-based coloring.
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

  /** Glow intensity based on activation magnitude */
  readonly glowIntensity = computed(() => {
    const val = Math.abs(this.neuron().activation);
    return Math.min(val * 6, 8);
  });

  /** Fill color — interpolates from deep slate (negative) through dark gray (zero) to bright primary (positive) */
  readonly fillColor = computed(() => {
    const val = this.neuron().activation;
    // Primary-500 in my theme is typically amber (#f59e0b => 245, 158, 11)
    if (Math.abs(val) < 0.01) return '#1e293b'; // slate-800
    if (val > 0) {
      const t = Math.min(val, 1);
      const r = Math.round(30 + t * 215);  // 30 → 245
      const g = Math.round(41 + t * 117);  // 41 → 158
      const b = Math.round(59 - t * 48);   // 59 → 11
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      // Negative: keep slate/dark blue but make it fit the theme
      const t = Math.min(Math.abs(val), 1);
      const r = Math.round(30 - t * 15);   // 30 → 15
      const g = Math.round(41 + t * 50);   // 41 → 91
      const b = Math.round(59 + t * 100);  // 59 → 159
      return `rgb(${r}, ${g}, ${b})`;
    }
  });

  /** Stroke color */
  readonly strokeColor = computed(() => {
    const val = this.neuron().activation;
    if (val > 0.5) return 'var(--color-primary-400)';
    if (val < -0.5) return '#64748b'; // slate-500
    return '#475569';
  });

  /** Ring color for pulsing animation */
  readonly ringColor = computed(() => {
    const val = this.neuron().activation;
    if (val > 0) return 'var(--color-primary-500)';
    if (val < 0) return '#cbd5e1';
    return '#64748b';
  });

  /** Text color — contrasts with fill */
  readonly textColor = computed(() => {
    const val = Math.abs(this.neuron().activation);
    return val > 0.5 ? '#ffffff' : '#cbd5e1';
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
