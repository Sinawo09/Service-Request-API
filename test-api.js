const assert = require('node:assert/strict');

const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

async function send(method, route, data, rawBody) {
  const options = { method, headers: {} };
  if (rawBody !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = rawBody;
  } else if (data !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${baseUrl}${route}`, options);
  let body = {};
  try {
    body = await response.json();
  } catch (error) {
    body = {};
  }
  return { status: response.status, contentType: response.headers.get('content-type'), body };
}

function check(description, condition) {
  assert.ok(condition, description);
  console.log(`PASS ${description}`);
}

async function runTests() {
  let createdId;
  const initialList = await send('GET', '/api/requests');
  assert.equal(initialList.status, 200, 'API must be running before tests start');
  const initialCount = initialList.body.count;

  try {
    let result = await send('GET', '/');
    check('GET / serves the frontend page', result.status === 200 && result.contentType.includes('text/html'));

    result = await send('GET', '/styles.css');
    check('GET /styles.css serves the frontend stylesheet', result.status === 200 && result.contentType.includes('text/css'));

    result = await send('GET', '/app.js');
    check('GET /app.js serves the frontend script', result.status === 200 && result.contentType.includes('javascript'));

    result = await send('GET', '/api/health');
    check('GET /api/health returns 200', result.status === 200 && result.body.status === 'ok');

    const requestData = {
      name: 'API Test Request',
      email: 'api-test@example.com',
      service: 'Career guidance',
      description: 'Created by the API smoke test.'
    };
    result = await send('POST', '/api/requests', requestData);
    createdId = result.body.data && result.body.data.id;
    check('POST creates a Pending request with generated fields',
      result.status === 201 && Boolean(createdId) && result.body.data.status === 'Pending'
        && Boolean(result.body.data.createdAt) && Boolean(result.body.data.updatedAt));

    result = await send('GET', `/api/requests/${createdId}`);
    check('GET /api/requests/:id returns that request', result.status === 200 && result.body.data.id === createdId);

    result = await send('PUT', `/api/requests/${createdId}`, {
      ...requestData,
      service: 'CV review',
      description: 'Updated by PUT.'
    });
    check('PUT replaces request details', result.status === 200 && result.body.data.service === 'CV review');

    result = await send('PATCH', `/api/requests/${createdId}`, { status: 'In Progress' });
    check('PATCH changes a valid status', result.status === 200 && result.body.data.status === 'In Progress');

    result = await send('GET', '/api/requests');
    check('GET /api/requests returns the request list', result.status === 200 && result.body.count === initialCount + 1);

    result = await send('POST', '/api/requests', { ...requestData, email: 'not-an-email' });
    check('Invalid email returns 400', result.status === 400 && Boolean(result.body.errors.email));

    result = await send('PUT', `/api/requests/${createdId}`, { name: 'Incomplete' });
    check('PUT with missing required fields returns 400', result.status === 400);

    result = await send('PATCH', `/api/requests/${createdId}`, { status: 'Waiting' });
    check('Invalid status returns 400', result.status === 400);

    const missingId = 'no-such-service-request';
    for (const method of ['GET', 'PUT', 'PATCH', 'DELETE']) {
      const body = method === 'PUT'
        ? requestData
        : method === 'PATCH' ? { status: 'Completed' } : undefined;
      result = await send(method, `/api/requests/${missingId}`, body);
      check(`${method} with a missing ID returns 404`, result.status === 404);
    }

    result = await send('GET', '/unknown-route');
    check('Unknown route returns JSON 404', result.status === 404 && result.body.success === false);

    result = await send('POST', '/api/requests', undefined, '{');
    check('Malformed JSON returns 400', result.status === 400 && result.body.success === false);

    result = await send('DELETE', `/api/requests/${createdId}`);
    check('DELETE removes the created request', result.status === 200 && result.body.id === createdId);
    createdId = undefined;

    result = await send('GET', '/api/requests');
    check('Test data is cleaned up', result.status === 200 && result.body.count === initialCount);
    console.log('All API smoke tests passed.');
  } finally {
    if (createdId) await fetch(`${baseUrl}/api/requests/${createdId}`, { method: 'DELETE' }).catch(() => {});
  }
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});