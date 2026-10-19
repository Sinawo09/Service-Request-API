const API_URL = new URLSearchParams(window.location.search).get('api')
  || 'http://localhost:3000/api/requests';
document.querySelector('.api-link').href = API_URL.replace(/\/requests\/?$/, '/health');
document.querySelector('#api-port').textContent = `Local learning project · API on port ${new URL(API_URL).port}`;
const form = document.querySelector('#request-form');
const requestList = document.querySelector('#request-list');
const notice = document.querySelector('#notice');
const countLabel = document.querySelector('#request-count');
const submitButton = document.querySelector('#submit-button');
const cancelEditButton = document.querySelector('#cancel-edit');
const refreshButton = document.querySelector('#refresh-button');

let editingId = null;
let requests = [];

function showNotice(message, kind = 'success') {
  notice.textContent = message;
  notice.dataset.kind = kind;
  notice.hidden = false;
}

function clearNotice() {
  notice.hidden = true;
  notice.textContent = '';
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON from ${url}, but received ${contentType || 'an unknown content type'}. Check that the API URL points to the service request API.`);
  }
  const result = await response.json();
  if (!response.ok) {
    const fieldErrors = result.errors ? ` ${Object.values(result.errors).join(' ')}` : '';
    throw new Error(`${result.message || 'The request failed.'}${fieldErrors}`);
  }
  return result;
}

function makeButton(label, className, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function renderRequests() {
  requestList.replaceChildren();
  countLabel.textContent = requests.length;

  if (requests.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'There are no requests yet. Your new requests will appear here.';
    requestList.append(emptyState);
    return;
  }

  for (const request of requests) {
    const item = document.createElement('article');
    item.className = 'request-item';

    const topline = document.createElement('div');
    topline.className = 'request-topline';
    const identity = document.createElement('div');
    const name = document.createElement('h3');
    name.className = 'request-name';
    name.textContent = request.name;
    const service = document.createElement('p');
    service.className = 'request-service';
    service.textContent = request.service;
    identity.append(name, service);

    const status = document.createElement('span');
    status.className = 'status-pill';
    status.dataset.status = request.status;
    status.textContent = request.status;
    topline.append(identity, status);

    const description = document.createElement('p');
    description.className = 'request-description';
    description.textContent = request.description;
    const meta = document.createElement('p');
    meta.className = 'request-meta';
    meta.textContent = `${request.email} · Created ${new Date(request.createdAt).toLocaleDateString()}`;

    const controls = document.createElement('div');
    controls.className = 'request-controls';
    const statusSelect = document.createElement('select');
    statusSelect.setAttribute('aria-label', `Change status for ${request.name}`);
    for (const optionText of ['Pending', 'In Progress', 'Completed']) {
      const option = document.createElement('option');
      option.value = optionText;
      option.textContent = optionText;
      option.selected = optionText === request.status;
      statusSelect.append(option);
    }
    const updateStatus = makeButton('Save status', 'small-button', () => changeStatus(request.id, statusSelect.value));
    const edit = makeButton('Edit', 'small-button', () => startEditing(request));
    const remove = makeButton('Delete', 'small-button delete-button', () => deleteRequest(request.id));
    controls.append(statusSelect, updateStatus, edit, remove);

    item.append(topline, description, meta, controls);
    requestList.append(item);
  }
}

async function loadRequests() {
  requestList.replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'loading-state';
  loading.textContent = 'Loading requests...';
  requestList.append(loading);
  refreshButton.disabled = true;

  try {
    const result = await apiRequest(API_URL);
    requests = result.data;
    renderRequests();
  } catch (error) {
    requestList.replaceChildren();
    const errorState = document.createElement('p');
    errorState.className = 'empty-state';
    errorState.textContent = `Could not load requests from ${API_URL}. Check that the API is running and the API URL is correct.`;
    requestList.append(errorState);
    showNotice(error.message, 'error');
  } finally {
    refreshButton.disabled = false;
  }
}

function formValues() {
  return Object.fromEntries(new FormData(form).entries());
}

function resetForm() {
  form.reset();
  editingId = null;
  submitButton.innerHTML = 'Send request <span aria-hidden="true">&#8594;</span>';
  cancelEditButton.hidden = true;
  document.querySelector('#form-title').textContent = 'Make a request';
}

function startEditing(request) {
  editingId = request.id;
  for (const field of ['name', 'email', 'service', 'description']) {
    form.elements[field].value = request[field];
  }
  submitButton.textContent = 'Update request';
  cancelEditButton.hidden = false;
  document.querySelector('#form-title').textContent = 'Edit request';
  document.querySelector('#name').focus();
  clearNotice();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearNotice();
  submitButton.disabled = true;
  const isEditing = Boolean(editingId);
  const url = isEditing ? `${API_URL}/${encodeURIComponent(editingId)}` : API_URL;

  try {
    const result = await apiRequest(url, {
      method: isEditing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues())
    });
    showNotice(result.message, 'success');
    resetForm();
    await loadRequests();
  } catch (error) {
    showNotice(error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

async function changeStatus(id, status) {
  clearNotice();
  try {
    const result = await apiRequest(`${API_URL}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    showNotice(result.message, 'success');
    await loadRequests();
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

async function deleteRequest(id) {
  if (!window.confirm('Delete this service request? This cannot be undone.')) return;
  clearNotice();
  try {
    const result = await apiRequest(`${API_URL}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (editingId === id) resetForm();
    showNotice(result.message, 'success');
    await loadRequests();
  } catch (error) {
    showNotice(error.message, 'error');
  }
}

cancelEditButton.addEventListener('click', resetForm);
refreshButton.addEventListener('click', loadRequests);
loadRequests();