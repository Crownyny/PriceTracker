(function initGoogleSearchPage(global) {
  const PriceTracker = (global.PriceTracker = global.PriceTracker || {});

  const INSERT_SELECTORS = ['#search', '#rso', '#main', '#center_col', '[role="main"]'];

  function isSearchResultsPage(url) {
    const target = url || window.location.href;
    return target.includes('google.com/search') || target.includes('google.co/search') || target.includes('google.com.co/search');
  }

  function getQueryFromLocation() {
    const params = new URLSearchParams(window.location.search);
    return (params.get('q') || '').trim();
  }

  function findInsertAnchor() {
    for (const selector of INSERT_SELECTORS) {
      const node = document.querySelector(selector);
      if (node) {
        return node;
      }
    }
    return null;
  }

  PriceTracker.googleSearchPage = {
    isSearchResultsPage,
    getQueryFromLocation,
    findInsertAnchor,
  };
})(window);
