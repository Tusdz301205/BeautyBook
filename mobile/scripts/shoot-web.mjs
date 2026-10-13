// Visual check helper for the Expo web build of the mobile app (not native evidence).
// Usage: node scripts/shoot-web.mjs <outDir> [width] [scenario,...]
// Scenarios navigate through real UI controls; nothing is mocked here.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.MOBILE_WEB_URL || 'http://localhost:8081';
const outDir = process.argv[2] || 'report-output/berry-bloom-web';
const width = Number(process.argv[3] || 390);
const only = (process.argv[4] || '').split(',').filter(Boolean);
const email = process.env.QA_EMAIL;
const password = process.env.QA_PASSWORD;

await mkdir(outDir, { recursive: true });
const launch = async () => {
  try { return await chromium.launch({ headless: true }); }
  catch { return chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' }); }
};
const browser = await launch();
const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text().slice(0, 200)}`); });

const shot = async (name, options = {}) => {
  await page.waitForTimeout(options.wait ?? 700);
  await page.screenshot({ path: path.join(outDir, `${name}-${width}.png`), fullPage: Boolean(options.full) });
  console.log(`saved ${name}-${width}.png`);
};
const want = (name) => !only.length || only.includes(name);
const tab = async (label) => { await page.getByRole('tab', { name: label, exact: true }).click(); await page.waitForTimeout(600); };
// Scroll the scroller that is actually on screen (React Navigation keeps hidden screens mounted).
const scrollMain = async (y) => page.evaluate((top) => {
  let node = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    if (node.scrollHeight > node.clientHeight + 40 && /(auto|scroll)/.test(style.overflowY)) { node.scrollTop = top; return; }
    node = node.parentElement;
  }
}, y);

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByText('BeautyBook').first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(2500);

  if (email && password && want('login')) {
    await tab('Tài khoản'); await shot('account-guest');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await shot('login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).last().click();
    await page.waitForTimeout(4000); await shot('account');
    await tab('Khám phá'); await page.waitForTimeout(1500);
  }
  if (want('home')) {
    await shot('home-top');
    await scrollMain(520); await shot('home-mid');
    await scrollMain(1150); await shot('home-low');
    await scrollMain(0);
  }
  if (want('search')) {
    await tab('Tìm kiếm'); await page.waitForTimeout(1200); await shot('search');
    const filter = page.getByRole('button', { name: /Bộ lọc/ }).first();
    if (await filter.count()) { await filter.click(); await shot('search-filter'); await page.getByRole('button', { name: 'Xem kết quả' }).click(); }
  }
  if (want('venue')) {
    await tab('Khám phá');
    const venue = page.getByRole('button', { name: /Xem cơ sở$/ }).first();
    if (await venue.count()) {
      await venue.click(); await page.waitForTimeout(1800); await shot('venue-top');
      const info = page.getByRole('tab', { name: 'Thông tin', exact: true });
      if (await info.count()) { await info.click(); await shot('venue-info'); await scrollMain(520); await shot('venue-info-low'); await scrollMain(0); }
      const reviews = page.getByRole('tab', { name: 'Đánh giá', exact: true });
      if (await reviews.count()) { await reviews.click(); await scrollMain(380); await shot('venue-reviews'); await scrollMain(0); }
      await page.getByRole('tab', { name: 'Dịch vụ', exact: true }).click();
      const service = page.getByRole('checkbox').first();
      if (await service.count()) { await service.click(); await scrollMain(300); await shot('venue-selected'); }
      if (want('booking')) {
        const go = page.getByRole('button', { name: 'Tiếp tục đặt lịch' });
        if (await go.count()) {
          await go.click(); await page.waitForTimeout(3000); await shot('booking-top');
          await scrollMain(520); await shot('booking-mid');
          // Today may have no slots left: move to next week and pick a weekday.
          await page.getByRole('button', { name: 'Tuần sau' }).click();
          await page.getByRole('button', { name: /^T4, ngày/ }).click();
          await page.waitForTimeout(2200); await scrollMain(700); await shot('booking-slots');
          const slot = page.getByRole('radio', { name: /còn trống$/ }).first();
          if (await slot.count()) { await slot.click(); await page.waitForTimeout(2200); await shot('booking-slot-selected'); }
          await scrollMain(1500); await shot('booking-low');
          const review = page.getByRole('button', { name: 'Xem lại đặt lịch' });
          let booked = false;
          if (await review.count() && await review.isEnabled()) {
            await review.click(); await shot('booking-review');
            if (process.env.QA_BOOK === '1') {
              // Real booking against the local QA database (never a shared environment).
              await page.getByRole('button', { name: 'Xác nhận gửi đặt lịch' }).click();
              await page.getByText(/Đã gửi yêu cầu đặt lịch|Lịch hẹn đã được xác nhận|Lịch hẹn đã được ghi nhận/).first().waitFor({ timeout: 20000 });
              await shot('booking-success'); booked = true;
              await page.getByRole('button', { name: 'Về trang khám phá' }).click();
            } else {
              await page.getByRole('button', { name: 'Đóng xem lại đặt lịch' }).last().click();
            }
          }
          if (!booked) await page.getByRole('button', { name: 'Quay lại' }).first().click();
        }
      }
      const back = page.getByRole('button', { name: 'Quay lại' }).first();
      if (await back.count() && await back.isVisible()) await back.click();
    }
  }
  if (want('appointments')) {
    await tab('Lịch hẹn'); await page.waitForTimeout(1500); await shot('appointments');
    await scrollMain(420); await shot('appointments-list'); await scrollMain(0);
    const history = page.getByRole('tab', { name: 'Lịch sử', exact: true });
    if (await history.count()) { await history.click(); await shot('appointments-history'); await page.getByRole('tab', { name: 'Sắp tới', exact: true }).click(); }
    const detail = page.getByRole('button', { name: 'Chi tiết', exact: true }).first();
    if (await detail.count()) { await detail.click(); await page.waitForTimeout(1200); await shot('appointment-detail'); await scrollMain(520); await shot('appointment-detail-low'); await page.getByRole('button', { name: 'Quay lại' }).first().click(); }
    const calendar = page.getByRole('button', { name: 'Xem lịch hẹn theo tháng' });
    if (await calendar.count()) { await calendar.click(); await shot('appointments-calendar'); await page.getByRole('button', { name: 'Quay lại' }).first().click(); }
  }
  if (want('account')) {
    await tab('Tài khoản'); await shot('account');
    for (const [label, name] of [['Đã lưu', 'favorites'], ['Thông báo', 'notifications']]) {
      const tile = page.getByRole('button', { name: new RegExp(`^${label}`) }).first();
      if (await tile.count()) { await tile.click(); await page.waitForTimeout(1200); await shot(name); await page.getByRole('button', { name: 'Quay lại' }).first().click(); }
    }
    const support = page.getByRole('button', { name: /Hỗ trợ/ }).first();
    if (await support.count()) { await support.click(); await shot('support'); await page.getByRole('button', { name: 'Quay lại' }).first().click(); }
  }
} catch (error) {
  errors.push(`script: ${error.message}`);
  await page.screenshot({ path: path.join(outDir, `failure-${width}.png`) }).catch(() => {});
} finally {
  await browser.close();
}
if (errors.length) console.log(JSON.stringify(errors.slice(0, 12), null, 1));
