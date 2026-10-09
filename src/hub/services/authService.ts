import { prisma } from '../db/prisma'
import { recordAudit } from './auditService'
import * as bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

export async function login(username: string, password: string, deviceId?: string) {
  const cleanUsername = (username || '').trim().toLowerCase()
  const cleanPassword = (password || '').trim()

  const allUsers = await prisma.user.findMany()
  const user = allUsers.find((u) => u.username.toLowerCase() === cleanUsername)
  let valid = false
  if (user && cleanPassword) {
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      valid = await bcrypt.compare(cleanPassword, user.password)
    } else {
      valid = cleanPassword === user.password
    }
  }

  if (!user || !valid) {
    await recordAudit({
      action: 'LOGIN_FAILED',
      category: 'AUTH',
      details: `Failed sign-in attempt for username "${username}"`,
      username,
      userRole: user?.role || 'UNKNOWN',
      severity: 'WARNING',
      deviceId,
      metadata: { attemptedUsername: username },
    })
    throw new Error('Invalid credentials')
  }

  await recordAudit({
    action: 'LOGIN_SUCCESS',
    category: 'AUTH',
    details: `Staff user "${user.username}" signed in with role [${user.role}]`,
    username: user.username,
    userRole: user.role,
    severity: 'INFO',
    deviceId,
  })

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }
}

export async function loginWithPin(pin: string, selectedRole?: string, deviceId?: string) {
  const cleanPin = (pin || '').trim()
  const allUsers = await prisma.user.findMany()
  let user = allUsers.find((u) => u.pin === cleanPin && (!selectedRole || u.role === selectedRole))

  if (!user && !selectedRole) {
    user = allUsers.find((u) => u.pin === cleanPin)
  }

  // Fallback ONLY for legacy unmigrated accounts where pin was never set in the database
  if (!user) {
    const legacyUser = allUsers.find((u) => {
      const hasNoPin = !u.pin || String(u.pin).trim() === ''
      if (!hasNoPin) return false // User has an explicit PIN configured: default bypass is strictly forbidden!
      if (cleanPin === '1111' && u.username.toLowerCase() === 'admin' && (!selectedRole || u.role === 'ADMIN')) return true
      if (cleanPin === '2222' && u.username.toLowerCase() === 'manager' && (!selectedRole || u.role === 'MANAGER')) return true
      if (cleanPin === '1234' && u.username.toLowerCase() === 'cashier' && (!selectedRole || u.role === 'CASHIER')) return true
      return false
    })
    if (legacyUser) {
      user = legacyUser
    }
  }

  if (!user) {
    await recordAudit({
      action: 'PIN_LOGIN_FAILED',
      category: 'AUTH',
      details: `Failed PIN sign-in attempt with code [****]`,
      severity: 'WARNING',
      deviceId,
    })
    throw new Error('Invalid PIN code')
  }

  await recordAudit({
    action: 'PIN_LOGIN_SUCCESS',
    category: 'AUTH',
    details: `Staff user "${user.username}" quick PIN unlocked session [Role: ${user.role}]`,
    username: user.username,
    userRole: user.role,
    severity: 'INFO',
    deviceId,
  })

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }
}

export async function getUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      pin: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  return users
}

export async function createUser(data: {
  username: string
  passwordHash: string
  role: string
  pin?: string
}) {
  const password = data.passwordHash.startsWith('$2a$') || data.passwordHash.startsWith('$2b$')
    ? data.passwordHash
    : await bcrypt.hash(data.passwordHash, 10)

  return await prisma.user.create({
    data: {
      id: randomUUID(),
      username: data.username,
      password,
      role: data.role,
      pin: data.pin || null,
    },
    select: {
      id: true,
      username: true,
      role: true,
      pin: true,
      createdAt: true,
    },
  })
}

export async function updateUser(
  id: string,
  data: {
    username?: string
    role?: string
    passwordHash?: string
    pin?: string
  }
) {
  const updateData: any = {}
  if (data.username !== undefined) updateData.username = data.username
  if (data.role !== undefined) updateData.role = data.role
  if (data.pin !== undefined) updateData.pin = data.pin
  if (data.passwordHash) {
    updateData.password =
      data.passwordHash.startsWith('$2a$') || data.passwordHash.startsWith('$2b$')
        ? data.passwordHash
        : await bcrypt.hash(data.passwordHash, 10)
  }

  return await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      username: true,
      role: true,
      pin: true,
      createdAt: true,
    },
  })
}

export async function deleteUser(id: string) {
  return await prisma.user.delete({
    where: { id },
  })
}
