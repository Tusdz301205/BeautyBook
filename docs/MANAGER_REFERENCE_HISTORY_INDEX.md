# Manager references — historical-document index

Reviewed: 14/09/2026. This is a navigation/classification index, not a completed database migration or a final architecture diagram set.

For the current role decision, capability ownership, live-data gate and verification status, use [Manager refactor status](./MANAGER_ROLE_REFACTOR_STATUS.md). Earlier documents below remain evidence of earlier implementations or proposals; their Manager role matrices, demo accounts and commands are not current instructions. Unrelated content is not declared obsolete by this index.

## Current-looking documents with pre-refactor role claims

These names can be mistaken for current authority. Their cited Manager portions are superseded by the refactor status, even where the original document still uses present tense.

| Document | Historical Manager content |
| --- | --- |
| [AI_HANDOFF.md](./AI_HANDOFF.md) | SALON role matrix and former Manager demo-account listing (lines 85, 196). |
| [CURRENT_PROJECT_STATUS.md](./CURRENT_PROJECT_STATUS.md) | 16/07/2026 shell/branch-role description (lines 7–9). |
| [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) | Former role list and demo-account listing (lines 47, 85); HR scope elsewhere also predates retirement. |
| [design.md](./design.md) | Earlier shared Workbench responsibility list includes Manager (line 50). |
| [SECTION_A_IDENTITY_WORKSPACE_ARCHITECTURE.md](./SECTION_A_IDENTITY_WORKSPACE_ARCHITECTURE.md) | Earlier SALON workspace allowlist (line 10). |
| [SECTION_A_ADMIN_AND_DETAIL_REBUILD.md](./SECTION_A_ADMIN_AND_DETAIL_REBUILD.md) | Earlier Owner/Manager review reply/report examples (lines 42–43). The platform-only moderation principle remains relevant. |
| [Backend RBAC_SCOPE.md](../beauty-booking-api-main/RBAC_SCOPE.md) | Prior role diagram, decorators and branch-scope examples (lines 28, 89, 240). |
| [Backend RBAC_SCOPE_ASSUMPTIONS.md](../beauty-booking-api-main/RBAC_SCOPE_ASSUMPTIONS.md) | Earlier Manager permissions/role-level assumptions (lines 30, 64, 82). |

## Historical proposals, audits and implementation reports

Preserve these as dated/proposal evidence. They do not authorize reintroducing Manager, old platform roles, HR, attendance, shifts or payroll.

| Category | Documents |
| --- | --- |
| Original requirements questions | [00_TongQuan_PhuongPhap.md](./00_TongQuan_PhuongPhap.md), especially the unresolved multi-role question at line 78. |
| RBAC blueprint and sprint plan | [RBAC_SCOPE_ANALYSIS.md](./RBAC_SCOPE_ANALYSIS.md), [RBAC_TODOS.md](./RBAC_TODOS.md), [Sprint_0_RBAC_Audit.md](./Sprint_0_RBAC_Audit.md). Old examples include Manager role grants, limits and schedule permissions; do not execute them as migration recipes. |
| Project/business audit snapshots | [BAO_CAO_PHAM_VI_CONG_VIEC_VA_TIEN_DO.md](./BAO_CAO_PHAM_VI_CONG_VIEC_VA_TIEN_DO.md), [BEAUTYBOOK_BUSINESS_AUDIT_2026-08-22.md](./BEAUTYBOOK_BUSINESS_AUDIT_2026-08-22.md). |
| Portal, calendar and UI implementation reports | [global-appointment-calendar-report.md](./global-appointment-calendar-report.md), [role-specific-ux-business-consistency-report.md](./role-specific-ux-business-consistency-report.md), [WEB_API_FEATURE_COMPLETION_REPORT.md](./WEB_API_FEATURE_COMPLETION_REPORT.md), [FULL_PRODUCT_REDESIGN_REPORT.md](./FULL_PRODUCT_REDESIGN_REPORT.md), [BEAUTYBOOK_COMPLETE_UIUX_REDESIGN_REPORT.md](./BEAUTYBOOK_COMPLETE_UIUX_REDESIGN_REPORT.md), [BEAUTYBOOK_SEGMENT_A_B_UIUX_SECURITY_REPORT.md](./BEAUTYBOOK_SEGMENT_A_B_UIUX_SECURITY_REPORT.md). |
| Former HR/attendance rollout | [PLATFORM_TRUST_ONBOARDING_ATTENDANCE_REPORT.md](./PLATFORM_TRUST_ONBOARDING_ATTENDANCE_REPORT.md). Historical archive retention does not make that subsystem active again. |
| Historical seed verification | [REALISTIC_DATABASE_SEED_REPORT.md](./REALISTIC_DATABASE_SEED_REPORT.md). Old Manager fixtures are not instructions to reseed the live database. Future seed fixtures have changed; live principal mapping is separately gated. |
| Bookability and title-filtering evidence | [FRESHA_INSPIRED_REDESIGN_AND_BOOKABLE_STAFF_FIX.md](./FRESHA_INSPIRED_REDESIGN_AND_BOOKABLE_STAFF_FIX.md). Old invitation/seed role examples are superseded. The separation of authorization, professional eligibility and public visibility remains valid, including rejection/filtering of historical Manager labels. |

## Migration history and old diagrams

- [20260710 business-logic migration README](../beauty-booking-api-main/prisma/migrations/20260710_add_business_logic/README.md), line 37, describes the historical `SalonMemberRole.MANAGER` enum. Keep it with its immutable migration; do not rewrite history to match the future enum.
- [Existing diagrams README](./diagrams/README.md), line 15, still describes a four-role salon use-case set including Manager. That set is a **pre-refactor diagram snapshot**, not the final post-retirement model. No diagram source, SVG, or final diagram verification was produced by this index. Final diagram replacement belongs to the later approved phase.

## Search matches that are not Manager authorization

- “Secret manager” in [SECURITY_AUDIT_BEFORE_DEPLOY.md](./SECURITY_AUDIT_BEFORE_DEPLOY.md), line 35, refers to secret storage; no role cleanup is needed there. The same generic term occurs inside other reports.
- ORM `.manager.query`, “AWS Secrets Manager”, and generic future “regional manager” examples inside the old RBAC blueprint are not current positive grants merely because a keyword search matches them.
- Vietnamese “quản lý chi nhánh” can mean the branch-management function rather than a role. Evaluate the surrounding sentence; Owner still manages branches.
- `Branch.managerName`, historical professional-position filtering, read-only data audit scripts, and negative retirement tests may intentionally retain the word. Their status is documented in the current refactor report; a zero raw-text-match count is not the completion criterion.

The completion criterion is no supported positive Manager authorization in the active application, followed by an approved, verified data/enum migration. Historical evidence and explicit denial tests should remain distinguishable from active behavior.
