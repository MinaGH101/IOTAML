import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ASSISTANT_ERROR_MESSAGE,
  friendlyApiErrorMessage,
  userFriendlyErrorMessage,
  workflowProblemCopy,
} from './errorMessages.ts';

test('network and timeout failures never expose technical English messages', () => {
  assert.equal(
    friendlyApiErrorMessage('REQUEST_TIMEOUT', 0, 'Request timed out'),
    'پاسخ سرور دیر رسید. اتصال اینترنت را بررسی و دوباره تلاش کنید.',
  );
  assert.equal(
    friendlyApiErrorMessage('NETWORK_ERROR', 0, 'Failed to fetch'),
    'ارتباط با سرور برقرار نشد. اینترنت و اتصال سرور را بررسی کنید.',
  );
  assert.equal(ASSISTANT_ERROR_MESSAGE, 'سرعت نت کمه! بعدا دوباره تلاش کنید.');
});

test('unknown technical errors use the caller fallback while Persian messages remain readable', () => {
  assert.equal(userFriendlyErrorMessage(new Error('Unexpected token'), 'فایل قابل خواندن نیست.'), 'فایل قابل خواندن نیست.');
  assert.equal(userFriendlyErrorMessage(new Error('نام پروژه را وارد کنید'), 'خطا'), 'نام پروژه را وارد کنید');
});

test('workflow validation problems provide Persian explanation and action', () => {
  assert.deepEqual(workflowProblemCopy({ type: 'missing_required_setting' }), {
    message: 'یکی از تنظیمات ضروری نود خالی است.',
    action: 'تنظیمات نود را باز کنید و فیلد مشخص‌شده را تکمیل کنید.',
  });
});
