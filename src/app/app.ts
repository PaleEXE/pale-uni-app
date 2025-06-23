import { Component, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, FormsModule, RouterLink],
    templateUrl: './app.html',
    styleUrl: './app.css',
})
export class App implements OnInit {
    protected title = 'pale-uni-app';
    platformId = PLATFORM_ID;
    selectedTheme: string = 'amber';

    ngOnInit(): void {
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
}
