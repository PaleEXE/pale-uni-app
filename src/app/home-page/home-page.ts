import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { RouterLink } from '@angular/router';
import { topics, slugify } from '../services/data.service';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage {
  topics = topics;
  username: string = '';
  isLoggedIn = false;

  constructor(
    @Inject(PLATFORM_ID) public platformId: Object,
    private authService: AuthService
  ) {}

  getSlugify(topic: string): string {
    return slugify(topic);
  }
  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.username = currentUser.username;
    }
  }
}
