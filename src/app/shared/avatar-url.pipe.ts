import { Pipe, PipeTransform } from '@angular/core';
import { environment } from '../../environments/environment';

// Uploaded photos are served by the API server (/uploads/avatars/...), the ready-made
// pictures by the app itself (/assets/user_pic/...), previews are blob: urls
export const avatarUrl = (path?: string | null): string =>
  !path ? '' : path.startsWith('/uploads/') ? `${environment.baseUrl}${path}` : path;

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
