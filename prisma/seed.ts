import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const username = process.env.SUPER_ADMIN_USERNAME ?? "admin";
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "changeme123";
  const name = process.env.SUPER_ADMIN_NAME ?? "Super Admin";

  if (password === "changeme123") {
    console.warn(
      "⚠️  Using default password 'changeme123'. Set SUPER_ADMIN_PASSWORD env var before running in production."
    );
  }

  const existing = await db.user.findUnique({ where: { username } });

  if (existing) {
    console.log(`Super-admin user "${username}" already exists. Skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: {
      username,
      passwordHash,
      name,
      role: "super_admin",
    },
  });

  console.log(`✅ Created super-admin user: ${user.username} (id: ${user.id})`);
  console.log(`   Login at /login with username="${username}" and the password you set.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
