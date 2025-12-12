import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface HighlightPart {
  text: string;
  isMatch: boolean;
}

interface Match {
  text: string;
  index: number;
  length: number;
}

@Component({
  selector: 'app-regex',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './regex.html',
  styleUrl: './regex.css',
})
export class RegexComponent {
  pattern: string = '';
  inputText: string = `I know this time
I won't escape these thoughts in my head
I need you tonight
But I'm gonna fight the feeling instead
I don't wanna feel
I don't wanna cry
So I'm gonna dance until I feel alright
I just need a dose of the right stuff
I just need a hit of your lovedrug`;
  highlightedText: HighlightPart[] = [];
  matches: Match[] = [];
  matchCount: number = 0;
  errorMessage: string = '';

  flags = {
    global: true,
    ignoreCase: false,
    multiline: false,
  };

  onPatternChange(): void {
    this.errorMessage = '';
    this.matches = [];
    this.matchCount = 0;
    this.highlightedText = [];

    if (!this.pattern) {
      this.highlightedText = [{ text: this.inputText, isMatch: false }];
      return;
    }

    if (this.pattern === '/LoveDrug/') {
      window.open('https://www.youtube.com/watch?v=tDwm4PdoYPw', '_blank');
    }

    try {
      const flagsStr =
        (this.flags.global ? 'g' : '') +
        (this.flags.ignoreCase ? 'i' : '') +
        (this.flags.multiline ? 'm' : '');

      const regex = new RegExp(this.pattern, flagsStr);
      let match;

      // Reset regex if global flag is set
      if (this.flags.global) {
        while ((match = regex.exec(this.inputText)) !== null) {
          this.matches.push({
            text: match[0],
            index: match.index,
            length: match[0].length,
          });
        }
      } else {
        match = regex.exec(this.inputText);
        if (match) {
          this.matches.push({
            text: match[0],
            index: match.index,
            length: match[0].length,
          });
        }
      }

      this.matchCount = this.matches.length;
      this.generateHighlightedText(regex);
    } catch (error: any) {
      this.errorMessage = `Invalid regex: ${error.message}`;
      this.highlightedText = [{ text: this.inputText, isMatch: false }];
    }
  }

  private generateHighlightedText(regex: RegExp): void {
    if (!this.inputText) {
      this.highlightedText = [];
      return;
    }

    const parts: HighlightPart[] = [];
    let lastIndex = 0;

    for (const match of this.matches) {
      // Add non-matching text before this match
      if (match.index > lastIndex) {
        parts.push({
          text: this.inputText.substring(lastIndex, match.index),
          isMatch: false,
        });
      }

      // Add the matching text
      parts.push({
        text: match.text,
        isMatch: true,
      });

      lastIndex = match.index + match.length;
    }

    // Add remaining non-matching text
    if (lastIndex < this.inputText.length) {
      parts.push({
        text: this.inputText.substring(lastIndex),
        isMatch: false,
      });
    }

    this.highlightedText = parts;
  }
}
