import { isHttpError, type ApiHttpError } from '$lib/api/compat';
import type { HandleClientError } from '@sveltejs/kit';

const DEFAULT_MESSAGE = 'Hmm, not sure about that. Check the logs or open a ticket?';

const parseHTTPError = (httpError: ApiHttpError) => {
  console.log({
    status: httpError.status,
    code: httpError.code,
  });

  return {
    message: httpError.message || DEFAULT_MESSAGE,
    code: httpError.status || 500,
    stack: httpError.stack,
  };
};

const parseError = (error: unknown, status: number, message: string) => {
  if (isHttpError(error)) {
    return parseHTTPError(error);
  }

  return {
    message: (error as Error)?.message || message || DEFAULT_MESSAGE,
    code: status,
  };
};

export const handleError: HandleClientError = ({ error, status, message }) => {
  const result = parseError(error, status, message);
  console.error(`[hooks.client.ts]:handleError ${result.message}`, error);
  return result;
};
