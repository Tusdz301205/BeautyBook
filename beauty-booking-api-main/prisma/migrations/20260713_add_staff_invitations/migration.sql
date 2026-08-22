CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TABLE "staff_invitations" (
  "id" TEXT NOT NULL, "email" TEXT NOT NULL, "role_code" "RoleCode" NOT NULL,
  "business_id" TEXT NOT NULL, "branch_id" TEXT, "token_hash" TEXT NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING', "invited_by" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL, "accepted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_invitations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "staff_invitations_token_hash_key" ON "staff_invitations"("token_hash");
CREATE INDEX "staff_invitations_email_status_idx" ON "staff_invitations"("email", "status");
CREATE INDEX "staff_invitations_business_id_branch_id_idx" ON "staff_invitations"("business_id", "branch_id");
