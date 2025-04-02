-- DropForeignKey
ALTER TABLE "Column" DROP CONSTRAINT "Column_tableId_fkey";

-- AddForeignKey
ALTER TABLE "Column" ADD CONSTRAINT "Column_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;
