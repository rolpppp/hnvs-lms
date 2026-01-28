// UUID utility for generating and validating UUIDs
// Using crypto.randomUUID() which is supported in modern browsers

/**
 * Generate a v4 UUID
 */
export function generateUUID(): string {
  // Modern browsers support crypto.randomUUID()
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback for older environments (though unlikely in 2026)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Validate if a string is a valid UUID
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Get a consistent UUID for development/testing purposes
 * In production, you should use actual user IDs from authentication
 */
export function getStudentUUID(): string {
  // Check localStorage first for consistency
  const stored = localStorage.getItem('student_uuid');
  if (stored && isValidUUID(stored)) {
    return stored;
  }
  
  // Generate and store a new one
  const newUUID = generateUUID();
  localStorage.setItem('student_uuid', newUUID);
  return newUUID;
}

/**
 * Map simple IDs to UUIDs for demo data
 * This allows backward compatibility with existing quiz IDs
 */
const ID_MAP = new Map<string, string>();

export function getOrCreateUUIDForId(simpleId: string): string {
  // Check if we already have a mapping
  if (ID_MAP.has(simpleId)) {
    return ID_MAP.get(simpleId)!;
  }
  
  // Check localStorage for persisted mappings
  const storageKey = `uuid_map_${simpleId}`;
  const stored = localStorage.getItem(storageKey);
  if (stored && isValidUUID(stored)) {
    ID_MAP.set(simpleId, stored);
    return stored;
  }
  
  // Generate new UUID and persist
  const newUUID = generateUUID();
  ID_MAP.set(simpleId, newUUID);
  localStorage.setItem(storageKey, newUUID);
  return newUUID;
}
