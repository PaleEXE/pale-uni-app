/**
 * Parser and validator for user-entered multiline custom datasets.
 * Format: one data row per line as `x1, x2, ..., xn, y`.
 */

import { DatasetParseResult, TrainingSample } from './neural-network.types';

/**
 * Parse and validate a multiline CSV-like dataset string.
 * Each non-empty line must contain N >= 1 comma-separated numeric inputs
 * followed by 1 numeric target value (at least 2 values total per row),
 * and every row must have the same column count.
 */
export function parseCustomDataset(rawText: string): DatasetParseResult {
  const lines = rawText.split(/\r?\n/);
  const errors: string[] = [];
  const parsedSamples: TrainingSample[] = [];
  let expectedColumns: number | null = null;
  let nonEmptyCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    if (trimmedLine.length === 0) {
      continue;
    }

    nonEmptyCount++;
    const lineNum = i + 1;
    const rawTokens = trimmedLine.split(',');

    if (rawTokens.length < 2) {
      errors.push(
        `Line ${lineNum}: Expected at least 2 comma-separated values (inputs + 1 target), found ${rawTokens.length}.`
      );
      continue;
    }

    const values: number[] = [];
    let rowHasError = false;

    for (let col = 0; col < rawTokens.length; col++) {
      const token = rawTokens[col].trim();
      if (token.length === 0) {
        errors.push(`Line ${lineNum}: Missing value at column ${col + 1}.`);
        rowHasError = true;
        continue;
      }

      const num = Number(token);
      if (!Number.isFinite(num)) {
        errors.push(
          `Line ${lineNum}: "${token}" at column ${col + 1} is not a valid number.`
        );
        rowHasError = true;
        continue;
      }

      values.push(num);
    }

    if (rowHasError) {
      continue;
    }

    if (expectedColumns === null) {
      expectedColumns = values.length;
    } else if (values.length !== expectedColumns) {
      errors.push(
        `Line ${lineNum}: Inconsistent column count — expected ${expectedColumns} (${expectedColumns - 1} inputs + 1 target), found ${values.length}.`
      );
      continue;
    }

    parsedSamples.push({
      inputs: values.slice(0, -1),
      targets: [values[values.length - 1]],
    });
  }

  if (nonEmptyCount === 0) {
    errors.push(
      'Dataset is empty. Enter at least one row formatted as: x1, x2, y'
    );
  }

  const isValid = errors.length === 0 && parsedSamples.length > 0;
  const inputCount =
    isValid && expectedColumns !== null ? expectedColumns - 1 : 0;

  return {
    samples: isValid ? parsedSamples : [],
    inputCount,
    outputCount: 1,
    errors,
    isValid,
  };
}

/**
 * Format an array of single-output training samples into multiline text.
 */
export function formatDatasetAsText(samples: TrainingSample[]): string {
  return samples
    .map((s) => [...s.inputs, s.targets[0] ?? 0].join(', '))
    .join('\n');
}
