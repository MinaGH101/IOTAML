export type UserRole = 'admin' | 'manager' | 'expert' | 'guest';

export type UserProfile = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  role: UserRole;
  access_level: string;
  profile_image: string;
  title: string;
  department: string;
  activity: Array<{ label: string; value: number }>;
  alarms: Array<{ title: string; message: string; level?: string }>;
  notifications: Array<{ title: string; message: string; time?: string }>;
  is_active: boolean;
};

export type AdminUser = UserProfile & {
  created_at: string;
  updated_at: string;
  owned_project_count: number;
  assigned_project_count: number;
};

export type AdminUserPayload = {
  username: string;
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  title: string;
  department: string;
  role: UserRole;
  is_active: boolean;
};

export type LoginResponse = {
  access_token: string;
  token_type: 'bearer';
  user: UserProfile;
};
