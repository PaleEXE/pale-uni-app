/**
 * Tooltip — Floating info component for neurons and connections.
 */

import { Component, input } from '@angular/core';

export interface TooltipItem {
  label: string;
  value: string;
}

@Component({
  selector: 'app-tooltip',
  standalone: true,
  templateUrl: './tooltip.html',
  styleUrl: './tooltip.css',
})
export class TooltipComponent {
  readonly visible = input<boolean>(false);
  readonly posX = input<number>(0);
  readonly posY = input<number>(0);
  readonly title = input<string>('');
  readonly items = input<TooltipItem[]>([]);
  readonly formula = input<string>('');
}
