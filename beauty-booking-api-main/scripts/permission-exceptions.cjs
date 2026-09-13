// Exact route exceptions, not permission grants. These endpoints must remain
// authenticated and enforce the specified identity/resource checks in service.
// New routes fail the coverage contract unless explicitly reviewed.
module.exports = Object.freeze({
  'POST /auth/logout': 'AuthService.logout revokes only sessions bound to CurrentUser.id/sessionId; logout must remain available without a business permission.',
  'POST /auth/change-password': 'AuthService.changePassword verifies the current password and updates CurrentUser.id only.',
  'GET /auth/sessions': 'AuthService.listSessions filters by CurrentUser.id.',
  'DELETE /auth/sessions': 'AuthService.revokeOtherSessions filters by CurrentUser.id and excludes the active session.',
  'DELETE /auth/sessions/{sessionId}': 'AuthService.revokeSession checks both requested session ID and CurrentUser.id.',
  'GET /auth/security-history': 'AuthService.securityHistory filters records by CurrentUser.id.',
  'POST /notifications/device-token': 'NotificationsService.registerDeviceToken binds the supplied device token to CurrentUser.id, including device account switching.',
  'POST /notifications/device-token/remove': 'NotificationsService.removeDeviceToken deletes by both token and CurrentUser.id.',
  'GET /media/{id}/content': 'MediaService.readForUser checks current uploader scope or resource-scoped legal-document permissions for PRIVATE content; historical upload ownership does not bypass revoked branch access. Other content checks tenant access.',
  'DELETE /media/{id}': 'MediaService.remove checks current branch/business scope for business media, self ownership for personal media, and scoped legal-document permissions for private documents; historical upload ownership cannot bypass current scope.',
  'GET /ownership-transfers/pending-for-me': 'OwnershipService.listIncoming filters newOwnerUserId by CurrentUser.id, including users not yet holding the owner role.',
  'PATCH /ownership-transfers/{id}/accept': 'OwnershipService.accept uses compare-and-set on ID, newOwnerUserId=CurrentUser.id and pending acceptance status.',
  'POST /staff/invitations/accept-existing': 'StaffInvitationsService.acceptExisting validates a pending unexpired token and matches invitation email to the active authenticated account before granting membership.',
});
