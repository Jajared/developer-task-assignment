-- AlterTable
ALTER TABLE "Task" DROP COLUMN "dueDate",
DROP COLUMN "priority";

-- DropEnum
DROP TYPE "TaskPriority";

