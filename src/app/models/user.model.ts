export type UserRole = 'user' | 'admin';

export interface UserModel {
  _id: string;
  name: string;
  username?: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

// Public profile of a creator (GET api/users/<handle>/public): no email
export type CreatorProfile = Pick<UserModel, '_id' | 'name' | 'username' | 'role' | 'createdAt'> & {
  productCount: number;
};

// Public profile page of a user: by username, by id for accounts made before usernames
export const creatorLink = (user: Pick<UserModel, '_id' | 'username'>): string[] => [
  '/creator',
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
