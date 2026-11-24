import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, LoginRequest } from '../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-login',
  templateUrl: './login.html',
  imports: [CommonModule, FormsModule, RouterLink],
})
export class LoginComponent implements OnInit {
  loginData: LoginRequest = {
    email: '',
    password: '',
  };

  isLoading = signal(false);
  isGuestLoading = signal(false);
  errorMessage = '';
  infoMessage = '';
  returnUrl = '/home';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Redirect to home only if already authenticated as a registered user
    // (Guests are allowed to visit /login anytime to sign in)
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/home']);
      return;
    }

    const params = this.route.snapshot.queryParamMap;
    const rawReturnUrl = params.get('returnUrl');
    if (rawReturnUrl && rawReturnUrl.startsWith('/')) {
      this.returnUrl = rawReturnUrl;
    }

    if (params.get('expired') === 'true') {
      this.infoMessage =
        'Your session has expired. Sign in or continue as a guest to resume.';
    } else if (params.get('reason') === 'auth_required') {
      this.infoMessage =
        'Sign in or create an account to save visualizations and access personal features.';
    }
  }

  onLogin(): void {
    if (!this.loginData.email || !this.loginData.password) {
      this.errorMessage = 'Please fill in all fields';
      return;
    }

    this.isLoading.set(true);
    this.errorMessage = '';

    this.authService.login(this.loginData).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage =
          error.error?.detail || 'Login failed. Please try again.';
      },
    });
  }

  onContinueAsGuest(): void {
    this.isGuestLoading.set(true);
    this.errorMessage = '';

    this.authService.continueAsGuest().subscribe({
      next: () => {
        this.isGuestLoading.set(false);
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (error) => {
        this.isGuestLoading.set(false);
        this.errorMessage =
          error.error?.detail ||
          'Could not start guest session. Please make sure the server is running.';
      },
    });
  }
}
