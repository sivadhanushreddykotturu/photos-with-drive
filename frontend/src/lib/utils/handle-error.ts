import { isHttpError } from '$lib/api/compat';
import { toastManager } from '@immich/ui';

export function getServerErrorMessage(error: unknown) {
  if (!isHttpError(error)) {
    return;
  }

  if (Array.isArray(error.details) && error.details.length > 0) {
    const details = error.details.map(({ path, message }) => (path ? `${path}: ${message}` : message)).join(', ');
    return `${error.message} (${details})`;
  }

  return error.message;
}

export function standardizeError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

export function handleError(error: unknown, localizedMessage: string, options?: { notify?: boolean }) {
  const { notify = true } = options ?? {};
  const standardizedError = standardizeError(error);
  if (standardizedError.name === 'AbortError') {
    return;
  }

  console.error(`[handleError]: ${standardizedError}`, error, standardizedError.stack);

  try {
    const serverMessage = getServerErrorMessage(error);
    const errorMessage = serverMessage || localizedMessage;

    if (notify) {
      toastManager.danger(errorMessage);
    }

    return errorMessage;
  } catch (error) {
    console.error(error);
    return localizedMessage;
  }
}

export async function handleErrorAsync<T>(fn: () => Promise<T>, localizedMessage: string): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error: unknown) {
    handleError(error, localizedMessage);
    return;
  }
}
