import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  WritableSignal,
  inject,
  signal,
  PLATFORM_ID,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-logic-evaluator',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './logic-evaluator.html',
  styleUrl: './logic-evaluator.css',
})
export class LogicEvaluator {
  private platformId = inject(PLATFORM_ID);
  lastExp: string = '';
  data: WritableSignal<number[][]> = signal([]);
  headers: WritableSignal<string[]> = signal([]);
  errMsg: WritableSignal<string> = signal('');

  constructor(private http: HttpClient) {
    if (isPlatformBrowser(this.platformId)) {
      const savedExpression = localStorage.getItem('logic-expression');
      const savedHeaders = localStorage.getItem('logic-headers');
      const savedData = localStorage.getItem('logic-data');

      if (savedExpression) this.lastExp = savedExpression;
      if (savedHeaders) this.headers.set(JSON.parse(savedHeaders));
      if (savedData) this.data.set(JSON.parse(savedData));
    }
  }

  onEvaluate(expressionInput: HTMLInputElement): void {
    const expression = expressionInput.value;

    if (expression === this.lastExp) {
      return;
    }
    if (expression.toLowerCase() === 'mimi') {
      this.errMsg.set('MIMI is always True');
      this.headers.set([]);
      this.data.set([]);
      return;
    }
    if (expression.toLowerCase() === 'mohammad') {
      this.errMsg.set(
        'Fools show their annoyance at once, but the prudent overlook an insult. - Jesus'
      );
      this.headers.set([]);
      this.data.set([]);
      return;
    }
    this.lastExp = expression;
    this.http
      .post<any>('http://127.0.0.1:8000/evaluate', { expression })
      .subscribe({
        next: (response) => {
          this.headers.set(response.headers);
          this.data.set(response.data);
          this.errMsg.set('');
          if (isPlatformBrowser(this.platformId)) {
            localStorage.setItem('logic-expression', this.lastExp);
            localStorage.setItem(
              'logic-headers',
              JSON.stringify(response.headers)
            );
            localStorage.setItem('logic-data', JSON.stringify(response.data));
          }
        },
        error: (error) => {
          const msg = error.error?.detail ?? 'Unknown error';

          this.errMsg.set(msg);
          this.headers.set([]);
          this.data.set([]);
        },
      });
  }
}
