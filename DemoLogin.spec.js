// DemoLogin.spec.js
const { test, expect, request } = require('@playwright/test');

let token;

test.describe('Login API', () => {
  test.beforeAll(async ({ request }) => {
    // Step 1: Login and get auth token
    const loginResponse = await request.post(
      'https://apptestapik8ns.eoxvantage.com/auth',
      {
        form: {
          username: 'tejar',
          password: 'Teja@1234',
        },
      }
    );

    // Log status and body so we can debug missing token issues
    console.log('Login status:', loginResponse.status());
    let loginBody;
    try {
      loginBody = await loginResponse.json();
    } catch (e) {
      // If JSON parse fails, capture raw text for inspection
      const raw = await loginResponse.text();
      console.log('Login response (raw):', raw);
      throw new Error('Login response is not valid JSON');
    }
    console.log('Login Response:', loginBody);

    token =
      loginBody.token ||
      loginBody.accessToken ||
      loginBody.data?.token ||
      loginBody.data?.jwt ||
      loginBody.jwt;
    if (!token) {
      throw new Error('Login failed: token not found in response');
    }
  });

  test('Submit Marketing Request App', async ({ request }) => {
    // Step 2: Submit Marketing app using the token
    const payload = {
    "additionalDescription": "Sample text : Eligendi tersus quos virgo verecundia.",
    "assignedToName": "",
    "assigned_team": "Marketing Team",
    "assignedto": "",
    "assignedtoObj": {},
    "attachdocs": [],
    "contactEmail": "Reginald.Harber93@yahoo.com",
    "contactPerson": {
        "uuid": "3f90c4d8-13dc-442b-9b86-ab4be069f795",
        "username": "Adminpreethiuser",
        "name": "Admin User",
        "icon": null,
        "timezone": "Asia/Kolkata",
        "preferences": null,
        "status": "Active",
        "accountId": "b0923de7-0387-48ea-8f29-5d3704d96a46",
        "firstname": "Admin",
        "lastname": "User",
        "email": "migniyol45@yevme.com",
        "date_of_birth": "2019-11-26",
        "phone": null,
        "gender": "Female",
        "designation": "QA",
        "website": null,
        "about": null,
        "employee_id": 1931,
        "date_of_join": "2019-11-26",
        "interest": null,
        "address1": " ",
        "address2": null,
        "city": " ",
        "state": " ",
        "country": "India",
        "zip": " ",
        "managerId": "7632a098-0196-498b-8cb5-360e69ac89cf",
        "manager_name": "Govind Raj"
    },
    "contactPersonEmail": "migniyolma@yevme.com",
    "contactPersonName": "Admin User",
    "contactPersonUuid": "3f90c4d8-13dc-442b-9b86-ab4be069f795",
    "dateDue": "2025-11-03T11:10:32.000Z",
    "department": "Finance",
    "instance": "https://apptestapik8ns.eoxvantage.com/",
    "intendedAudience": "",
    "itemProjectRequested": "Test Item Project",
    "name": "Client Test Name",
    "owner": "Teja R",
    "ownerEmailId": "tejaramesh@eoxvantage.in",
    "ownerusername": "tejar",
    "printQty": 10,
    "status": "Open",
    "type1": "New Project",
    "useScenario": "Sample text : Desolo aspernatur adulescens doloribus vulgo claro pauci.",
    "commands": [
        {
            "command": "fileSave",
            "entity_name": "marketingRequest"
        },
        {
            "command": "workflow",
            "delegate": "mrNotif",
            "entity_name": "marketingRequest"
        }
    ],
    "is_draft": false
}

    const response = await request.post(
      'https://apptestapik8ns.eoxvantage.com/app/49b2ee09-1bd2-4128-b926-51aa4ae414c8/pipeline',
      {
        data: payload,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

  // Log request payload, status and response body for debugging
  console.log('Request payload:', JSON.stringify(payload, null, 2));
  console.log('Status Code:', response.status());
  const bodyText = await response.text();
  console.log('Task Submit Response:', bodyText);
    // Only assert if status is 2xx
    expect(response.ok()).toBeTruthy();
  });

});