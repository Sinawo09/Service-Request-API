const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const requestsFile = path.join(__dirname, '..', 'data', 'requests.json');
const validStatuses = ['Pending', 'In Progress', 'Completed'];
const editableFields = ['name', 'email', 'service', 'description'];

function makeError(message, statusCode, errors) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (errors) error.errors = errors;
  return error;
}

function readRequests() {
  if (!fs.existsSync(requestsFile)) {
    const exampleFile = path.join(__dirname, '..', 'data', 'requests.example.json');
    fs.copyFileSync(exampleFile, requestsFile);
  }

  const contents = fs.readFileSync(requestsFile, 'utf8');
  const requests = JSON.parse(contents);
  if (!Array.isArray(requests)) {
    throw new Error('The requests data file must contain a JSON array.');
  }
  return requests;
}

function writeRequests(requests) {
  fs.writeFileSync(requestsFile, `${JSON.stringify(requests, null, 2)}\n`, 'utf8');
}

function getRequestIndex(requests, id) {
  return requests.findIndex((request) => request.id === id);
}

function validateRequestBody(body, { partial = false, allowStatus = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw makeError('Send a JSON object in the request body.', 400);
  }

  const allowedFields = allowStatus ? [...editableFields, 'status'] : editableFields;
  const errors = {};
  const submittedFields = Object.keys(body);

  for (const field of submittedFields) {
    if (!allowedFields.includes(field)) {
      errors[field] = 'This field cannot be changed.';
    }
  }

  if (partial && submittedFields.length === 0) {
    errors.body = 'Provide at least one field to update.';
  }

  const values = {};
  for (const field of editableFields) {
    if (partial && !Object.hasOwn(body, field)) continue;

    const value = body[field];
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors[field] = 'This field is required and must be a non-empty string.';
      continue;
    }

    const trimmedValue = value.trim();
    const maximumLength = field === 'description' ? 2000 : 120;
    if (trimmedValue.length > maximumLength) {
      errors[field] = `This field must be ${maximumLength} characters or fewer.`;
      continue;
    }
    values[field] = trimmedValue;
  }

  if (Object.hasOwn(body, 'email') && typeof body.email === 'string') {
    const email = body.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Enter a valid email address.';
    }
  }

  if (Object.hasOwn(body, 'status')) {
    if (!allowStatus) {
      errors.status = 'Status can be changed with PATCH.';
    } else if (!validStatuses.includes(body.status)) {
      errors.status = `Status must be one of: ${validStatuses.join(', ')}.`;
    } else {
      values.status = body.status;
    }
  }

  if (Object.keys(errors).length > 0) {
    throw makeError('Please correct the submitted fields.', 400, errors);
  }

  return values;
}

function getAllRequests(req, res, next) {
  try {
    const requests = readRequests();
    res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    next(error);
  }
}

function getRequestById(req, res, next) {
  try {
    const requests = readRequests();
    const request = requests.find((item) => item.id === req.params.id);
    if (!request) throw makeError('Service request not found.', 404);
    res.status(200).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
}

function createRequest(req, res, next) {
  try {
    const values = validateRequestBody(req.body);
    const now = new Date().toISOString();
    const request = {
      id: randomUUID(),
      ...values,
      status: 'Pending',
      createdAt: now,
      updatedAt: now
    };
    const requests = readRequests();
    requests.push(request);
    writeRequests(requests);
    res.status(201).json({ success: true, message: 'Service request created.', data: request });
  } catch (error) {
    next(error);
  }
}

function replaceRequest(req, res, next) {
  try {
    const requests = readRequests();
    const index = getRequestIndex(requests, req.params.id);
    if (index === -1) throw makeError('Service request not found.', 404);

    const values = validateRequestBody(req.body, { allowStatus: true });
    const current = requests[index];
    requests[index] = {
      ...current,
      ...values,
      status: values.status || current.status,
      updatedAt: new Date().toISOString()
    };
    writeRequests(requests);
    res.status(200).json({ success: true, message: 'Service request replaced.', data: requests[index] });
  } catch (error) {
    next(error);
  }
}

function updateRequest(req, res, next) {
  try {
    const requests = readRequests();
    const index = getRequestIndex(requests, req.params.id);
    if (index === -1) throw makeError('Service request not found.', 404);

    const values = validateRequestBody(req.body, { partial: true, allowStatus: true });
    requests[index] = {
      ...requests[index],
      ...values,
      updatedAt: new Date().toISOString()
    };
    writeRequests(requests);
    res.status(200).json({ success: true, message: 'Service request updated.', data: requests[index] });
  } catch (error) {
    next(error);
  }
}

function deleteRequest(req, res, next) {
  try {
    const requests = readRequests();
    const index = getRequestIndex(requests, req.params.id);
    if (index === -1) throw makeError('Service request not found.', 404);
    requests.splice(index, 1);
    writeRequests(requests);
    res.status(200).json({ success: true, message: 'Service request deleted.', id: req.params.id });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllRequests,
  getRequestById,
  createRequest,
  replaceRequest,
  updateRequest,
  deleteRequest
};