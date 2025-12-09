import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class AppHeader {
  protected title = 'GoAlgo';
  selectedTheme: string = 'amber';
  isLoggedIn = false;
  username: string = '';

  constructor(
    @Inject(PLATFORM_ID) public platformId: Object,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.isLoggedIn = this.authService.isLoggedIn();
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.username = currentUser.username;
    }
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        this.selectedTheme = savedTheme;
        this.setPrimaryFromTheme(savedTheme);
      } else {
        this.setPrimaryFromTheme(this.selectedTheme);
      }
    }
  }

  logout(): void {
    this.authService.logout();
    this.isLoggedIn = false;
    setTimeout(() => {
      window.location.href = '/login';
    }, 500);
  }

  onThemeChange(theme: string) {
    this.selectedTheme = theme;
    this.setPrimaryFromTheme(theme);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('theme', theme);
    }
  }

  setPrimaryFromTheme(theme: string) {
    const root = document.documentElement;

    for (const shade of [
      '50',
      '100',
      '200',
      '300',
      '400',
      '500',
      '600',
      '700',
      '800',
      '900',
    ]) {
      root.style.setProperty(
        `--color-primary-${shade}`,
        `var(--color-${theme}-${shade})`
      );
    }
  }
  onBack() {
    if (isPlatformBrowser(this.platformId)) {
      window.history.back();
    }
  }
  onForward() {
    if (isPlatformBrowser(this.platformId)) {
      window.history.forward();
    }
  }
}
