-- CreateTable
CREATE TABLE "search_term_analytics" (
    "id" TEXT NOT NULL,
    "search_term" TEXT NOT NULL,
    "term_length" INTEGER NOT NULL,
    "total_searches" INTEGER NOT NULL DEFAULT 0,
    "successful_searches" INTEGER NOT NULL DEFAULT 0,
    "failed_searches" INTEGER NOT NULL DEFAULT 0,
    "total_results" INTEGER NOT NULL DEFAULT 0,
    "avg_results_per_search" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_results" INTEGER NOT NULL DEFAULT 0,
    "min_results" INTEGER,
    "last_searched" TIMESTAMP(3) NOT NULL,
    "success_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "efficiency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_term_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "search_term_analytics_efficiency_idx" ON "search_term_analytics"("efficiency");

-- CreateIndex
CREATE INDEX "search_term_analytics_avg_results_per_search_idx" ON "search_term_analytics"("avg_results_per_search");

-- CreateIndex
CREATE INDEX "search_term_analytics_term_length_idx" ON "search_term_analytics"("term_length");

-- CreateIndex
CREATE INDEX "search_term_analytics_last_searched_idx" ON "search_term_analytics"("last_searched");

-- CreateIndex
CREATE UNIQUE INDEX "search_term_analytics_search_term_key" ON "search_term_analytics"("search_term");
