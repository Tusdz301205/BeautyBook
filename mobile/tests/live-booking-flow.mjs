import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
await mkdir('report-output/live-web', { recursive: true });
const email = `qa.booking.${Date.now()}@example.invalid`;
const password = `BeautyQA${Date.now()}x`;
const result = { registerStatus: null, quoteStatus: null, bookingStatus: null, bookingReadBack: false, secondSessionReadBack: false, errors: [] };
let page;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await context.newPage();
  page.on('pageerror', (error) => result.errors.push(error.message));
  await page.goto(process.env.MOBILE_WEB_URL || 'http://localhost:8086', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Tài khoản' }).click();
  await page.getByText('Tạo tài khoản', { exact: true }).click();
  await page.getByPlaceholder('Nguyễn Văn A').fill('Khách thử đặt lịch');
  await page.getByPlaceholder('email@example.com').fill(email);
  await page.getByPlaceholder('Tối thiểu 8 ký tự').fill(password);
  await page.getByPlaceholder('Nhập lại mật khẩu').fill(password);
  const register = page.waitForResponse((response) => response.url().endsWith('/auth/register') && response.request().method() === 'POST');
  await page.getByText('TẠO TÀI KHOẢN', { exact: true }).click();
  result.registerStatus = (await register).status();
  if (result.registerStatus >= 400) throw new Error(`Register HTTP ${result.registerStatus}`);
  await page.getByRole('tab', { name: 'Tìm kiếm' }).click();
  await expect(page.getByText(/\d+ dịch vụ trong kết quả/)).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: /^Xem Triệt lông tay\/chân tại / }).first().click();
  await expect(page.getByText('Bấm chọn dịch vụ để đặt lịch')).toBeVisible({ timeout: 20000 });
  await page.getByText('Đặt Lịch', { exact: true }).click();
  const bookingDayCells = await page.getByText('3', { exact: true }).all();
  const bookingDay = await (async () => { for (const cell of bookingDayCells) if (await cell.isVisible()) return cell; })();
  if (!bookingDay) throw new Error('Ngày 3/10 không hiển thị trong bộ chọn ngày');
  await bookingDay.click();
  await expect(page.getByText('Còn trống').first()).toBeVisible({ timeout: 20000 });
  const quote = page.waitForResponse((response) => response.url().endsWith('/bookings/preview-price') && response.request().method() === 'POST', { timeout: 20000 });
  await page.getByText('15:00', { exact: true }).first().click();
  result.quoteStatus = (await quote).status();
  await page.screenshot({ path: 'report-output/live-web/booking-quote-390.png' });
  if (result.quoteStatus >= 400) throw new Error(`Price quote HTTP ${result.quoteStatus}`);
  const button = page.getByText('XEM LẠI ĐẶT LỊCH', { exact: true });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByText('Xem lại đặt lịch', { exact: true })).toBeVisible();
  const reviewBounds = await page.getByText('Xem lại đặt lịch', { exact: true }).boundingBox();
  if (!reviewBounds || reviewBounds.y < 0 || reviewBounds.y + reviewBounds.height > 844) {
    const chain = await page.getByText('Xem lại đặt lịch', { exact: true }).evaluate((node) => {
      const rows = []; let current = node;
      for (let i = 0; i < 7 && current; i += 1, current = current.parentElement) {
        const box = current.getBoundingClientRect(); const style = getComputedStyle(current);
        rows.push({ tag: current.tagName, className: current.className?.toString().slice(0, 100), top: box.top, bottom: box.bottom, height: box.height, position: style.position, display: style.display, flex: style.flex, justifyContent: style.justifyContent });
      }
      return rows;
    });
    throw new Error(`Sheet xem lại nằm ngoài màn hình: ${JSON.stringify(reviewBounds)} ${JSON.stringify(chain)}`);
  }
  await expect(page.getByText('454.000 đ').last()).toBeVisible();
  await page.screenshot({ path: 'report-output/live-web/booking-review-390.png' });
  const booking = page.waitForResponse((response) => response.url().endsWith('/bookings') && response.request().method() === 'POST', { timeout: 20000 });
  await page.getByText('XÁC NHẬN ĐẶT LỊCH', { exact: true }).click();
  const bookingResponse = await booking;
  result.bookingStatus = bookingResponse.status();
  if (result.bookingStatus >= 400) throw new Error(`Booking HTTP ${result.bookingStatus}: ${JSON.stringify(await bookingResponse.json().catch(() => ({})))}`);
  await expect(page.getByText('Đã gửi yêu cầu đặt lịch')).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: 'report-output/live-web/booking-success-390.png' });
  await page.getByText('Xem lịch hẹn của tôi').click();
  await expect(page.getByText('YÊU CẦU CHỜ XÁC NHẬN')).toBeVisible({ timeout: 20000 });
  await expect(page.locator('body')).toContainText('Triệt lông tay/chân');
  result.bookingReadBack = true;
  await page.screenshot({ path: 'report-output/live-web/booking-list-390.png' });

  const secondContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const other = await secondContext.newPage();
  other.on('pageerror', (error) => result.errors.push(error.message));
  await other.goto(process.env.MOBILE_WEB_URL || 'http://localhost:8086', { waitUntil: 'domcontentloaded' });
  await other.getByRole('tab', { name: 'Tài khoản' }).click();
  await other.getByText('Đăng nhập', { exact: true }).click();
  await other.getByPlaceholder('email@example.com').fill(email);
  await other.getByPlaceholder('Nhập mật khẩu').fill(password);
  await other.getByText('ĐĂNG NHẬP', { exact: true }).click();
  await expect(other.locator('body')).toContainText('Khách thử đặt lịch', { timeout: 20000 });
  await other.getByRole('tab', { name: 'Lịch hẹn' }).click();
  await expect(other.getByText('YÊU CẦU CHỜ XÁC NHẬN')).toBeVisible({ timeout: 20000 });
  await expect(other.locator('body')).toContainText('Triệt lông tay/chân');
  result.secondSessionReadBack = true;
  await other.screenshot({ path: 'report-output/live-web/booking-second-session-390.png' });
} catch (error) {
  result.errors.push(error instanceof Error ? error.message : String(error));
  if (page) await page.screenshot({ path: 'report-output/live-web/booking-flow-error-390.png' }).catch(() => {});
} finally {
  await browser.close();
}
console.log(JSON.stringify(result, null, 2));
if (result.errors.length || !result.bookingReadBack || !result.secondSessionReadBack) process.exitCode = 1;
