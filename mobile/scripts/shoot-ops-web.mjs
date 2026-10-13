// Visual check helper for the Staff / Owner shells on the Expo web build (not native evidence).
// Usage: QA_EMAIL=… QA_PASSWORD=… node scripts/shoot-ops-web.mjs <outDir> <staff|owner> [width]
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.MOBILE_WEB_URL || 'http://localhost:8081';
const outDir = process.argv[2] || 'report-output/berry-bloom-web';
const role = process.argv[3] || 'staff';
const width = Number(process.argv[4] || 390);
const { QA_EMAIL: email, QA_PASSWORD: password } = process.env;
if (!email || !password) throw new Error('QA_EMAIL and QA_PASSWORD are required');

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true }).catch(() => chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' }));
const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

const shot = async (name, wait = 900) => { await page.waitForTimeout(wait); await page.screenshot({ path: path.join(outDir, `${role}-${name}-${width}.png`) }); console.log(`saved ${role}-${name}-${width}.png`); };
const tab = async (label) => { await page.getByRole('tab', { name: label, exact: true }).click(); await page.waitForTimeout(900); };
const scrollMain = async (y) => page.evaluate((top) => {
  let node = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  while (node && node !== document.body) {
    if (node.scrollHeight > node.clientHeight + 40 && /(auto|scroll)/.test(getComputedStyle(node).overflowY)) { node.scrollTop = top; return; }
    node = node.parentElement;
  }
}, y);
const clickIf = async (locator) => { if (await locator.count() && await locator.first().isVisible()) { await locator.first().click(); return true; } return false; };

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByText('BeautyBook').first().waitFor({ timeout: 90000 });
  await tab('Tài khoản');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).last().click();
  await page.waitForTimeout(2500);
  // Server-directed challenges only: workspace and/or business selection.
  if (await clickIf(page.getByRole('button', { name: /Không gian vận hành/ }))) {
    await shot('login-workspace', 300);
    await page.getByRole('button', { name: /Tiếp tục đăng nhập|Đăng nhập/ }).last().click();
    await page.waitForTimeout(2500);
  }
  const business = page.getByRole('radio');
  if (await business.count()) {
    await business.first().click(); await shot('login-business', 300);
    await page.getByRole('button', { name: /Tiếp tục đăng nhập|Đăng nhập/ }).last().click();
    await page.waitForTimeout(3000);
  }

  if (role === 'staff') {
    await page.getByRole('tab', { name: 'Hôm nay', exact: true }).waitFor({ timeout: 20000 });
    await shot('today', 2500);
    await scrollMain(500); await shot('today-low'); await scrollMain(0);
    if (await clickIf(page.getByRole('button', { name: /^Xem công việc|Xem chi tiết công việc$/ }))) { await shot('work-detail', 1800); await scrollMain(420); await shot('work-detail-low'); await page.goBack(); await page.waitForTimeout(800); }
    await tab('Lịch'); await shot('agenda', 2200);
    await tab('Thông báo'); await shot('notifications', 1500);
    await tab('Tài khoản'); await shot('account', 1500);
  } else {
    await page.getByRole('tab', { name: 'Tổng quan', exact: true }).waitFor({ timeout: 20000 });
    await shot('overview', 3500);
    await scrollMain(520); await shot('overview-low'); await scrollMain(0);
    await tab('Vận hành'); await shot('operations', 3000);
    await scrollMain(600); await shot('operations-low'); await scrollMain(0);
    if (await clickIf(page.getByRole('button', { name: 'Xét duyệt yêu cầu' }))) { await shot('request', 2200); await scrollMain(600); await shot('request-low'); await page.goBack(); await page.waitForTimeout(900); }
    if (await clickIf(page.getByRole('button', { name: /^Xem lịch / }))) { await shot('booking', 2200); await scrollMain(520); await shot('booking-low'); await page.goBack(); await page.waitForTimeout(900); }
    await tab('Thông báo'); await shot('notifications', 1500);
    await tab('Tài khoản'); await shot('account', 1500);
  }
} catch (error) {
  errors.push(`script: ${error.message}`);
  await page.screenshot({ path: path.join(outDir, `${role}-failure-${width}.png`) }).catch(() => {});
} finally {
  await browser.close();
}
if (errors.length) console.log(JSON.stringify(errors.slice(0, 10), null, 1));
