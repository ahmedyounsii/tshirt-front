export type UserRole = 'user' | 'admin';

export interface UserModel {
  _id: string;
  name: string;
  username?: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

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
