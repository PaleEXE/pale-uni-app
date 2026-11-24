/**
 * Connection — SVG component for a weighted connection line between neurons.
 * Uses only theme-consistent primary color tokens (solid bright primary for
 * positive weights, dashed deep primary for negative weights).
 */

import { Component, input, computed } from '@angular/core';
import { ConnectionState } from '../../engine/neural-network.types';

@Component({
  selector: '[appConnection]',
  standalone: true,
  templateUrl: './connection.html',
  styleUrl: './connection.css',
})
export class ConnectionComponent {
  /** Connection data */
  readonly connection = input.required<ConnectionState>();
  /** Source position */
  readonly x1 = input.required<number>();
  readonly y1 = input.required<number>();
  /** Target position */
  readonly x2 = input.required<number>();
  readonly y2 = input.required<number>();
  /** Whether to show weight label at midpoint */
  readonly showWeight = input<boolean>(false);
  /** Whether to show animated particle */
  readonly showParticle = input<boolean>(false);
  /** Particle progress 0→1 for forward, used by parent to animate */
  readonly particleProgress = input<number>(0);

  /** Whether weight is negative */
  readonly isNegative = computed(() => this.connection().weight < 0);

  /** Line color: vibrant primary for positive weights, deep primary for negative */
  readonly lineColor = computed(() => {
    const w = this.connection().weight;
    if (w >= 0) {
      const pct = Math.round((Math.min(w, 2) / 2) * 75 + 25);
      return `color-mix(in srgb, var(--color-primary-500) ${pct}%, var(--color-primary-300))`;
    } else {
      const pct = Math.round((Math.min(Math.abs(w), 2) / 2) * 75 + 25);
      return `color-mix(in srgb, var(--color-primary-900) ${pct}%, var(--color-primary-700))`;
    }
  });

  /** Line width proportional to |weight| */
  readonly lineWidth = computed(() => {
    const w = Math.abs(this.connection().weight);
    return Math.max(0.75, Math.min(w * 2, 4.5));
  });

  /** Opacity based on weight magnitude */
  readonly opacity = computed(() => {
    const w = Math.abs(this.connection().weight);
    return Math.max(0.25, Math.min(w * 0.5 + 0.3, 0.95));
  });

  /** Midpoint for weight label */
  readonly midX = computed(() => (this.x1() + this.x2()) / 2);
  readonly midY = computed(() => (this.y1() + this.y2()) / 2);

  /** Formatted weight text */
  readonly weightText = computed(() => {
    const w = this.connection().weight;
    return w.toFixed(2);
  });

  /** Particle position interpolated along line */
  readonly particleX = computed(() => {
    const t = this.particleProgress();
    return this.x1() + (this.x2() - this.x1()) * t;
  });

  readonly particleY = computed(() => {
    const t = this.particleProgress();
    return this.y1() + (this.y2() - this.y1()) * t;
  });

  /** Particle color matches weight sign within theme palette */
  readonly particleColor = computed(() => {
    const w = this.connection().weight;
    return w >= 0 ? 'var(--color-primary-500)' : 'var(--color-primary-900)';
  });
}
