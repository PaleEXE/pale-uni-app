import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, RegisterRequest } from '../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-register',
  templateUrl: './register.html',
  imports: [CommonModule, FormsModule, RouterLink],
})
export class RegisterComponent implements OnInit {
  registerData: RegisterRequest = {
    username: '',
    email: '',
    password: '',
    phone_number: '',
    preferred_theme: 'light',
  };

  isLoading = signal(false);
  isGuestLoading = signal(false);
  errorMessage = '';
  returnUrl = '/home';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Only redirect registered users; guests can register anytime
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/home']);
      return;
    }

    const rawReturnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (rawReturnUrl && rawReturnUrl.startsWith('/')) {
      this.returnUrl = rawReturnUrl;
    }
  }

  onRegister(): void {
    if (
      !this.registerData.username ||
      !this.registerData.email ||
      !this.registerData.password
    ) {
      this.errorMessage = 'Please fill in all required fields';
      return;
    }

    if (this.registerData.password.length < 6) {
      this.errorMessage = 'Password must be at least 6 characters';
      return;
    }

    this.isLoading.set(true);
    this.errorMessage = '';

    this.authService.register(this.registerData).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage =
          error.error?.detail || 'Registration failed. Please try again.';
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
