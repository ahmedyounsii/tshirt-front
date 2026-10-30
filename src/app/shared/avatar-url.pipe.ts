import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../environments/environment';
import { DEFAULT_BANNER } from '../models/store.model';

// Uploaded photos are served by the API server (/uploads/avatars/...), the ready-made
// pictures by the app itself (/assets/user_pic/...), previews are blob: urls
export const avatarUrl = (path?: string | null): string =>
  !path ? '' : path.startsWith('/uploads/') ? `${environment.baseUrl}${path}` : path;

// CSS image of a store banner (the --profile-banner of .profile-hero): theirs, or the
// default one
export const bannerImage = (path?: string | null): string =>
  `url("${avatarUrl(path) || DEFAULT_BANNER}")`;

// [src]="user.avatar | avatarUrl"
@Pipe({
  name: 'avatarUrl',
  standalone: true,
})
export class AvatarUrlPipe implements PipeTransform {
  transform(path?: string | null): string {
    return avatarUrl(path);
  }
}
