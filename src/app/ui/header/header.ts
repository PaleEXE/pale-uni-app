import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService, SessionMode } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class AppHeader implements OnInit, OnDestroy {
  protected title = 'GoAlgo';
  selectedTheme: string = 'amber';
  readonly sessionMode = signal<SessionMode>('none');
  readonly username = signal<string>('');

  private subs = new Subscription();

  constructor(
    @Inject(PLATFORM_ID) public platformId: Object,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.authService.sessionMode$.subscribe((mode) => {
        this.sessionMode.set(mode);
      })
    );
    this.subs.add(
      this.authService.currentUser$.subscribe((user) => {
        this.username.set(user?.username ?? '');
      })
    );

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

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  onLogoClick(): void {
    if (this.authService.hasActiveSession()) {
      this.router.navigate(['/home']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
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
