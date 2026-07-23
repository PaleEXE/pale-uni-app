import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-alert-message',
  standalone: true,
  templateUrl: './alert-message.html',
})
export class AlertMessageComponent {
  @Input({ required: true }) type!: 'success' | 'error';
  @Input({ required: true }) message!: string;
}
