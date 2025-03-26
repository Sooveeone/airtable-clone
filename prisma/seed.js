import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.create({
    data: {
      email: "example@email.com",
      bases: {
        create: [
          {
            name: "Sample Base",
            tables: {
              create: [
                {
                  name: "Sample Table",
                  columns: {
                    create: [
                      { name: "Text Column", type: "text" },
                      { name: "Number Column", type: "number" },
                    ],
                  },
                  rows: {
                    create: Array.from({ length: 10 }, (_, i) => ({
                      data: {
                        "Text Column": `Row ${i + 1}`,
                        "Number Column": i + 1,
                      },
                    })),
                  },
                },
              ],
            },
          },
        ],
      },
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
