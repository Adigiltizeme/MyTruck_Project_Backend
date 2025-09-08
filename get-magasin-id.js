const { PrismaClient } = require('@prisma/client');

async function getMagasinId() {
  const prisma = new PrismaClient();
  
  try {
    const magasin = await prisma.magasin.findFirst({
      where: { email: 'mytruckivry@gmail.com' },
      select: { id: true }
    });
    
    console.log(magasin.id);
    
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getMagasinId();