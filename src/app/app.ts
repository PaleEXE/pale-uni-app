import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppHeader } from "./ui/header/header";


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, AppHeader],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  
}
