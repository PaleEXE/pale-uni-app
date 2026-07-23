import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-layout',
  standalone: true,
  templateUrl: './page-layout.html',
})
export class PageLayoutComponent {
  @Input({ required: true }) title!: string;
}
