import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'tripReady';
  /* Read from the clock rather than hardcoded, so it does not go stale in January. */
  readonly currentYear = new Date().getFullYear();
}
