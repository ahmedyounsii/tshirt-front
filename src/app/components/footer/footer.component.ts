import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { TagComponent } from '../tag/tag.component';
import { SOCIAL_LINKS } from '../../shared/seo.config';

@Component({
    selector: 'app-footer',
    imports: [TagComponent, TranslatePipe, RouterLink],
    templateUrl: './footer.component.html',
    styleUrl: './footer.component.scss'
})
export class FooterComponent {
  year = new Date().getFullYear();

  // Words scrolling in the marquee band, repeated twice for a seamless loop
  marquee = ['design', 'print', 'wear', 'own', 'share'].map(
    (word) => `footer.marquee.${word}`,
  );

  columns = [
    {
      title: 'footer.create',
      links: [
        { label: 'footer.designer', link: '/designer' },
        { label: 'footer.browseDesigns', link: '/designs' },
        { label: 'footer.communityDrops', link: '/stores' },
      ],
    },
    {
      title: 'footer.account',
      links: [
        { label: 'common.myDesigns', link: '/my_store' },
        { label: 'common.signIn', link: '/auth' },
      ],
    },
  ];

  socials = SOCIAL_LINKS.filter((social) => social.url);

  // Newsletter is UI only for now: no backend endpoint yet
  subscribed = signal(false);

  subscribe(event: Event, email: string) {
    event.preventDefault();
    if (email.trim()) this.subscribed.set(true);
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
