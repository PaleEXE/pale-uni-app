import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-mode-toggle',
  standalone: true,
  templateUrl: './mode-toggle.html',
})
export class ModeToggleComponent {
  @Input() interactionMode: 'draw' | 'pan' = 'draw';
  @Output() interactionModeChange = new EventEmitter<'draw' | 'pan'>();

  @Input() deleteMode: boolean = false;
  @Output() deleteModeChange = new EventEmitter<boolean>();
}
