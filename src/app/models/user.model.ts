import { StoreModel } from './store.model';

export type UserRole = 'user' | 'admin';

// Seller access, granted by redeeming an activation code; never set by the user's own forms.
// "suspended" by an admin (store offline, dashboard closed); "closed": the store was deleted
export type SellerStatus = 'active' | 'suspended' | 'closed';
export interface SellerInfo {
  status: SellerStatus;
  activatedAt?: string;
  // Admin override of the platform commission, in basis points; null follows the default
  commissionBps?: number | null;
  suspendedAt?: string;
  suspendedReason?: string;
  // Paused by the seller: the store is offline, the dashboard stays open
  paused?: boolean;
  pausedAt?: string;
  closedAt?: string;
  // Who deleted the store: the seller's own id, or an admin's
  closedBy?: string;
  closedReason?: string;
}

export interface UserModel {
  _id: string;
  name: string;
  username?: string;
  email: string;
  role: UserRole;
  // The only admin who makes users admins (Settings > Admins), set on the server only
  superAdmin?: boolean;
  // Profile picture: the server path of an uploaded photo (/uploads/avatars/...) or the
  // path of a ready-made one (/assets/user_pic/...), shown through avatarUrl. The
  // initials are shown without one
  avatar?: string;
  // Only on users who activated seller access (they keep every customer right)
  seller?: SellerInfo;
  createdAt: string;
}

// Public profile of a creator (GET api/users/<handle>/public): no email
export type CreatorProfile = Pick<UserModel, '_id' | 'name' | 'username' | 'role' | 'avatar' | 'createdAt'> & {
  // Active seller: their store's name, description and logo are in store
  isSeller: boolean;
  productCount: number;
  // Published ones only
  collectionCount: number;
  store: StoreModel;
};

// Public store page of a user: by their open store's address (storeSlug) when they have one,
// else by username, by id for accounts made before usernames
export const creatorLink = (user: Pick<UserModel, '_id' | 'username'> & { storeSlug?: string }): string[] => [
  '/store',
  user.storeSlug || user.username || user._id,
];

// Creator of a product, design or collection as the server sends it: storeName and storeSlug
// are their store's name and address while it is open (not paused, suspended or deleted)
export type Creator = Pick<UserModel, '_id' | 'name' | 'username'> & { storeName?: string; storeSlug?: string };

// Name shown for a creator: their open store's name, else "@username", else their name
export const creatorDisplayName = (creator: Creator): string =>
  creator.storeName || (creator.username ? `@${creator.username}` : creator.name || '');

// Response of POST api/auth/login and api/auth/register
export interface AuthResponse {
  token: string;
  user: UserModel;
}

export interface LoginPayload {
  // Email or username
  login: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  username: string;
  email: string;
  password: string;
}

// PUT api/users/me: the fields to change, responds with the updated user
export type UpdateAccountPayload = Partial<Pick<UserModel, 'name' | 'username' | 'email'>>;

// Fields that must be unique across accounts (GET api/users/availability)
export type UniqueUserField = 'username' | 'email';

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}
