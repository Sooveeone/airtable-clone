/*
  Warnings:

  - You are about to drop the column `filter` on the `View` table. All the data in the column will be lost.
  - You are about to drop the column `sort` on the `View` table. All the data in the column will be lost.
  - The `hiddenColumns` column on the `View` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "View" DROP COLUMN "filter",
DROP COLUMN "sort",
ADD COLUMN     "filterColumn" TEXT,
ADD COLUMN     "filterOperator" TEXT,
ADD COLUMN     "filterValue" JSONB,
ADD COLUMN     "sortColumn" TEXT,
ADD COLUMN     "sortDirection" TEXT,
DROP COLUMN "hiddenColumns",
ADD COLUMN     "hiddenColumns" TEXT[] DEFAULT ARRAY[]::TEXT[];
