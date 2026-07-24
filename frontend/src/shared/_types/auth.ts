export type UserProfile = {
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  access_level: string;
  profile_image: string;
  title: string;
  department: string;
  activity: Array<{ label: string; value: number }>;
  alarms: Array<{ title: string; message: string; level?: string }>;
  notifications: Array<{ title: string; message: string; time?: string }>;
};

export type LoginResponse = {
  access_token: string;
  token_type: 'bearer';
  user: UserProfile;
};
