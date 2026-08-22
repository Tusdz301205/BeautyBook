import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Clock3,
  Download,
  Eye,
  FileClock,
  FileText,
  History,
  LockKeyhole,
  Megaphone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { privacyApi } from '../../api/apiClient';
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Skeleton,
  Textarea,
} from '../../components/ui';
import '../../styles/privacy-center.css';

const SECTION_DEFINITIONS = [
  { id: 'shares', label: 'Chia sẻ', icon: ShieldCheck },
  { id: 'access', label: 'Truy cập', icon: Eye },
  { id: 'retention', label: 'Lưu trữ', icon: Archive },
  { id: 'requests', label: 'Yêu cầu', icon: FileClock },
  { id: 'marketing', label: 'Tiếp thị', icon: Megaphone },
];

const REQUEST_TYPES = {
  EXPORT: 'Xuất dữ liệu',
  RECTIFICATION: 'Chỉnh sửa dữ liệu',
  ERASURE: 'Xóa dữ liệu',
  RESTRICT_PROCESSING: 'Hạn chế xử lý',
  OBJECT_PROCESSING: 'Phản đối xử lý',
  DELETE_ACCOUNT: 'Xóa tài khoản',
};

const REQUEST_STATUSES = {
  RECEIVED: 'Đã tiếp nhận',
  IDENTITY_VERIFICATION: 'Đang xác minh',
  IN_PROGRESS: 'Đang xử lý',
  COMPLETED: 'Đã hoàn tất',
  REJECTED: 'Không thể thực hiện',
  CANCELLED: 'Đã hủy',
};

const ACCESS_RESULTS = {
  GRANTED: { label: 'Đã cho xem', tone: 'success' },
  DENIED: { label: 'Đã từ chối', tone: 'danger' },
  REDACTED: { label: 'Đã che dữ liệu', tone: 'warning' },
};

const ROLE_LABELS = {
  CUSTOMER: 'Khách hàng',
  STAFF: 'Nhân viên phục vụ',
  RECEPTIONIST: 'Lễ tân',
  BRANCH_MANAGER: 'Quản lý chi nhánh',
  BUSINESS_OWNER: 'Chủ doanh nghiệp',
  PLATFORM_ADMIN: 'Quản trị nền tảng',
  ADMIN: 'Quản trị viên',
};

const MARKETING_OPTIONS = [
  {
    key: 'emailMarketing',
    title: 'Email ưu đãi',
    description: 'Nhận ưu đãi và nội dung giới thiệu dịch vụ qua email.',
  },
  {
    key: 'smsMarketing',
    title: 'Tin nhắn SMS',
    description: 'Nhận chương trình tiếp thị qua số điện thoại đã xác minh.',
  },
  {
    key: 'pushMarketing',
    title: 'Thông báo tiếp thị',
    description: 'Nhận thông báo ưu đãi trong ứng dụng hoặc trên thiết bị.',
  },
  {
    key: 'personalizedPromotions',
    title: 'Ưu đãi cá nhân hóa',
    description: 'Cho phép dùng lịch sử đặt lịch để chọn nội dung phù hợp hơn.',
  },
];

const DEFAULT_MARKETING = {
  emailMarketing: false,
  smsMarketing: false,
  pushMarketing: false,
  personalizedPromotions: false,
};

function formatDate(value, includeTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', includeTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(date);
}

function requestStatusTone(status) {
  if (status === 'COMPLETED') return 'success';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'danger';
  if (status === 'IN_PROGRESS' || status === 'IDENTITY_VERIFICATION') return 'warning';
  return 'info';
}

export default function PrivacySettings() {
  const [center, setCenter] = useState(null);
  const [activeSection, setActiveSection] = useState('shares');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestType, setRequestType] = useState('RECTIFICATION');
  const [requestReason, setRequestReason] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [exporting, setExporting] = useState(false);
  const [marketing, setMarketing] = useState(DEFAULT_MARKETING);
  const [marketingBaseline, setMarketingBaseline] = useState(DEFAULT_MARKETING);
  const [savingMarketing, setSavingMarketing] = useState(false);

  const loadCenter = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const payload = await privacyApi.getCenter();
      setCenter(payload);
      const preferences = { ...DEFAULT_MARKETING, ...(payload?.sections?.marketing || {}) };
      const normalized = Object.fromEntries(
        Object.keys(DEFAULT_MARKETING).map((key) => [key, Boolean(preferences[key])]),
      );
      setMarketing(normalized);
      setMarketingBaseline(normalized);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    void loadCenter();
  }, []);

  const shares = center?.sections?.shares || [];
  const accessHistory = center?.sections?.accessHistory || [];
  const retention = center?.sections?.retention || [];
  const dataRequests = center?.sections?.dataRequests || [];
  const marketingDirty = useMemo(
    () => Object.keys(DEFAULT_MARKETING).some((key) => marketing[key] !== marketingBaseline[key]),
    [marketing, marketingBaseline],
  );

  const counts = {
    shares: shares.filter((share) => share.active).length,
    access: accessHistory.length,
    retention: retention.length,
    requests: dataRequests.length,
    marketing: Object.values(marketing).filter(Boolean).length,
  };

  const revokeShare = async () => {
    if (!revokeTarget?.id) return;
    setRevoking(true);
    try {
      await privacyApi.revokeConsent(revokeTarget.id);
      setRevokeTarget(null);
      setStatusMessage('Quyền chia sẻ đã được thu hồi. Các lần đọc mới sẽ bị từ chối.');
      await loadCenter({ quiet: true });
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setRevoking(false);
    }
  };

  const createDataRequest = async (event) => {
    event.preventDefault();
    setRequesting(true);
    try {
      const result = await privacyApi.createDataRequest({
        type: requestType,
        reason: requestReason.trim() || undefined,
      });
      setRequestDialogOpen(false);
      setRequestReason('');
      setStatusMessage(
        result?.duplicate
          ? 'Yêu cầu cùng loại đang được xử lý; BeautyBook không tạo bản trùng.'
          : 'Yêu cầu dữ liệu đã được tiếp nhận.',
      );
      await loadCenter({ quiet: true });
      setActiveSection('requests');
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setRequesting(false);
    }
  };

  const saveMarketing = async (event) => {
    event.preventDefault();
    setSavingMarketing(true);
    try {
      const result = await privacyApi.updateMarketingPreferences(marketing);
      const normalized = Object.fromEntries(
        Object.keys(DEFAULT_MARKETING).map((key) => [key, Boolean(result?.[key])]),
      );
      setMarketing(normalized);
      setMarketingBaseline(normalized);
      setCenter((current) => current
        ? {
            ...current,
            sections: {
              ...current.sections,
              marketing: result,
            },
          }
        : current);
      setStatusMessage('Lựa chọn tiếp thị đã được lưu.');
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setSavingMarketing(false);
    }
  };

  const exportData = async (event) => {
    event.preventDefault();
    if (!currentPassword) return;
    setExporting(true);
    try {
      const exportPackage = await privacyApi.createExport(currentPassword);
      const payload = await privacyApi.downloadExport(
        exportPackage.id,
        exportPackage.downloadToken,
      );
      const objectUrl = URL.createObjectURL(
        new Blob([JSON.stringify(payload, null, 2)], {
          type: 'application/json;charset=utf-8',
        }),
      );
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `beautybook-du-lieu-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setCurrentPassword('');
      setExportDialogOpen(false);
      setStatusMessage('Bản xuất dữ liệu một lần đã được tải xuống thiết bị này.');
      await loadCenter({ quiet: true });
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="privacy-center">
      <header className="privacy-center__header">
        <div className="privacy-center__heading">
          <p className="privacy-center__kicker">Dữ liệu của bạn</p>
          <h1>Trung tâm quyền riêng tư</h1>
          <p>
            Xem ai đã được phép đọc dữ liệu tư vấn, kiểm tra lịch sử truy cập
            và gửi yêu cầu xử lý dữ liệu từ một nơi.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setExportDialogOpen(true)} disabled={loading || Boolean(error)}>
          <Download size={17} aria-hidden="true" />
          Xuất dữ liệu
        </Button>
      </header>

      <div className="privacy-center__assurance" role="note">
        <LockKeyhole size={18} aria-hidden="true" />
        <p>
          Dữ liệu tư vấn nhạy cảm chỉ được mở trong đúng lịch hẹn, cho đúng nhân
          sự được phân công. Mỗi lần đọc đều được máy chủ ghi lại.
        </p>
      </div>

      <p className="privacy-center__live" aria-live="polite">{statusMessage}</p>

      {loading ? (
        <section className="privacy-center__loading" aria-label="Đang tải trung tâm quyền riêng tư">
          <Skeleton rows={8} />
        </section>
      ) : error ? (
        <section className="privacy-center__error">
          <ErrorState message={error} onRetry={() => loadCenter()} />
        </section>
      ) : (
        <>
          <section className="privacy-center__account" aria-labelledby="privacy-account-title">
            <div>
              <p id="privacy-account-title" className="privacy-center__account-label">Tài khoản đang kiểm soát</p>
              <strong>{center?.account?.fullName || center?.account?.email}</strong>
              <span>{center?.account?.email}</span>
            </div>
            <dl className="privacy-center__summary">
              <SummaryItem label="Lịch hẹn" value={center?.summary?.bookingCount || 0} />
              <SummaryItem label="Hồ sơ tư vấn" value={center?.summary?.submissionCount || 0} />
              <SummaryItem label="Chia sẻ hiệu lực" value={center?.summary?.activeShareCount || 0} />
              <SummaryItem label="Lần truy cập ghi nhận" value={center?.summary?.accessEventCount || 0} />
            </dl>
            <Link className="privacy-center__profile-link" to="/customer/profile">
              <UserRound size={16} aria-hidden="true" />
              Sửa hồ sơ
            </Link>
          </section>

          <div className="privacy-center__workspace">
            <nav className="privacy-center__index" aria-label="Các phần quyền riêng tư">
              {SECTION_DEFINITIONS.map(({ id, label, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  className="privacy-center__index-button"
                  aria-current={activeSection === id ? 'page' : undefined}
                  onClick={() => setActiveSection(id)}
                >
                  <Icon size={17} aria-hidden="true" />
                  <span>{label}</span>
                  <span className="privacy-center__index-count">{counts[id]}</span>
                </button>
              ))}
            </nav>

            <section className="privacy-center__content" aria-live="polite">
              {activeSection === 'shares' && (
                <SharesSection shares={shares} onRevoke={setRevokeTarget} />
              )}
              {activeSection === 'access' && (
                <AccessSection events={accessHistory} />
              )}
              {activeSection === 'retention' && (
                <RetentionSection entries={retention} />
              )}
              {activeSection === 'requests' && (
                <RequestsSection
                  requests={dataRequests}
                  onCreate={() => setRequestDialogOpen(true)}
                />
              )}
              {activeSection === 'marketing' && (
                <MarketingSection
                  values={marketing}
                  dirty={marketingDirty}
                  saving={savingMarketing}
                  updatedAt={center?.sections?.marketing?.updatedAt}
                  onChange={(key, value) => {
                    setMarketing((current) => ({ ...current, [key]: value }));
                    setStatusMessage('');
                  }}
                  onSubmit={saveMarketing}
                />
              )}
            </section>
          </div>
        </>
      )}

      <Dialog
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title="Thu hồi quyền chia sẻ"
        description="Quyền này gắn riêng với dữ liệu, lịch hẹn và người nhận đã nêu."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>Giữ nguyên</Button>
            <Button variant="danger" loading={revoking} onClick={revokeShare}>Thu hồi quyền</Button>
          </>
        )}
      >
        <div className="privacy-center__dialog-copy">
          <p>
            Sau khi thu hồi, người nhận không thể mở dữ liệu này ở những lần
            truy cập mới. Nhật ký cũ vẫn được giữ để phục vụ kiểm tra.
          </p>
          <dl>
            <Detail term="Dữ liệu" value={revokeTarget?.field?.label || revokeTarget?.dataCategory} />
            <Detail term="Lịch hẹn" value={revokeTarget?.booking?.bookingCode || '—'} />
            <Detail
              term="Cơ sở"
              value={[
                revokeTarget?.booking?.branch?.business?.name,
                revokeTarget?.booking?.branch?.name,
              ].filter(Boolean).join(' · ') || '—'}
            />
          </dl>
        </div>
      </Dialog>

      <Dialog
        open={requestDialogOpen}
        onClose={() => setRequestDialogOpen(false)}
        title="Tạo yêu cầu dữ liệu"
        description="BeautyBook ghi nhận ngày tiếp nhận và hạn xử lý cho từng yêu cầu."
        footer={(
          <>
            <Button variant="secondary" onClick={() => setRequestDialogOpen(false)}>Đóng</Button>
            <Button type="submit" form="privacy-request-form" loading={requesting}>Gửi yêu cầu</Button>
          </>
        )}
      >
        <form id="privacy-request-form" className="privacy-center__form" onSubmit={createDataRequest}>
          <Field label="Loại yêu cầu" required>
            <select
              className="privacy-center__control"
              value={requestType}
              onChange={(event) => setRequestType(event.target.value)}
            >
              {Object.entries(REQUEST_TYPES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Lý do hoặc phạm vi"
            hint="Không nhập mật khẩu, thông tin thẻ hoặc dữ liệu sức khỏe vào đây."
          >
            <Textarea
              value={requestReason}
              maxLength={2000}
              onChange={(event) => setRequestReason(event.target.value)}
              placeholder="Nêu dữ liệu hoặc phạm vi bạn muốn BeautyBook xử lý"
            />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={exportDialogOpen}
        onClose={() => {
          if (!exporting) {
            setExportDialogOpen(false);
            setCurrentPassword('');
          }
        }}
        title="Xuất dữ liệu tài khoản"
        description="Bản xuất được tạo ở máy chủ, mã hóa và chỉ tải được một lần."
        footer={(
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setExportDialogOpen(false);
                setCurrentPassword('');
              }}
              disabled={exporting}
            >
              Đóng
            </Button>
            <Button
              type="submit"
              form="privacy-export-form"
              loading={exporting}
              disabled={!currentPassword}
            >
              Xác minh và tải
            </Button>
          </>
        )}
      >
        <form id="privacy-export-form" className="privacy-center__form" onSubmit={exportData}>
          <Field
            label="Mật khẩu hiện tại"
            required
            hint="Mật khẩu chỉ dùng để xác minh phiên xuất dữ liệu này."
          >
            <Input
              autoFocus
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>
          <div className="privacy-center__export-note">
            <Clock3 size={17} aria-hidden="true" />
            <p>
              Liên kết tải hết hạn trong thời gian ngắn và không thể dùng lại
              sau lần tải đầu tiên.
            </p>
          </div>
        </form>
      </Dialog>
    </main>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{Number(value).toLocaleString('vi-VN')}</dd>
    </div>
  );
}

function SectionHeading({ title, description, action }) {
  return (
    <header className="privacy-center__section-heading">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function SharesSection({ shares, onRevoke }) {
  return (
    <>
      <SectionHeading
        title="Quyền chia sẻ đang ghi nhận"
        description="Mỗi quyền chỉ áp dụng cho một trường dữ liệu trong một lịch hẹn cụ thể."
      />
      {!shares.length ? (
        <EmptyState
          icon={ShieldCheck}
          title="Chưa có quyền chia sẻ"
          description="Quyền sẽ xuất hiện sau khi bạn gửi biểu mẫu tư vấn cho một lịch hẹn yêu cầu thông tin nhạy cảm."
        />
      ) : (
        <div className="privacy-center__records">
          {shares.map((share) => (
            <article className="privacy-center__record" key={share.id}>
              <header>
                <div>
                  <h3>{share.field?.label || share.dataCategory || 'Dữ liệu tư vấn'}</h3>
                  <p>{share.service?.name || 'Dịch vụ trong lịch hẹn'}</p>
                </div>
                <Badge tone={share.active ? 'success' : 'neutral'}>
                  {share.active ? 'Đang hiệu lực' : 'Đã hết hiệu lực'}
                </Badge>
              </header>
              <dl className="privacy-center__details">
                <Detail
                  term="Cơ sở nhận"
                  value={[
                    share.booking?.branch?.business?.name,
                    share.booking?.branch?.name,
                  ].filter(Boolean).join(' · ') || '—'}
                />
                <Detail term="Lịch hẹn" value={share.booking?.bookingCode || '—'} />
                <Detail term="Mục đích" value={share.purpose || 'Phục vụ lịch hẹn'} />
                <Detail
                  term="Thời hạn"
                  value={`${formatDate(share.createdAt)} – ${formatDate(share.expiresAt)}`}
                />
              </dl>
              <footer>
                <p>
                  Thông báo đồng ý {share.noticeVersion || '—'} · người nhận{' '}
                  {share.recipientType || 'nhân sự được phân công'}
                </p>
                {share.active && (
                  <Button variant="secondary" size="sm" onClick={() => onRevoke(share)}>
                    Thu hồi
                  </Button>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function AccessSection({ events }) {
  return (
    <>
      <SectionHeading
        title="Lịch sử truy cập"
        description="Nhật ký ghi cả lần được phép, bị từ chối và dữ liệu đã che."
      />
      {!events.length ? (
        <EmptyState
          icon={History}
          title="Chưa có lần truy cập"
          description="Khi dữ liệu tư vấn được đọc hoặc bị chặn, sự kiện sẽ xuất hiện tại đây."
        />
      ) : (
        <ol className="privacy-center__timeline">
          {events.map((event) => {
            const result = ACCESS_RESULTS[event.result] || {
              label: event.result || 'Đã ghi nhận',
              tone: 'neutral',
            };
            return (
              <li key={event.id}>
                <span className="privacy-center__timeline-mark" aria-hidden="true" />
                <div>
                  <header>
                    <div>
                      <h3>{event.actorName}</h3>
                      <p>{ROLE_LABELS[event.actorRole] || event.actorRole || 'Tài khoản hệ thống'}</p>
                    </div>
                    <Badge tone={result.tone}>{result.label}</Badge>
                  </header>
                  <dl className="privacy-center__details">
                    <Detail term="Thời điểm" value={formatDate(event.createdAt, true)} />
                    <Detail term="Mục đích" value={event.purpose || 'Kiểm tra quyền truy cập'} />
                    <Detail term="Lịch hẹn" value={event.bookingId || '—'} />
                    <Detail
                      term="Truy cập khẩn cấp"
                      value={event.breakGlassGrantId ? 'Có, đã ghi lý do và thời hạn' : 'Không'}
                    />
                  </dl>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

function RetentionSection({ entries }) {
  return (
    <>
      <SectionHeading
        title="Thời hạn lưu dữ liệu"
        description="Thời hạn được tính theo phiên bản biểu mẫu đã dùng khi bạn gửi thông tin."
      />
      {!entries.length ? (
        <EmptyState
          icon={Archive}
          title="Chưa có dữ liệu tư vấn đang lưu"
          description="Mục này chỉ liệt kê biểu mẫu tư vấn đã được gửi từ tài khoản của bạn."
        />
      ) : (
        <div className="privacy-center__retention-list">
          {entries.map((entry) => (
            <article key={entry.id}>
              <div>
                <h3>{entry.service?.name || 'Hồ sơ tư vấn'}</h3>
                <p>Lịch hẹn {entry.booking?.bookingCode || entry.bookingId}</p>
              </div>
              <dl>
                <Detail term="Đã gửi" value={formatDate(entry.submittedAt)} />
                <Detail term="Lưu đến" value={formatDate(entry.retentionUntil)} />
                <Detail term="Trạng thái" value={entry.status || '—'} />
              </dl>
              {entry.legalHoldReason && (
                <div className="privacy-center__legal-hold">
                  <FileText size={16} aria-hidden="true" />
                  <span>Đang tạm giữ theo nghĩa vụ pháp lý: {entry.legalHoldReason}</span>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function RequestsSection({ requests, onCreate }) {
  return (
    <>
      <SectionHeading
        title="Yêu cầu xử lý dữ liệu"
        description="Theo dõi ngày tiếp nhận, hạn trả lời và kết quả ngay trên tài khoản."
        action={(
          <Button onClick={onCreate}>
            <FileClock size={17} aria-hidden="true" />
            Tạo yêu cầu
          </Button>
        )}
      />
      {!requests.length ? (
        <EmptyState
          icon={FileClock}
          title="Chưa có yêu cầu dữ liệu"
          description="Bạn có thể yêu cầu chỉnh sửa, xóa, hạn chế xử lý hoặc xóa tài khoản."
          action={<Button variant="secondary" onClick={onCreate}>Tạo yêu cầu đầu tiên</Button>}
        />
      ) : (
        <div className="privacy-center__request-list">
          {requests.map((request) => (
            <article key={request.id}>
              <header>
                <div>
                  <h3>{REQUEST_TYPES[request.type] || request.type}</h3>
                  <p>Gửi ngày {formatDate(request.createdAt)}</p>
                </div>
                <Badge tone={requestStatusTone(request.status)}>
                  {REQUEST_STATUSES[request.status] || request.status}
                </Badge>
              </header>
              <dl className="privacy-center__details">
                <Detail term="Hạn phản hồi" value={formatDate(request.deadlineAt)} />
                <Detail term="Hoàn tất" value={formatDate(request.completedAt)} />
                {request.reason && <Detail term="Phạm vi" value={request.reason} />}
                {request.resolution && <Detail term="Kết quả" value={request.resolution} />}
              </dl>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function MarketingSection({
  values,
  dirty,
  saving,
  updatedAt,
  onChange,
  onSubmit,
}) {
  return (
    <>
      <SectionHeading
        title="Lựa chọn tiếp thị"
        description="Thông báo vận hành về lịch hẹn và bảo mật không bị ảnh hưởng bởi các lựa chọn này."
      />
      <form className="privacy-center__marketing" onSubmit={onSubmit}>
        <fieldset>
          <legend className="bb-sr-only">Kênh và phạm vi tiếp thị</legend>
          {MARKETING_OPTIONS.map((option) => (
            <label key={option.key} className="privacy-center__marketing-row">
              <span>
                <strong>{option.title}</strong>
                <small>{option.description}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={values[option.key]}
                onChange={(event) => onChange(option.key, event.target.checked)}
              />
            </label>
          ))}
        </fieldset>
        <footer>
          <p>
            {dirty
              ? 'Có thay đổi chưa lưu.'
              : updatedAt
                ? `Cập nhật lần cuối ${formatDate(updatedAt, true)}.`
                : 'Chưa từng bật tiếp thị.'}
          </p>
          <Button type="submit" loading={saving} disabled={!dirty}>Lưu lựa chọn</Button>
        </footer>
      </form>
    </>
  );
}

function Detail({ term, value }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>{value || '—'}</dd>
    </div>
  );
}
