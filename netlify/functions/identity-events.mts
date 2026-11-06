import type {
  UserSignupEvent,
  UserLoginEvent,
  UserModifiedEvent,
} from '@netlify/functions'
import {
  syncAccount,
  requireActive,
  recordEvent,
  pool,
} from '../lib/admin-core'

export default {
  async userSignup(event: UserSignupEvent) {
    await syncAccount(event.user)
    await recordEvent(event.user.id, 'user.registered', 'authentication')
    if (event.user.confirmedAt)
      await recordEvent(event.user.id, 'email.verified', 'authentication')
  },
  async userLogin(event: UserLoginEvent) {
    try {
      await requireActive(event.user)
    } catch {
      return event.deny()
    }
    await syncAccount(event.user)
    await pool().query(
      'UPDATE admin_accounts SET last_login=now() WHERE id=$1',
      [event.user.id],
    )
    await recordEvent(event.user.id, 'user.logged_in', 'authentication')
  },
  async userModified(event: UserModifiedEvent) {
    try {
      await requireActive(event.user)
    } catch {
      return event.deny()
    }
    const before = await pool().query(
      'SELECT verified_at FROM admin_accounts WHERE id=$1',
      [event.user.id],
    )
    await syncAccount(event.user)
    if (!before.rows[0]?.verified_at && event.user.confirmedAt)
      await recordEvent(event.user.id, 'email.verified', 'authentication')
  },
}
