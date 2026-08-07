export const API_BASE_URL = 'https://api.nstsdc.org/v1';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const fetchClient = async (endpoint: string, options: RequestInit = {}, token?: string | null) => {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // 401 Refresh logic would be invoked here, throwing for now to let consumers handle
    throw new ApiError('Unauthorized - Session Expired', 401);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(errorData.message || 'API Request Failed', response.status);
  }

  return response.json();
};
