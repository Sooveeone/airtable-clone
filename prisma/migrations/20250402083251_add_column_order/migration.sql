-- DropForeignKey
ALTER TABLE "Column" DROP CONSTRAINT "Column_tableId_fkey";

-- AlterTable
ALTER TABLE "Column" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "Column" ADD CONSTRAINT "Column_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
