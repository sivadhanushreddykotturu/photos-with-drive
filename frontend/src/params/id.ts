import type { ParamMatcher } from '@sveltejs/kit';

// Accepts both UUIDs and MongoDB ObjectIds (24-char hex) used by the custom backend.
const ID_REGEX = /^([\dA-Fa-f]{8}(?:\b-[\dA-Fa-f]{4}){3}\b-[\dA-Fa-f]{12}|[\da-fA-F]{24})$/;

/* Returns true if the given param matches a supported asset id format */
export const match: ParamMatcher = (param: string) => {
  return ID_REGEX.test(param);
};
