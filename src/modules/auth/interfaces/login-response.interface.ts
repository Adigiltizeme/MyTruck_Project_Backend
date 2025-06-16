export interface LoginResponse {
    access_token: string;
    user: {
      id: string;
      email: string;
      role: string;
    };
  }