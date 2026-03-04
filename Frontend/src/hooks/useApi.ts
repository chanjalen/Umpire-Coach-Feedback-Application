import { useState, useCallback } from 'react';
import { AxiosRequestConfig } from 'axios';
import api from '../lib/api';
import { ApiError } from '../types';

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

export function useApi<T>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const execute = useCallback(async (config: AxiosRequestConfig): Promise<T | null> => {
    setState({ data: null, isLoading: true, error: null });
    try {
      const res = await api.request<T>(config);
      setState({ data: res.data, isLoading: false, error: null });
      return res.data;
    } catch (err: unknown) {
      const apiErr = (err as { response?: { data?: ApiError } }).response?.data;
      const message = apiErr?.message || 'Something went wrong';
      setState({ data: null, isLoading: false, error: message });
      return null;
    }
  }, []);

  return { ...state, execute };
}
