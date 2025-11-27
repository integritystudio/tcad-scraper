-- CreateTable
CREATE TABLE "api_usage_logs" (
    "id" TEXT NOT NULL,
    "query_text" TEXT NOT NULL,
    "query_cost" DOUBLE PRECISION NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" TEXT,
    "response_time" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_usage_logs_timestamp_idx" ON "api_usage_logs"("timestamp");

-- CreateIndex
CREATE INDEX "api_usage_logs_environment_idx" ON "api_usage_logs"("environment");

-- CreateIndex
CREATE INDEX "api_usage_logs_success_idx" ON "api_usage_logs"("success");

-- CreateIndex
CREATE INDEX "api_usage_logs_model_idx" ON "api_usage_logs"("model");
