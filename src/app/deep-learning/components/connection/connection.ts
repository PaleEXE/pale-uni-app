/**
 * Connection — SVG component for a weighted connection line between neurons.
 */

import { Component, input, computed, signal } from '@angular/core';
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

  /** Line color: primary (amber) for positive weights, blue for negative */
  readonly lineColor = computed(() => {
    const w = this.connection().weight;
    if (w > 0) {
      const t = Math.min(w, 2) / 2;
      return `rgb(${Math.round(245 * t + 100 * (1 - t))}, ${Math.round(158 * t + 116 * (1 - t))}, ${Math.round(11 * t + 200 * (1 - t))})`;
    } else {
      const t = Math.min(Math.abs(w), 2) / 2;
      return `rgb(${Math.round(56 * t + 100 * (1 - t))}, ${Math.round(189 * t + 116 * (1 - t))}, ${Math.round(248 * t + 200 * (1 - t))})`;
    }
  });

  /** Line width proportional to |weight| */
  readonly lineWidth = computed(() => {
    const w = Math.abs(this.connection().weight);
    return Math.max(0.5, Math.min(w * 2, 5));
  });

  /** Opacity based on weight magnitude */
  readonly opacity = computed(() => {
    const w = Math.abs(this.connection().weight);
    return Math.max(0.15, Math.min(w * 0.5 + 0.2, 0.9));
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

  /** Particle color matches line color */
  readonly particleColor = computed(() => {
    const w = this.connection().weight;
    return w >= 0 ? 'var(--color-primary-500)' : '#38bdf8';
  });
}
