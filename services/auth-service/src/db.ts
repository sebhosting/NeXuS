import { Pool } from 'pg'
import dotenv from 'dotenv'
dotenv.config({ quiet: true })

const pool = new Pool({
  host:     process.env.POSTGRES_HOST     || 'nexus-postgres',
  port:     parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB       || 'nexus',
  user:     process.env.POSTGRES_USER     || 'seb',
  password: process.env.POSTGRES_PASSWORD || '',
  max: 10,
  idleTimeoutMillis: 30000,
})

export const db = {
  async initSchema() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username    VARCHAR(50)  UNIQUE NOT NULL,
        email       VARCHAR(255) UNIQUE NOT NULL,
        password    VARCHAR(255) NOT NULL,
        role        VARCHAR(20)  NOT NULL DEFAULT 'viewer',
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        last_login  TIMESTAMPTZ,
        is_active   BOOLEAN      NOT NULL DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash  VARCHAR(255) NOT NULL,
        expires_at  TIMESTAMPTZ  NOT NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user
        ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_users_email
        ON users(email);
    `)
    console.log('✓ Auth schema ready')
  },

  async findUserByEmail(email: string) {
    const r = await pool.query('SELECT * FROM users WHERE email=$1 AND is_active=true', [email])
    return r.rows[0] || null
  },

  async findUserByUsername(username: string) {
    const r = await pool.query('SELECT * FROM users WHERE username=$1 AND is_active=true', [username])
    return r.rows[0] || null
  },

  async findUserById(id: string) {
    const r = await pool.query('SELECT * FROM users WHERE id=$1', [id])
    return r.rows[0] || null
  },

  async createUser(username: string, email: string, passwordHash: string, role = 'admin') {
    const r = await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1,$2,$3,$4) RETURNING *',
      [username, email, passwordHash, role]
    )
    return r.rows[0]
  },

  async updateLastLogin(id: string) {
    await pool.query('UPDATE users SET last_login=NOW() WHERE id=$1', [id])
  },

  async countUsers() {
    const r = await pool.query('SELECT COUNT(*) FROM users')
    return parseInt(r.rows[0].count)
  },

  async saveRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    await pool.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)',
      [userId, tokenHash, expiresAt]
    )
  },

  async findRefreshToken(userId: string, tokenHash: string) {
    const r = await pool.query(
      'SELECT * FROM refresh_tokens WHERE user_id=$1 AND token_hash=$2 AND expires_at > NOW()',
      [userId, tokenHash]
    )
    return r.rows[0] || null
  },

  async deleteRefreshToken(userId: string, tokenHash: string) {
    await pool.query(
      'DELETE FROM refresh_tokens WHERE user_id=$1 AND token_hash=$2',
      [userId, tokenHash]
    )
  },

  async deleteAllRefreshTokens(userId: string) {
    await pool.query('DELETE FROM refresh_tokens WHERE user_id=$1', [userId])
  },

  async listUsers() {
    const r = await pool.query(
      'SELECT id, username, email, role, created_at, last_login, is_active FROM users ORDER BY created_at DESC'
    )
    return r.rows
  },

  async updateUserRole(id: string, role: string) {
    await pool.query('UPDATE users SET role=$2 WHERE id=$1', [id, role])
  },

  async updateUserActive(id: string, active: boolean) {
    await pool.query('UPDATE users SET is_active=$2 WHERE id=$1', [id, active])
  },

  async deleteUser(id: string) {
    await pool.query('DELETE FROM users WHERE id=$1', [id])
  },

  async updatePassword(id: string, hash: string) {
    await pool.query('UPDATE users SET password=$2 WHERE id=$1', [id, hash])
  },

  async listActiveSessions() {
    const r = await pool.query(
      `SELECT rt.id, rt.user_id, u.username, rt.created_at, rt.expires_at
       FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
       WHERE rt.expires_at > NOW() ORDER BY rt.created_at DESC`
    )
    return r.rows
  },
}
