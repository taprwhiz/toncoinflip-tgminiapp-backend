import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()
const generateInviteCode = () => Math.random().toString(36).substr(7);
const userData: Prisma.UserCreateInput[] = [
  {
    userName: 'Yujio',
    userId: '@yujio', 
    userAddr: 'iewprioyret',   
    inviteCode: generateInviteCode(),
  },
  {
    userName: 'Itachi',
    userId: '@itachi',
    userAddr: 'adlkghadgkh',   

    inviteCode: generateInviteCode()
  },
  {
    userName: 'Alice',
    userId: '@alice',
    userAddr: 'zxc,bvzccxm,vb',   
    inviteCode: generateInviteCode()
  },
]

async function main() {
  console.log(`Start seeding ...`)
  for (const u of userData) {
    const user = await prisma.user.create({
      data: u,
    })
    console.log(`Created user with id: ${user.id}`)
  }
  console.log(`Seeding finished.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })