import axios from 'axios';
import { API_BASE_URL } from './client';

const authClient = axios.create({ baseURL: API_BASE_URL, timeout: 12000 });

export const login = async (email: string, password: string) => {
  const response = await authClient.post('/auth/login', { email, password });
  return response.data;
};

export const register = async (name: string, email: string, password: string) => {
  const response = await authClient.post('/auth/register', { name, email, password });
  return response.data;
};

export const refreshAccessToken = async (refreshToken: string) => {
  const response = await authClient.post('/auth/refresh', { refresh_token: refreshToken });
  return response.data;
};
