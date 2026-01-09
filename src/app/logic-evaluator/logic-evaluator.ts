import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  WritableSignal,
  inject,
  signal,
  PLATFORM_ID,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-logic-evaluator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logic-evaluator.html',
  styleUrl: './logic-evaluator.css',
})
export class LogicEvaluator {
  private platformId = inject(PLATFORM_ID);
  lastExp: string = '';
  data: WritableSignal<number[][]> = signal([]);
  headers: WritableSignal<string[]> = signal([]);
  errMsg: WritableSignal<string> = signal('');
  equivalentResult: WritableSignal<boolean | null> = signal(null);
  conditionVars: WritableSignal<Array<{ name: string; value: '?' | 0 | 1 }>> =
    signal([]);

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

  private extractVariables(expression: string): string[] {
    const regex = /[a-zA-Z]\w*/g;
    const matches = expression.match(regex) || [];
    return [...new Set(matches)].sort();
  }

  onEvaluate(expressionInput: HTMLInputElement): void {
    const expression = expressionInput.value;

    // Skip only if expression is the same AND table already has data
    if (expression === this.lastExp && this.data().length > 0) {
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
    this.equivalentResult.set(null);

    // Extract and initialize condition variables
    const vars = this.extractVariables(expression);
    const newConditions = vars.map((name) => ({ name, value: '?' as const }));
    this.conditionVars.set(newConditions);

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

  onIsEquivalent(
    expressionInput: HTMLInputElement,
    expr2Input: HTMLInputElement
  ): void {
    const expr1 = expressionInput.value;
    const expr2 = expr2Input.value;

    if (!expr1 || !expr2) {
      this.errMsg.set('Please enter both expressions');
      return;
    }

    this.http
      .post<any>('http://127.0.0.1:8000/is_equivalent', {
        expression1: expr1,
        expression2: expr2,
      })
      .subscribe({
        next: (response) => {
          this.equivalentResult.set(response.equivalent);
          this.errMsg.set('');
          this.data.set([]);
          this.headers.set([]);
        },
        error: (error) => {
          const msg = error.error?.detail ?? 'Unknown error';
          this.errMsg.set(msg);
          this.equivalentResult.set(null);
          this.data.set([]);
          this.headers.set([]);
        },
      });
  }

  toggleConditionValue(index: number): void {
    const current = this.conditionVars();
    const updated = [...current];
    const currentValue = updated[index].value;

    // Cycle through: ? -> 1 -> 0 -> ?
    if (currentValue === '?') {
      updated[index].value = 1;
    } else if (currentValue === 1) {
      updated[index].value = 0;
    } else {
      updated[index].value = '?';
    }

    this.conditionVars.set(updated);

    // Apply filter automatically after toggling
    this.applyFilter();
  }

  private applyFilter(): void {
    if (!this.lastExp) {
      this.errMsg.set('Please enter an expression');
      return;
    }

    if (this.conditionVars().length === 0) {
      this.errMsg.set('Please evaluate an expression first');
      return;
    }

    try {
      const conditions: Record<string, number> = {};
      for (const condition of this.conditionVars()) {
        // Only include conditions that are not "?"
        if (condition.value !== '?') {
          conditions[condition.name] = condition.value;
        }
      }

      this.http
        .post<any>('http://127.0.0.1:8000/where', {
          expression: this.lastExp,
          conditions,
        })
        .subscribe({
          next: (response) => {
            this.headers.set(response.headers);
            this.data.set(response.data);
            this.errMsg.set('');
            this.equivalentResult.set(null);
          },
          error: (error) => {
            const msg = error.error?.detail ?? 'Unknown error';
            this.errMsg.set(msg);
            this.data.set([]);
            this.headers.set([]);
            this.equivalentResult.set(null);
          },
        });
    } catch (error: any) {
      this.errMsg.set(error.message);
      this.data.set([]);
      this.headers.set([]);
    }
  }

  onWhere(expressionInput: HTMLInputElement): void {
    const expression = expressionInput.value;

    if (!expression) {
      this.errMsg.set('Please enter an expression');
      return;
    }

    if (this.conditionVars().length === 0) {
      this.errMsg.set('Please evaluate an expression first');
      return;
    }

    try {
      const conditions: Record<string, number> = {};
      for (const condition of this.conditionVars()) {
        // Only include conditions that are not "?"
        if (condition.value !== '?') {
          conditions[condition.name] = condition.value;
        }
      }

      this.http
        .post<any>('http://127.0.0.1:8000/where', {
          expression,
          conditions,
        })
        .subscribe({
          next: (response) => {
            this.headers.set(response.headers);
            this.data.set(response.data);
            this.errMsg.set('');
            this.equivalentResult.set(null);
          },
          error: (error) => {
            const msg = error.error?.detail ?? 'Unknown error';
            this.errMsg.set(msg);
            this.data.set([]);
            this.headers.set([]);
            this.equivalentResult.set(null);
          },
        });
    } catch (error: any) {
      this.errMsg.set(error.message);
      this.data.set([]);
      this.headers.set([]);
    }
  }
}
