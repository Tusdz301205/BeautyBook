import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, Store, UserRound } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AuthField, AuthInput, AuthShell, PasswordControl } from '../../components/public/AuthShell';
import { useAuthStore } from '../../store/authStore';

const fieldIds = ['fullName', 'email', 'phone', 'password', 'confirmPassword', 'terms'];

function normalizePhone(value) {
  return value.trim().replace(/[\s.-]/g, '');
}

function validate(form) {
  const errors = {};
  const name = form.fullName.trim();
  const email = form.email.trim();
  const phone = normalizePhone(form.phone);
  if (name.length < 2) errors.fullName = 'Nhập họ và tên có ít nhất 2 ký tự.';
  else if (name.length > 100) errors.fullName = 'Họ và tên không được vượt quá 100 ký tự.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Nhập địa chỉ email hợp lệ, ví dụ ten@domain.vn.';
  if (phone && !/^(?:0\d{9}|\+84\d{9})$/.test(phone)) errors.phone = 'Dùng 10 chữ số bắt đầu bằng 0, hoặc mã quốc gia +84.';
  if (form.password.length < 8 || !/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password) || !/\d/.test(form.password)) {
    errors.password = 'Dùng ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.';
  } else if (form.password.length > 128) errors.password = 'Mật khẩu không được vượt quá 128 ký tự.';
  if (form.confirmPassword !== form.password) errors.confirmPassword = 'Mật khẩu nhập lại chưa khớp.';
  if (!form.terms) errors.terms = 'Bạn cần đồng ý điều khoản sử dụng và chính sách bảo mật để đăng ký.';
  return errors;
}

function passwordStrength(password) {
  const checks = [password.length >= 8, /[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password)];
  const score = checks.filter(Boolean).length;
  return { score, label: ['Chưa nhập', 'Rất yếu', 'Yếu', 'Khá', 'Tốt'][score] };
}

export function RegisterScreen({ accountType = 'CUSTOMER' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { register, isAuthenticated, user } = useAuthStore();
  const isOwner = accountType === 'BUSINESS_OWNER';
  const [form, setForm] = useState({ accountType, fullName: '', email: '', phone: '', password: '', confirmPassword: '', terms: false });
  const [touched, setTouched] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const errors = useMemo(() => validate(form), [form]);
  const strength = useMemo(() => passwordStrength(form.password), [form.password]);
  const requestedPath = typeof location.state?.from === 'string' && location.state.from.startsWith('/')
    ? location.state.from
    : null;

  if (isAuthenticated()) {
    const target = user?.sessionType === 'admin' ? '/admin' : user?.sessionType === 'salon' ? '/salon' : '/customer/appointments';
    return <Navigate to={target} replace />;
  }

  const update = (field) => (event) => {
    const value = field === 'terms' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
    setServerError('');
  };
  const blur = (field) => () => setTouched((current) => ({ ...current, [field]: true }));
  const errorFor = (field) => touched[field] ? errors[field] : '';

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setTouched(Object.fromEntries(fieldIds.map((field) => [field, true])));
    const currentErrors = validate(form);
    const firstInvalid = fieldIds.find((field) => currentErrors[field]);
    if (firstInvalid) {
      document.getElementById(`register-${firstInvalid}`)?.focus();
      return;
    }
    setLoading(true);
    setServerError('');
    try {
      await register({
        accountType: form.accountType,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        ...(form.phone.trim() ? { phone: normalizePhone(form.phone) } : {}),
      });
      toast.success(isOwner
        ? 'Tài khoản chủ doanh nghiệp đã được tạo. Hãy hoàn thiện hồ sơ để gửi xét duyệt.'
        : 'Tài khoản khách hàng đã được tạo. Kiểm tra email để xác minh tài khoản.');
      navigate(isOwner ? '/salon/onboarding' : requestedPath || '/customer/appointments', { replace: true, state: { registered: true } });
    } catch (error) {
      if (error.status === 409 && /email/i.test(error.message)) {
        setTouched((current) => ({ ...current, email: true }));
        setServerError('Email này đã có tài khoản. Đăng nhập hoặc dùng chức năng quên mật khẩu.');
        document.getElementById('register-email')?.focus();
      } else {
        setServerError(error.message || 'Chưa thể tạo tài khoản. Kiểm tra kết nối rồi thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      mode="register"
      eyebrow={isOwner ? 'BeautyBook Business' : 'Bắt đầu cùng BeautyBook'}
      title={isOwner ? 'Tạo tài khoản chủ doanh nghiệp' : 'Tạo tài khoản khách hàng'}
      description={isOwner
        ? 'Chỉ cần thông tin tài khoản trước. Sau đó bạn có thể hoàn thiện hồ sơ cơ sở theo từng bước.'
        : 'Tạo tài khoản cá nhân để đặt lịch và quản lý các cuộc hẹn của bạn.'}
    >
      <form className="bb-auth-form bb-auth-form--register" onSubmit={submit} noValidate>
        <section className="bb-auth-account-type" aria-label="Loại tài khoản">
          <div>
            <div className="is-selected">
              <span aria-hidden="true">{isOwner ? <Store size={20} /> : <UserRound size={20} />}</span>
              <strong>{isOwner ? 'Chủ doanh nghiệp' : 'Khách hàng'}</strong>
              <small>{isOwner ? 'Đăng ký cơ sở để chờ xét duyệt' : 'Tìm cơ sở và quản lý lịch hẹn'}</small>
            </div>
          </div>
          {isOwner ? <p>Cơ sở chưa được công khai cho đến khi hồ sơ và giấy tờ được duyệt.</p> : null}
        </section>
        <AuthField id="register-fullName" label="Họ và tên" required error={errorFor('fullName')}>
          <AuthInput autoComplete="name" maxLength={100} value={form.fullName} onChange={update('fullName')} onBlur={blur('fullName')} />
        </AuthField>
        <AuthField id="register-email" label="Địa chỉ email" required error={errorFor('email')}>
          <AuthInput type="email" inputMode="email" autoComplete="email" maxLength={254} value={form.email} onChange={update('email')} onBlur={blur('email')} />
        </AuthField>
        <AuthField id="register-phone" label="Số điện thoại" hint="Không bắt buộc · ví dụ 0912 345 678" error={errorFor('phone')}>
          <AuthInput type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={update('phone')} onBlur={blur('phone')} />
        </AuthField>
        <AuthField id="register-password" label="Mật khẩu" required error={errorFor('password')} hint="Ít nhất 8 ký tự, có chữ hoa, chữ thường và số.">
          <PasswordControl label="mật khẩu" autoComplete="new-password" maxLength={128} value={form.password} onChange={update('password')} onBlur={blur('password')} />
        </AuthField>
        <div className="bb-auth-strength" data-score={strength.score} aria-live="polite">
          <div aria-hidden="true">{[1, 2, 3, 4].map((step) => <span key={step} className={strength.score >= step ? 'is-filled' : ''} />)}</div>
          <p>Độ mạnh mật khẩu: <strong>{strength.label}</strong></p>
        </div>
        <AuthField id="register-confirmPassword" label="Nhập lại mật khẩu" required error={errorFor('confirmPassword')}>
          <PasswordControl label="mật khẩu nhập lại" autoComplete="new-password" maxLength={128} value={form.confirmPassword} onChange={update('confirmPassword')} onBlur={blur('confirmPassword')} />
        </AuthField>
        <div className={`bb-auth-consent ${errorFor('terms') ? 'has-error' : ''}`}>
          <input id="register-terms" type="checkbox" checked={form.terms} onChange={update('terms')} onBlur={blur('terms')} aria-invalid={Boolean(errorFor('terms'))} aria-describedby={errorFor('terms') ? 'register-terms-error' : undefined} />
          <label htmlFor="register-terms"><span aria-hidden="true"><Check size={14} /></span>Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật của BeautyBook.</label>
          {errorFor('terms') ? <p id="register-terms-error" role="alert">{errorFor('terms')}</p> : null}
        </div>
        {serverError ? <div className="bb-auth-alert" role="alert">{serverError}</div> : null}
        <button className="bb-auth-submit" type="submit" disabled={loading} aria-busy={loading}>
          <span>{loading ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}</span><ArrowRight size={17} aria-hidden="true" />
        </button>
      </form>
      <div className="bb-auth-alternate">
        <p>Đã có tài khoản?</p><Link to="/login">Đăng nhập</Link>
        <p>{isOwner ? 'Bạn là khách hàng?' : 'Bạn quản lý cơ sở?'}</p>
        <Link to={isOwner ? '/register' : '/for-business'}>{isOwner ? 'Đăng ký cá nhân' : 'BeautyBook Business'}</Link>
      </div>
    </AuthShell>
  );
}

export default RegisterScreen;
