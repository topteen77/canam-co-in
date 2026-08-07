import apiClient from './apiClient';

export interface SignupData {
  email: string;
  password: string;
  name: string;
  signupMethod: 'email' | 'google';
}

export interface ApprovalData {
  userId: string;
  role: 'Admin' | 'Account Manager' | 'Sales' | 'Operations';
  approvedBy: string;
}

export interface PasswordSetupData {
  uid: string;
  newPassword: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  password_set?: boolean;
  signup_method?: string;
  approved_at?: string;
  approved_by?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  details?: string;
  data?: T;
  user?: User;
  users?: User[];
}

class AuthServerService {
  // User signup
  async signup(data: SignupData): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/auth/register', data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Signup failed'
      };
    }
  }

  // Admin approve user
  async approveUser(data: ApprovalData): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/admin/approve-user', data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Approval failed'
      };
    }
  }

  // Setup password for Google users
  async setupPassword(data: PasswordSetupData): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/auth/setup-password', data);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Password setup failed'
      };
    }
  }

  // Get all users (admin only)
  // Note: We don't need to pass adminEmail anymore; the backend uses the Token to verify identity
  async getUsers(adminEmail?: string): Promise<ApiResponse<User[]>> {
    try {
      const response = await apiClient.get('/users');
      return {
        success: true,
        users: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch users',
        users: []
      };
    }
  }

  // Create admin user
  async createAdmin(email: string, password: string, name: string): Promise<ApiResponse> {
    try {
      const response = await apiClient.post('/auth/create-admin', { email, password, name });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Admin creation failed'
      };
    }
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    try {
      const response = await apiClient.get('/health');
      return { success: true, ...response.data };
    } catch (error: any) {
      return {
        success: false,
        error: 'Backend is offline'
      };
    }
  }
}

export const authServer = new AuthServerService();