import test from 'node:test';
import assert from 'node:assert/strict';
import { UsageTracker, MILESTONE_INTERVAL } from '../src/core/licensing/usage-tracker';
import { LicenseManager } from '../src/core/licensing/license-manager';
import { signLicense } from '../scripts/generate-license';

test('UsageTracker 1: Initial Count & Basic Increment', async () => {
  await LicenseManager.resetForTesting();
  await UsageTracker.resetForTesting();
  const initial = await UsageTracker.getExportCount();
  assert.equal(initial, 0);

  const res1 = await UsageTracker.recordExport(false);
  assert.equal(res1.count, 1);
  assert.equal(res1.shouldShowMilestone, false);

  const current = await UsageTracker.getExportCount();
  assert.equal(current, 1);
});

test('UsageTracker 2: Clipboard Action Debounce', async () => {
  await LicenseManager.resetForTesting();
  await UsageTracker.resetForTesting();

  // First copy action
  const res1 = await UsageTracker.recordExport(true);
  assert.equal(res1.count, 1);

  // Immediate second copy action within 2.5s window
  const res2 = await UsageTracker.recordExport(true);
  assert.equal(res2.count, 1, 'Rapid copy click within debounce window must not increment counter');

  const finalCount = await UsageTracker.getExportCount();
  assert.equal(finalCount, 1);
});

test('UsageTracker 3: Milestone Cadence (Multiples of 15)', async () => {
  await LicenseManager.resetForTesting();
  await UsageTracker.resetForTesting();

  // Exports 1 to 14
  for (let i = 1; i < MILESTONE_INTERVAL; i++) {
    const res = await UsageTracker.recordExport(false);
    assert.equal(res.count, i);
    assert.equal(res.shouldShowMilestone, false, `Export ${i} must not trigger milestone`);
  }

  // Export 15 (First milestone!)
  const milestone15 = await UsageTracker.recordExport(false);
  assert.equal(milestone15.count, 15);
  assert.equal(milestone15.shouldShowMilestone, true, 'Export 15 must trigger milestone modal');

  // Dismiss milestone
  await UsageTracker.acknowledgeMilestone(15);

  // Exports 16 to 29
  for (let i = 16; i < 30; i++) {
    const res = await UsageTracker.recordExport(false);
    assert.equal(res.count, i);
    assert.equal(res.shouldShowMilestone, false, `Export ${i} must not trigger milestone`);
  }

  // Export 30 (Second milestone!)
  const milestone30 = await UsageTracker.recordExport(false);
  assert.equal(milestone30.count, 30);
  assert.equal(milestone30.shouldShowMilestone, true, 'Export 30 must trigger milestone modal');
});

test('UsageTracker 4: Pro License Milestone Suppression', async () => {
  await LicenseManager.resetForTesting();
  await UsageTracker.resetForTesting();

  // Activate valid Pro license
  const { licenseKey } = signLicense('supporter.tester@mit.edu', 'pro', 'lifetime');
  const activation = await LicenseManager.activateKey(licenseKey);
  assert.equal(activation.success, true);

  // Fast forward to export 15 under Pro status
  for (let i = 1; i <= 15; i++) {
    const res = await UsageTracker.recordExport(false);
    assert.equal(res.count, i);
    assert.equal(res.shouldShowMilestone, false, 'Pro users must NEVER see milestone modals');
  }

  // Fast forward to export 30
  for (let i = 16; i <= 30; i++) {
    const res = await UsageTracker.recordExport(false);
    assert.equal(res.count, i);
    assert.equal(res.shouldShowMilestone, false, 'Pro users must NEVER see milestone modals at 30');
  }
});
