import { PrismaClient } from './generated/client'
import * as bcrypt from 'bcryptjs'
import * as path from 'path'

const dbUrl = `file:${path.resolve(__dirname, 'database/pharmacy.db').replace(/\\/g, '/')}`
const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } },
})

async function test() {
  const user = await prisma.user.findUnique({ where: { username: 'admin' } })
  console.log('Found user:', user)
  if (user) {
    const valid = await bcrypt.compare('admin1234', user.password)
    console.log('Password valid for admin1234:', valid)
  }
}

test().finally(() => prisma.$disconnect())
