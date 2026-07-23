import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-modal-overlay',
  standalone: true,
  templateUrl: './modal-overlay.html',
})
export class ModalOverlayComponent {
  @Input({ required: true }) opened: boolean = false;
  @Output() closed = new EventEmitter<void>();

  close() {
    this.closed.emit();
  }
}
