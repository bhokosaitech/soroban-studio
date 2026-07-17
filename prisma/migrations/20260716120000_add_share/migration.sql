-- CreateTable
CREATE TABLE "Share" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "network" TEXT NOT NULL DEFAULT 'testnet',
    "workflow" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'readonly',
    "authorName" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT,
    "projectId" TEXT,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Share_slug_key" ON "Share"("slug");

-- CreateIndex
CREATE INDEX "Share_projectId_idx" ON "Share"("projectId");

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
