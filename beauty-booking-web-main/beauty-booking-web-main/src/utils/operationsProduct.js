const labels = {
  subject: { STAFF: 'Nhân viên', BRANCH: 'Chi nhánh', BUSINESS: 'Doanh nghiệp', SCHEDULE: 'Lịch làm việc' },
  action: { OFFBOARD: 'Ngừng làm việc', PAUSE: 'Tạm dừng', SUSPEND: 'Tạm đình chỉ', CLOSE: 'Đóng cửa', SCHEDULE_CHANGE: 'Thay đổi lịch làm việc', TRANSFER: 'Chuyển giao' },
  status: { OPEN: 'Chờ xử lý', IN_PROGRESS: 'Đang xử lý', READY_TO_COMPLETE: 'Sẵn sàng hoàn tất', COMPLETED: 'Đã hoàn tất', CANCELLED: 'Đã hủy', PENDING: 'Chờ xử lý', PROCESSING: 'Đang xử lý', RESOLVED: 'Đã xử lý', FAILED: 'Xử lý chưa thành công' },
};
export const operationLabel = (kind, value) => labels[kind]?.[value] || ({ subject: 'Đối tượng vận hành', action: 'Thay đổi vận hành', status: 'Chưa có thông tin trạng thái' }[kind]);
export const resolutionOptions = (finance) => [
  ['REASSIGN', 'Đổi nhân viên'], ['RESCHEDULE', 'Đổi thời gian'], ['TRANSFER_BRANCH', 'Chuyển chi nhánh'],
  ...(finance ? [['CANCEL_REFUND', 'Hủy và hoàn tiền']] : []), ['APPROVED_EXCEPTION', 'Giữ theo ngoại lệ'],
];
export function resolutionPayload(form, finance) {
  if (!resolutionOptions(finance).some(([value]) => value === form.resolution)) throw new Error('Phương án này hiện chưa được hỗ trợ. Vui lòng chọn lại.');
  return {
    resolution: form.resolution, reason: form.reason,
    replacementStaffId: ['REASSIGN', 'TRANSFER_BRANCH'].includes(form.resolution) ? form.replacementStaffId || undefined : undefined,
    replacementBranchId: form.resolution === 'TRANSFER_BRANCH' ? form.replacementBranchId || undefined : undefined,
    proposedStartAt: form.resolution === 'RESCHEDULE' && form.proposedStartAt ? new Date(form.proposedStartAt).toISOString() : undefined,
  };
}
const array = (value) => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : [];
const branchOf = (value) => value?.branchId || value?.branch?.id;
const businessOf = (value) => value?.businessId || value?.branch?.businessId || value?.business?.id;
export class ChoiceDataError extends Error {}
export function transferChoices(branches, businessId, items) {
  const sources = new Set(items.map((item) => branchOf(item.booking)));
  return array(branches).filter((branch) => branch.id && businessOf(branch) === businessId && branch.status === 'ACTIVE' && branch.operationalStatus === 'ACTIVE' && !branch.deletedAt && !sources.has(branch.id));
}
export const choiceContext = (businessId, items, resolution, branchId) => JSON.stringify([businessId, resolution, branchId, items.map((item) => [item.id, branchOf(item.booking), item.booking?.bookingServices])]);

// Management data proves scope and service capability, not live availability.
// Linked-user isActive/deletedAt are omitted by getAll; the backend validates
// these, opening hours and overlaps at submission. Never require publicVisible.
export async function loadStaffChoices({ businessId, items, resolution, targetBranchId, branches, staffApi, servicesApi }) {
  if (!items.length || items.some((item) => !branchOf(item.booking) || !Array.isArray(item.booking?.bookingServices))) throw new ChoiceDataError('Thiếu thông tin chi nhánh hoặc dịch vụ của lịch hẹn. Hãy tải lại hồ sơ.');
  if (items.some((item) => !array(branches).some((branch) => branch.id === branchOf(item.booking) && businessOf(branch) === businessId))) throw new ChoiceDataError('Chi nhánh của lịch hẹn không thuộc phạm vi hiện tại. Hãy tải lại hồ sơ.');
  if (resolution === 'TRANSFER_BRANCH' && !transferChoices(branches, businessId, items).some((branch) => branch.id === targetBranchId)) throw new ChoiceDataError('Hãy chọn chi nhánh trong doanh nghiệp đang nhận lịch.');
  const branchIds = [...new Set(items.map((item) => resolution === 'TRANSFER_BRANCH' ? targetBranchId : branchOf(item.booking)))];
  const staffByBranch = new Map(await Promise.all(branchIds.map(async (id) => [id, array(await staffApi.getAll(id))])));
  const offerings = resolution === 'TRANSFER_BRANCH' ? array(await servicesApi.getManage(targetBranchId)) : [];
  const perItem = items.map((item) => {
    const branchId = resolution === 'TRANSFER_BRANCH' ? targetBranchId : branchOf(item.booking);
    const services = item.booking.bookingServices.filter((service) => resolution === 'TRANSFER_BRANCH' || ['SCHEDULED', 'IN_PROGRESS'].includes(service.status));
    if (!services.length) throw new ChoiceDataError('Lịch hẹn không có dịch vụ cần đổi nhân viên. Hãy tải lại hồ sơ.');
    const serviceIds = services.map((service) => {
      if (resolution !== 'TRANSFER_BRANCH') {
        if (!service.serviceId) throw new ChoiceDataError('Thiếu thông tin dịch vụ. Hãy tải lại hồ sơ.');
        return service.serviceId;
      }
      if (!service.businessServiceId) throw new ChoiceDataError('Thiếu thông tin đối chiếu dịch vụ giữa chi nhánh. Hãy tải lại hồ sơ.');
      const matches = offerings.filter((offering) => branchOf(offering) === branchId && businessOf(offering) === businessId && offering.businessServiceId === service.businessServiceId && offering.status === 'ACTIVE' && offering.bookable === true && !offering.deletedAt && (offering.durationMinutes ?? offering.duration) === service.durationMinutes);
      if (matches.length > 1) throw new ChoiceDataError('Không thể xác định duy nhất dịch vụ tại chi nhánh đích. Hãy tải lại hồ sơ.');
      return matches[0]?.id;
    });
    if (serviceIds.some((id) => !id)) return [];
    return staffByBranch.get(branchId).filter((staff) => staff.id && branchOf(staff) === branchId && businessOf(staff) === businessId && staff.status === 'ACTIVE' && staff.isBookable === true && !staff.deletedAt && staff.user?.isActive !== false && !staff.user?.deletedAt && serviceIds.every((id) => array(staff.services).some((service) => service.id === id)));
  });
  return perItem[0].filter((staff) => perItem.every((choices) => choices.some((choice) => choice.id === staff.id)));
}

export function assertChoice(form, key, state, branches) {
  if (!['REASSIGN', 'TRANSFER_BRANCH'].includes(form.resolution)) return;
  if (state.key !== key || state.loading || state.error || !state.rows.some((staff) => staff.id === form.replacementStaffId)) throw new Error('Vui lòng chọn nhân viên từ danh sách hiện tại.');
  if (form.resolution === 'TRANSFER_BRANCH' && !branches.some((branch) => branch.id === form.replacementBranchId)) throw new Error('Vui lòng chọn lại chi nhánh.');
}
