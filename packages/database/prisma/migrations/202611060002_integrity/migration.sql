ALTER TABLE "Task" ADD CONSTRAINT "Task_positive_version" CHECK ("version" > 0);
ALTER TABLE "Project" ADD CONSTRAINT "Project_date_order" CHECK ("startDate" IS NULL OR "dueDate" IS NULL OR "dueDate" >= "startDate");
ALTER TABLE "AuthThrottle" ADD CONSTRAINT "AuthThrottle_positive_count" CHECK ("count" > 0);
