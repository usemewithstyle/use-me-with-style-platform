import { expect, test } from '@playwright/test';
import { t } from '../src/theme';
import { mockCheckoutBackend, seedCheckout } from './helpers/mockCheckout';

test('Express countdown waits for submission and retry waits for a verified failure', async ({ page }) => {
  await mockCheckoutBackend(page);
  await seedCheckout(page, { market: 'AO', lang: 'en' });
  await page.clock.install();

  // Keep both the widget and the gateway entirely local to the test.
  await page.route('**/src/config/env.ts', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: (await response.text()) + `
        Object.assign(publicEnv, {
          appyPayApiKey: 'test', appyPayClientId: 'test', appyPayMerchantName: 'Test shop',
          appyPayWidgetSrc: '/mock-appy-pay.js',
        });
      `,
    });
  });
  await page.route('**/mock-appy-pay.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `(() => {
      const widget = document.getElementById('appyPay-charges-v2');
      widget.innerHTML = '<label>Express number <input type="tel"></label><button>Continue</button>';
      widget.querySelector('button').onclick = () => {
        widget.innerHTML = '<div class="progress-page"><p class="waiting-text">Waiting for Multicaixa Express</p></div>';
      };
    })();`,
  }));

  const operations: string[] = [];
  let attempts = 0;
  let failed = false;
  let paid = false;
  let lookupAvailable = false;
  await page.route('**/api/payments/appypay/create-order', (route) => {
    attempts += 1;
    operations.push(`create ${attempts}`);
    return route.fulfill({ json: {
      orderNumber: `AO-TEST${attempts}`,
      merchantTransactionId: `test${attempts}`,
      cancellationToken: 'test',
      reservationExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    } });
  });
  await page.route('**/api/payments/appypay/status', (route) => {
    const merchantId = route.request().postDataJSON().merchantTransactionId;
    const firstAttempt = merchantId === 'test1';
    const isFailed = failed && firstAttempt;
    const isPaid = paid && merchantId === 'test2';
    return route.fulfill({ json: {
      orderNumber: 'AO-TEST1',
      status: isPaid ? 'confirmed' : isFailed ? 'payment_review' : 'new',
      paymentStatus: isPaid ? 'paid' : isFailed ? 'failed' : 'pending',
      appyPayStatus: isFailed ? 'Failed' : null,
    } });
  });
  await page.route('**/api/payments/appypay/retry-order', (route) => {
    const merchantId = route.request().postDataJSON().merchantTransactionId;
    operations.push(`retry ${merchantId}`);
    return route.fulfill({ json: {
      orderNumber: merchantId === 'lookup0' ? 'AO-LOOKUP' : 'AO-TEST1',
      merchantTransactionId: merchantId === 'lookup0' ? 'lookup1' : 'test2',
      cancellationToken: 'test',
      amount: 13_500,
      reservationExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    } });
  });

  await page.route('**/api/order-lookup', (route) => route.fulfill({ json: { order: lookupAvailable ? {
    orderNumber: 'AO-LOOKUP',
    status: 'payment_review',
    paymentStatus: 'failed',
    total: 13_500,
    currency: 'Kz',
    paymentRetry: { merchantTransactionId: 'lookup0', cancellationToken: 'test' },
  } : null } }));
  await page.goto('/checkout');
  await page.getByLabel(t('municipality', 'en')).selectOption('Talatona');
  await page.getByLabel(t('firstName', 'en')).fill('Test');
  await page.getByLabel(t('lastName', 'en')).fill('Customer');
  await page.getByLabel(t('email', 'en')).fill('test@example.com');
  await page.getByLabel(t('phoneWhatsapp', 'en')).fill('923000000');
  await page.getByLabel(t('streetName', 'en')).fill('Test street');
  await page.getByLabel(t('houseNumberOther', 'en')).fill('1');
  await page.getByRole('button', { name: new RegExp(t('payNow', 'en'), 'i') }).click();

  const modal = page.getByRole('dialog', { name: 'Complete with AppyPay' });
  const widget = modal.frameLocator('iframe');
  await expect(widget.getByLabel('Express number')).toBeVisible();
  await page.reload();
  await expect(modal.getByText('#AO-TEST1')).toBeVisible();
  await expect(page.getByLabel(t('email', 'en'))).toHaveValue('test@example.com');
  await expect(page.getByLabel(t('municipality', 'en'))).toHaveValue('Talatona');
  expect(operations).toEqual(['create 1']);

  await widget.getByLabel('Express number').fill('923000000');
  await expect(modal.getByRole('timer')).toHaveCount(0);
  await widget.getByRole('button', { name: 'Continue' }).click();
  await expect(modal.getByRole('timer')).toContainText('1:00');

  await page.clock.fastForward(61_000);
  await expect(modal.getByRole('timer')).toContainText('0:00');
  await expect(modal.getByRole('status')).toContainText('Checking the payment status');
  await expect(modal.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  expect(operations).toEqual(['create 1']);

  failed = true;
  await expect(modal.getByRole('button', { name: 'Try again' })).toBeEnabled();
  await modal.getByRole('button', { name: 'Try again' }).click();
  await expect(modal.getByText('#AO-TEST1')).toBeVisible();
  await expect(widget.getByLabel('Express number')).toBeVisible();
  await expect(modal.getByRole('timer')).toHaveCount(0);
  expect(operations).toEqual(['create 1', 'retry test1']);

  await widget.getByRole('button', { name: 'Continue' }).click();
  await expect(modal.getByRole('timer')).toContainText('1:00');
  await page.clock.fastForward(61_000);
  await expect(modal.getByRole('timer')).toContainText('0:00');
  await page.reload();
  await expect(modal.getByRole('status')).toContainText('Checking the payment status');
  await expect(modal.locator('iframe')).toHaveCount(0);
  await expect(modal.getByRole('timer')).toContainText('0:00');
  paid = true;
  await expect(page).toHaveURL(/encomenda-confirmada\/AO-TEST1/);
  expect(await page.evaluate(() => sessionStorage.getItem('ump-appypay-checkout'))).toBeNull();
  expect(operations).toEqual(['create 1', 'retry test1']);

  lookupAvailable = true;
  await page.goto('/conta');
  await page.getByLabel(t('orderNumber', 'en')).fill('AO-LOOKUP');
  await page.getByLabel(t('email', 'en')).fill('test@example.com');
  await page.locator('form button[type="submit"]').click();
  await page.getByRole('button', { name: 'Try payment again' }).click();
  await expect(modal.getByText('#AO-LOOKUP')).toBeVisible();
  await expect(widget.getByLabel('Express number')).toBeVisible();
  expect(operations).toEqual(['create 1', 'retry test1', 'retry lookup0']);

});
