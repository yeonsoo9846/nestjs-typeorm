import { postRefreshToken } from './queryHooks';
import { decryption, encryption, getCookie, setCookie } from '@repo/lib';

// Types
interface FetchApiOptions extends Omit<RequestInit, 'body'> {
  auth?: boolean;
  queryString?: URLSearchParams;
  tags?: string[];
  revalidate?: number | false;
  dataType?: 'jsonString' | 'formData';
  accessToken?: string;
  isServer?: boolean;
  body?: any;
}

interface FetchConfig extends RequestInit {
  next?: { tags?: string[]; revalidate?: number | false };
}

interface ApiError {
  error: string;
  message: string;
}

// Constants
const DEFAULT_HEADERS = {
  Accept: 'application/json',
} as const;

const ERROR_CODES = {
  UNAUTHORIZED: 'E002',
  FORBIDDEN: 'E003',
} as const;

// Token Management
let refreshPromise: Promise<string> | null = null;
let isRefreshing = false;

const getTokenName = (): string | undefined => {
  return process.env.NEXT_PUBLIC_TOKEN_NAME;
};

const getCurrentToken = (providedToken?: string): string | undefined => {
  if (providedToken) return providedToken;

  const tokenName = getTokenName();
  return tokenName ? getCookie(tokenName) : undefined;
};

const saveToken = (token: string): void => {
  const tokenName = getTokenName();
  if (tokenName) {
    setCookie(tokenName, token);
  }
};

const clearSession = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = '';
    window.location.href = '/login';
  }
};

const performTokenRefresh = async (): Promise<string> => {
  if (isRefreshing) {
    throw new Error('Token refresh already in progress');
  }

  isRefreshing = true;

  try {
    const response = await postRefreshToken();

    if (!response.ok) {
      const errorMessage = await response.text();
      throw new Error(errorMessage);
    }

    const tokenData = await response.json();
    const newToken = encryption(tokenData?.accessToken);

    if (!newToken) {
      throw new Error('Failed to encrypt new token');
    }

    saveToken(newToken);
    return newToken;
  } catch (error) {
    clearSession();
    throw error;
  }
};

const getRefreshPromise = (): Promise<string> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = performTokenRefresh();
  refreshPromise.finally(() => {
    refreshPromise = null;
    isRefreshing = false;
  });
  return refreshPromise;
};

// URL and Config Builders
const buildFullUrl = (url: string, queryString?: URLSearchParams): string => {
  const host = process.env.NEXT_PUBLIC_HOST_URL;
  const query = queryString ? `?${queryString}` : '';
  return `${host}${url}${query}`;
};

const buildFetchConfig = (
  method: string,
  body: any,
  dataType: string,
  tags?: string[],
  revalidate?: number | false,
  options: RequestInit = {},
): FetchConfig => {
  const config: FetchConfig = {
    method,
    credentials: 'include',
    ...options,
  };

  // Body 설정
  if (method !== 'GET' && body) {
    config.body = dataType === 'jsonString' ? JSON.stringify(body) : body;
  }

  // Next.js 캐시 설정
  config.next = tags ? { tags, revalidate } : { tags: [], revalidate: 0 };

  return config;
};

const buildHeaders = (
  auth: boolean,
  dataType: string,
  token?: string,
  customHeaders?: HeadersInit,
): Record<string, string> => {
  const headers = {
    ...DEFAULT_HEADERS,
    ...(customHeaders as Record<string, string>),
  };

  if (dataType === 'jsonString') {
    headers['Content-Type'] = 'application/json';
  }

  if (auth && token) {
    headers['Authorization'] = `Bearer ${decryption(token)}`;
  }

  return headers;
};

// Error Handlers
const createApiError = (error: string, message: string): ApiError => ({
  error,
  message,
});

const handleFetchError = (error: unknown): never => {
  const errorMessage =
    error instanceof Error ? error.message : 'An unknown error occurred';
  throw new Error(JSON.stringify({ errorMessage }));
};

const handleAuthError = (): never => {
  throw new Error(
    JSON.stringify(createApiError('Unauthorized', '로그인이 필요합니다')),
  );
};

const handle403Error = async (
  response: Response,
  isServer?: boolean,
): Promise<Response> => {
  if (process.env.NEXT_PUBLIC_TOKEN_NAME === 'authToken') {
    return response;
  }

  const resJson = await response.json();

  if (resJson?.errorCode === ERROR_CODES.UNAUTHORIZED) {
    throw new Error(resJson?.message);
  }

  if (resJson?.errorCode === ERROR_CODES.FORBIDDEN) {
    throw new Error(resJson?.errorCode);
  }

  if (!isServer) {
    clearSession();
  }

  return response;
};

const handleTokenRefreshError = (error: any): never => {
  let errorMessage: string;

  try {
    const parsed = JSON.parse(error.message);
    if (parsed.errorCode || parsed.message) {
      throw error;
    }
    errorMessage = parsed.errorMessage;
  } catch {
    errorMessage = error.message;
  }

  throw new Error(
    JSON.stringify(createApiError('Token refresh failed', errorMessage)),
  );
};

export async function FetchApi({
  url,
  method = 'GET',
  queryString,
  auth = true,
  tags,
  revalidate = 0,
  body,
  dataType = 'jsonString',
  accessToken,
  isServer,
  ...options
}: FetchApiOptions & {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
}): Promise<Response> {
  const token = getCurrentToken(accessToken);

  // 인증 확인
  if (auth && !token) {
    handleAuthError();
  }

  const fullUrl = buildFullUrl(url, queryString);
  const fetchConfig = buildFetchConfig(
    method,
    body,
    dataType,
    tags,
    revalidate,
    options,
  );

  const makeRequest = async (currentToken?: string): Promise<Response> => {
    const headers = buildHeaders(auth, dataType, currentToken, options.headers);

    try {
      return await fetch(fullUrl, { ...fetchConfig, headers });
    } catch (error) {
      handleFetchError(error);
    }
  };

  // 첫 번째 요청
  let response = await makeRequest(token);

  // 성공 응답
  if (response?.ok) {
    return response;
  }

  // 403 에러 처리
  if (response?.status === 403) {
    return await handle403Error(response, isServer);
  }

  // 401이 아닌 에러
  if (response?.status !== 401) {
    const errorText = await response?.text();
    throw new Error(errorText);
  }

  // 401 에러: 토큰 갱신 시도
  if (!isServer && auth) {
    try {
      const newToken = await getRefreshPromise();
      return await makeRequest(newToken);
    } catch (error: any) {
      handleTokenRefreshError(error);
    }
  }

  return response;
}
