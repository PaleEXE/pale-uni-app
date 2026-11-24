import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { topics, slugify } from '../services/data.service';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService, SessionMode } from '../services/auth.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
})
export class HomePage implements OnInit, OnDestroy {
  topics = topics;
  readonly username = signal<string>('');
  readonly sessionMode = signal<SessionMode>('none');

  private subs = new Subscription();

  constructor(
    @Inject(PLATFORM_ID) public platformId: Object,
    private authService: AuthService
  ) {}

  getSlugify(topic: string): string {
    return slugify(topic);
  }

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
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }
}
