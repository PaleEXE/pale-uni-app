import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService, RegisterRequest } from '../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-register',
  templateUrl: './register.html',
  styleUrl: './register.css',
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

  isLoading = false;
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

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.register(this.registerData).subscribe({
      next: (response) => {
        this.isLoading = false;
        console.log('Registration successful', response);
        setTimeout(() => {
          window.location.href = '/home';
        }, 500);
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Registration failed', error);
        this.errorMessage =
          error.error?.detail || 'Registration failed. Please try again.';
      },
    });
  }
}
