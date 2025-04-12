/*
  Warnings:

  - You are about to drop the column `filterColumn` on the `View` table. All the data in the column will be lost.
  - You are about to drop the column `filterOperator` on the `View` table. All the data in the column will be lost.
  - You are about to drop the column `filterValue` on the `View` table. All the data in the column will be lost.
  - You are about to drop the column `sortColumn` on the `View` table. All the data in the column will be lost.
  - You are about to drop the column `sortDirection` on the `View` table. All the data in the column will be lost.
  - The `hiddenColumns` column on the `View` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "View" DROP COLUMN "filterColumn",
DROP COLUMN "filterOperator",
DROP COLUMN "filterValue",
DROP COLUMN "sortColumn",
DROP COLUMN "sortDirection",
ADD COLUMN     "filter" JSONB,
ADD COLUMN     "sort" JSONB,
DROP COLUMN "hiddenColumns",
ADD COLUMN     "hiddenColumns" JSONB NOT NULL DEFAULT '[]';
