import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { topics, slugify } from '../data.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage {
  topics = topics;
  getSlugify(topic: string): string {
    return slugify(topic);
  }
}
