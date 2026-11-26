/**
 * CustomDatasetComponent — Focused modal content for entering, validating,
 * and applying a multiline custom dataset (`x1, x2, ..., y`).
 */

import { Component, computed, output, signal } from '@angular/core';
import {
  DatasetParseResult,
  TrainingSample,
} from '../../engine/neural-network.types';
import { parseCustomDataset } from '../../engine/dataset-parser';

const EXAMPLE_CUSTOM_DATASET = [
  '10, 200, 1, 50',
  '20, 400, 2, 100',
  '30, 600, 3, 150',
  '40, 800, 4, 200',
].join('\n');

@Component({
  selector: 'app-custom-dataset',
  standalone: true,
  imports: [],
  templateUrl: './custom-dataset.html',
})
export class CustomDatasetComponent {
  /** Emits validated dataset payload when user clicks Apply Dataset */
  readonly applyDataset = output<{
    samples: TrainingSample[];
    inputSize: number;
    outputSize: number;
  }>();

  /** Emits when user cancels or closes the modal */
  readonly close = output<void>();

  readonly rawText = signal<string>(EXAMPLE_CUSTOM_DATASET);

  readonly parseResult = computed<DatasetParseResult>(() =>
    parseCustomDataset(this.rawText())
  );

  onTextInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.rawText.set(value);
  }

  onLoadExample(): void {
    this.rawText.set(EXAMPLE_CUSTOM_DATASET);
  }

  onApplyDataset(): void {
    const result = this.parseResult();
    if (!result.isValid) return;

    this.applyDataset.emit({
      samples: result.samples,
      inputSize: result.inputCount,
      outputSize: result.outputCount,
    });
  }

  onClose(): void {
    this.close.emit();
  }
}
