class API {
  constructor(baseURL, defaultHeaders = {}) {
    if (!baseURL) {
      throw new Error("API constructor requires a baseURL.");
    }
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders
    };
  }

  _getUrl(path) {
    return `${this.baseURL}${path.startsWith('/') ? path : '/' + path}`;
  }

  async _request(method, path, data = null, headers = {}) {
    const url = this._getUrl(path);
    const config = {
      method: method,
      headers: { ...this.defaultHeaders, ...headers }
    };

    if (data !== null) {
      if (config.headers['Content-Type'] && config.headers['Content-Type'].includes('application/json')) {
        config.body = JSON.stringify(data);
      } else {
        // Allow sending other body types like FormData directly if Content-Type is changed
        config.body = data;
      }
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        let errorData = {};
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          errorData = await response.json().catch(() => ({}));
        } else {
          errorData.message = await response.text().catch(() => response.statusText);
        }

        const errorMessage = errorData.message || response.statusText || `Request failed with status ${response.status}`;
        const error = new Error(`HTTP Error (${response.status}): ${errorMessage}`);
        error.code = response.status;
        error.data = errorData;
        throw error;
      }

      // Check for 204 No Content
      if (response.status === 204 || response.headers.get("content-length") === "0") {
        return null;
      }

      // Try to parse JSON, if it's not JSON, return raw text
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      } else {
        return await response.text();
      }

    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // Network error (e.g., DNS error, no internet, CORS preflight failure)
        const networkError = new Error('Network Error: Could not connect to the API or request was blocked.');
        networkError.originalError = error;
        throw networkError;
      }
      throw error; // Re-throw other errors (e.g., HTTP errors, custom errors)
    }
  }

  get(path, headers = {}) {
    return this._request('GET', path, null, headers);
  }

  post(path, data, headers = {}) {
    return this._request('POST', path, data, headers);
  }

  put(path, data, headers = {}) {
    return this._request('PUT', path, data, headers);
  }

  patch(path, data, headers = {}) {
    return this._request('PATCH', path, data, headers);
  }

  delete(path, headers = {}) {
    // DELETE requests typically don't send a body, but some APIs might accept one.
    // For general purpose, null data is assumed.
    return this._request('DELETE', path, null, headers);
  }
}