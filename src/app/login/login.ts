import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService, LoginRequest } from '../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.css',
  imports: [CommonModule, FormsModule, RouterLink],
})
export class LoginComponent implements OnInit {
  loginData: LoginRequest = {
    email: '',
    password: '',
  };

  isLoading = signal(false);
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Redirect to home if already logged in
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/home']);
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
      next: (response) => {
        this.isLoading.set(false);
        console.log('Login successful', response);
        setTimeout(() => {
          window.location.href = '/home';
        }, 500);
      },
      error: (error) => {
        this.isLoading.set(false);
        console.error('Login failed', error);
        this.errorMessage =
          error.error?.detail || 'Login failed. Please try again.';
      },
    });
  }
}
