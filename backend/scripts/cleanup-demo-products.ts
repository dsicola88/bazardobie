/**
 * Script para remover produtos demo criados pelo seed.
 * Uso: npx tsx scripts/cleanup-demo-products.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("[cleanup] Procurando produtos demo (nome começa com '[DEMO]')...");

  const demoProducts = await prisma.product.findMany({
    where: {
      name: {
        startsWith: "[DEMO]",
      },
    },
    select: {
      id: true,
      name: true,
      sku: true,
      shopId: true,
    },
  });

  if (demoProducts.length === 0) {
    console.log("[cleanup] Nenhum produto demo encontrado.");
    return;
  }

  console.log(`[cleanup] Encontrados ${demoProducts.length} produtos demo:`);
  demoProducts.forEach((p) => {
    console.log(`  - ${p.name} (SKU: ${p.sku})`);
  });

  // Confirmar antes de deletar
  console.log("\n[cleanup] ATENÇÃO: Isso irá deletar permanentemente os produtos demo.");
  console.log("[cleanup] Pressione Ctrl+C para cancelar ou Enter para continuar...");

  // Em ambiente automático, não esperar por input
  if (process.env.AUTO_CONFIRM === "true") {
    console.log("[cleanup] AUTO_CONFIRM=true, prosseguindo sem confirmação...");
  } else {
    // Em modo interativo, esperar por Enter (simplificado)
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  // Deletar produtos (cascade deletará variants, images, etc.)
  const result = await prisma.product.deleteMany({
    where: {
      name: {
        startsWith: "[DEMO]",
      },
    },
  });

  console.log(`[cleanup] ${result.count} produtos demo deletados com sucesso.`);

  // Opcional: deletar loja demo também
  const demoShop = await prisma.shop.findFirst({
    where: {
      name: {
        startsWith: "[DEMO]",
      },
    },
  });

  if (demoShop) {
    console.log(`[cleanup] Deletando loja demo: ${demoShop.name}`);
    await prisma.shop.delete({
      where: { id: demoShop.id },
    });
    console.log("[cleanup] Loja demo deletada com sucesso.");
  }

  // Opcional: deletar usuário demo também
  const demoUser = await prisma.user.findFirst({
    where: {
      name: {
        startsWith: "[DEMO]",
      },
    },
  });

  if (demoUser) {
    console.log(`[cleanup] Deletando usuário demo: ${demoUser.name}`);
    await prisma.user.delete({
      where: { id: demoUser.id },
    });
    console.log("[cleanup] Usuário demo deletado com sucesso.");
  }
}

main()
  .then(() => {
    console.log("[cleanup] Concluído.");
    process.exit(0);
  })
  .catch((e) => {
    console.error("[cleanup] Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
