const { test, expect } = require('@playwright/test');

// 5 sample users - REPLACE with real test accounts before running
const users = [
  { username: 'user1@example.com', password: 'Password1!' },
  { username: 'user2@example.com', password: 'Password2!' },
  { username: 'user3@example.com', password: 'Password3!' },
  { username: 'user4@example.com', password: 'Password4!' },
  { username: 'user5@example.com', password: 'Password5!' },
];

// Replace endpoints if different
const LOGIN_URL = 'https://apptestapik8ns.eoxvantage.com/auth';
const SUBMIT_URL = 'https://apptestapik8ns.eoxvantage.com/gateway/workflow/parent-tasks';

// Minimal marketing payload - adjust fields to match API contract
function marketingPayload(userIndex) {
  return {
    name: `Marketing Submit ${userIndex + 1}`,
    entity_name: 'marketing',
    assignedto: '4eb844a3-ec11-4b3f-ab44-f8c099e73d30',
    status: 'Open',
    start_date: new Date().toISOString(),
    end_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    appId: '454a1ec4-eeab-4dc2-8a3f-6a4255ffaee1',
    submit: true,
  };
}

// Single test that runs 5 users concurrently
test('Performance: 5 concurrent users submit marketing', async ({ request }) => {
  const results = await Promise.all(
    users.map(async (u, i) => {
      // create an independent API context per virtual user
      const ctx = await request.newContext();

      // 1) login
      const loginRes = await ctx.post(LOGIN_URL, {
        form: { username: u.username, password: u.password },
      });

      let loginBody;
      try {
        loginBody = await loginRes.json();
      } catch (e) {
        loginBody = { raw: await loginRes.text() };
      }

      const token =
        loginBody.token ||
        loginBody.accessToken ||
        loginBody.data?.token ||
        loginBody.data?.jwt ||
        loginBody.jwt;

      if (!token) {
        console.log(`User ${u.username} login failed. status=${loginRes.status()} body=`, loginBody);
        return { user: u.username, ok: false, stage: 'login', status: loginRes.status(), body: loginBody };
      }

      // 2) submit marketing payload
      const payload = marketingPayload(i);
      const submitRes = await ctx.post(SUBMIT_URL, {
        data: payload,
        headers: {
          Authorization: `Bearer ${token}`,
          Cookie: `Authorization=${token}`,
          'Content-Type': 'application/json',
        },
      });

      const submitBody = await submitRes.text();
      console.log(`User ${u.username} submit status=${submitRes.status()} body=${submitBody}`);

      return { user: u.username, ok: submitRes.ok(), stage: 'submit', status: submitRes.status(), body: submitBody };
    })
  );

  // print a quick summary
  console.log('--- Summary ---');
  results.forEach(r => console.log(r));

  // fail the test if any user submission failed
  for (const r of results) {
    expect(r.ok, `User ${r.user} failed at ${r.stage} (status ${r.status})`).toBeTruthy();
  }
});
