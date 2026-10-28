export type UserRole = 'user' | 'admin';

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
  createdAt: string;
}

// Public profile of a creator (GET api/users/<handle>/public): no email
export type CreatorProfile = Pick<UserModel, '_id' | 'name' | 'username' | 'role' | 'avatar' | 'createdAt'> & {
  productCount: number;
  // Published ones only
  collectionCount: number;
};

// Public store page of a user: by username, by id for accounts made before usernames
export const creatorLink = (user: Pick<UserModel, '_id' | 'username'>): string[] => [
  '/store',
  user.username || user._id,
];

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
