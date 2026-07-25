import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

export function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export function verifyPassword(hash: string, password: string) {
  return bcrypt.compare(password, hash)
}
