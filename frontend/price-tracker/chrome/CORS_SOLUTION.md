# CORS/Loopback Restriction Solution

## Problem Statement

Chrome's Manifest V3 prevents content scripts from accessing `localhost` API endpoints due to:
1. **CORS restrictions** - Content scripts cannot make cross-origin requests to localhost
2. **Loopback address restrictions** - Chrome blocks content scripts from accessing `127.0.0.1` and other loopback addresses

This caused all extension API calls to fail with errors like:
```
Access to fetch at 'http://localhost:8080/api/intent/intent' 
from origin 'https://www.google.com' has been blocked by CORS policy
```

## Solution Architecture

The solution uses a **relay pattern** that routes all API calls through the background service worker, which has unrestricted access to localhost:

```
Content Script (CORS blocked) 
    ↓ (chrome.runtime.sendMessage)
Background Service Worker (has localhost access)
    ↓ (fetch)
localhost:8080 API
```

## Implementation Components

### 1. API Relay Service (Content Script)
**File:** `content/transport/api-relay.js`

Provides a `PriceTracker.apiRelay.apiRequest()` interface that:
- Sends `API_REQUEST` messages to the background worker
- Converts the response to a fetch-like Response object
- Handles error communication via chrome.runtime.lastError

```javascript
const response = await PriceTracker.apiRelay.apiRequest('/api/intent/intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: { query: 'laptop' }
});
```

### 2. API Relay Handler (Background Script)
**File:** `background/api-relay-handler.js`

Listens for `API_REQUEST` messages and:
- Extracts the endpoint and options
- Performs the actual fetch to localhost:8080
- Parses JSON or text responses
- Sends the result back to the content script

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'API_REQUEST') {
    handleApiRequest(message, sender, sendResponse);
    return true;
  }
});
```

## Updated Services

All services that access the API now use the relay instead of direct fetch:

### 1. **search-workflow.service.js** 
- `checkPurchaseIntent()` - Uses `apiRelay.apiRequest('/api/intent/intent', ...)`
- `fetchCachedProducts()` - Uses `apiRelay.apiRequest('/api/products/search', ...)`

### 2. **intent.service.js**
- `evaluateIntent()` - Uses `apiRelay.apiRequest()` for future-proofing

### 3. **pricing.service.js** (No changes needed)
- Already uses background worker messaging pattern for REST searches
- Delegates to `ws-relay-rest-search` messages

## Configuration

### manifest.json
- **background script:** `background.js` imports `api-relay-handler.js` via `importScripts()`
- **content scripts:** `api-relay.js` loaded before other services that depend on it
- **host_permissions:** Include `http://localhost:8080/*` and `https://localhost:8080/*`

### Load Order
In manifest.json `content_scripts.js` array:
```json
"js": [
  ...,
  "content/transport/api-relay.js",           // Must be first (provides PriceTracker.apiRelay)
  "content/transport/stomp-relay-client.js",  // Then other services
  "content/services/pricing.service.js",
  "content/services/intent.service.js",
  ...,
  "content/application/search-workflow.service.js"
]
```

## Optional Authentication

The solution maintains support for optional Firebase authentication:
- Token is retrieved via `firebaseAuthService.getAuthToken()`
- Authorization header is included if token exists
- Requests succeed without token if not authenticated
- Backend endpoints `/api/intent/intent` and `/api/search` work for both authenticated and unauthenticated users

## Testing

### Test Case 1: Intent Checking
```javascript
// In Google Search page
const response = await PriceTracker.apiRelay.apiRequest('/api/intent/intent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: { query: 'gaming laptop' }
});
```

Expected: Response with `{ label: 'BUY' }` or `{ label: 'NOT_BUY' }`

### Test Case 2: Cached Products Fetch
```javascript
const response = await PriceTracker.apiRelay.apiRequest('/api/products/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: { product_ref: 'gaminglaptop' }
});
```

Expected: Array of product objects

### Test Case 3: Authentication Optional
- Search without login should work (intent check and search proceed)
- Search with login should include Authorization header

## Performance Considerations

- **Message passing overhead:** ~2-5ms per request (negligible compared to network latency)
- **No caching:** Each request goes through the relay (WebSocket should be primary channel for product data)
- **Timeout settings:** Maintained at 6 seconds for intent checks

## Browser Compatibility

- **Chrome:** ✅ Standard support for chrome.runtime.sendMessage
- **Edge:** ✅ Uses Chromium base
- **Firefox:** ⚠️ Would need adaptation (uses different extension APIs)

## Future Enhancements

1. **WebSocket Relay** - If WebSocket connections also face restrictions, implement similar relay
2. **Request Batching** - Group multiple requests to reduce overhead
3. **Caching Layer** - Cache responses in chrome.storage for offline support
4. **Error Recovery** - Automatic retry with exponential backoff

## Debugging

Enable debug logs in:
- `content/transport/api-relay.js` - Search for `[API_RELAY]` logs
- `background/api-relay-handler.js` - Search for `[API_RELAY - BACKGROUND]` logs

Monitor the background script:
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Inspect views: service worker" for your extension
4. Check console for relay logs

## References

- [Chrome Extension Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)
- [Content Security Policy in Manifest V3](https://developer.chrome.com/docs/extensions/mv3/content_security_policy/)
- [CORS and Extension Security](https://developer.chrome.com/docs/extensions/mv3/content_scripts/#host-permissions)
