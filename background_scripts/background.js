/** Debug info flag, enable for development, disable for deployment */
const cookieOverrideDebugModeEnabled = false;

/** List of recently processed URLs used to prevent infinite looping */
var blockedUrls = [];

/**
 * Call console.log(obj) if debug flag is enabled
 * @param {any} obj
 */
function consoleDebug(obj) {
  if (!cookieOverrideDebugModeEnabled) return;
  console.log(obj);
}

/**
 * @param {cookies.Cookie} cookie
 * @returns {string} Cookie identifier string for messages
 */
function cookiePrintName(cookie) {
  return cookie.name + " (" + cookie.domain + ")";
}

/**
 * @returns {Promise} Promise containing tabs.Tab for active tab on fulfillment
 */
function getActiveTab() {
  return browser.tabs.query({active: true, currentWindow: true});
}

/**
 * @param {string} url 
 * @returns {boolean} true if url is in the blockedUrls array
 */
function urlBlocked(url) {
  consoleDebug("Checking if url is blocked: " + url);
  if (blockedUrls.indexOf(url) >= 0) return true;
  return false;
}

/**
 * Add url to the blockedUrls array for the given amount of time.
 * Used to prevent infinite looping on recently processed url.
 * @param {string} url 
 * @param {number} milliseconds
 */
function blockUrlFor(url, milliseconds) {
  if (urlBlocked(url)) return;
  consoleDebug("Blocking URL " + url + " for " + milliseconds + " ms");
  blockedUrls.push(url);
  window.setTimeout(function(){
    let index = blockedUrls.indexOf(url);
    if (index>=0) {
      blockedUrls.splice(index, 1);
    }
  }, milliseconds);
}

/**
 * Find cookies matching any of the rules and return an array of updated
 * cookies. Only new cookies with requested overrides are returned - cookies
 * not matching any rules are discarded from the returned array. Only cookies
 * whose domain matches the currentUrl are considered.
 * @param {string} currentUrl
 * @param {cookies.Cookie[]} cookieArray
 * @param {RuleForStorage[]} rules
 * @returns {cookies.Cookie[]}
 */
function getNewCookies(currentUrl, cookieArray, rules) {
  let cookiesToSet = [];
  for (let ck of cookieArray) {
    // Consider only cookies for the domain in current URL
    if (!currentUrl.includes(ck.domain.substring(1))) continue;

    for (let rule of rules) {
      // Match rules to cookies by name and domain
      if (!ck.domain.includes(rule.domain)) continue;
      if (ck.name != rule.name) continue;

      let newValue = ""
      if (rule.multiValueSeparator) { // multi-value cookie rule
        let allValues = ck.value.split(rule.multiValueSeparator);
        let allValuesObj = {};
        for (let subValueString of allValues) {
          let subValueStringSplit = subValueString.split('=');
          Object.defineProperty(allValuesObj,
                                subValueStringSplit[0],
                                {value: subValueStringSplit[1], writable: true});
        }
        for (let i=0; i<rule.subnames.length; i++) {
          Object.defineProperty(allValuesObj,
                                rule.subnames[i],
                                {value:  rule.values[i]});
        }
        for (let prop of Object.getOwnPropertyNames(allValuesObj)) {
          let newSubValue = prop + "=" + allValuesObj[prop]
          if (!newValue) newValue = newSubValue;
          else newValue += rule.multiValueSeparator + newSubValue;
        }
      }
      else { // single-value cookie rule
        newValue = rule.values[0];
      }
      if (ck.value == newValue) {
        consoleDebug("Cookie " + ck.name + " already has the desired value " + ck.value);
        continue;
      }
      consoleDebug("Change " + cookiePrintName(ck) + " value from " + ck.value + " to " + newValue);
      ck.value = newValue;
      cookiesToSet.push(ck);
    }
  }

  return cookiesToSet;
}

/**
 * Write cookies from cookieArray to the browser cookie storage and reload
 * the current tab.
 * @param {string} currentUrl
 * @param {number} currentTabId
 * @param {cookies.Cookie[]} cookieArray
 */
function setCookies(currentUrl, currentTabId, cookieArray) {
  for (let ck of cookieArray) {
    let details = {
      domain: ck.domain,
      name: ck.name,
      value: ck.value,
      url: currentUrl
    };
    if ('expirationDate' in ck) details.expirationDate = ck.expirationDate;
    if ('firstPartyDomain' in ck) details.firstPartyDomain = ck.firstPartyDomain;
    if ('httpOnly' in ck) details.httpOnly = ck.httpOnly;
    if ('path' in ck) details.path = ck.path;
    if ('sameSite' in ck) details.sameSite = ck.sameSite;
    if ('secure' in ck) details.secure = ck.secure;
    if ('storeId' in ck) details.storeId = ck.storeId;
    else details.url = ck.domain;

    try {
      browser.cookies.set(details)
      .then( (setCookie) => {
        consoleDebug("Cookie " + cookiePrintName(setCookie) + " updated successfully");
        blockUrlFor(currentUrl, 5000);
      })
      .catch( (err) => {
        console.error("Failed to set cookie. " + err);
      } );
    } catch (err) {
      console.error("Exception caught when setting cookie. " + err);
    }
  }
  if (cookieArray.length > 0) {
    // reload the page to use the updated cookies
    browser.tabs.reload(currentTabId);
  }
}

/**
 * Process a list of rules for the current active tab and update the cookies
 * as requested in the rules
 * @param {RuleForStorage[]} rules
 */
function applyRules(rules) {
  getActiveTab()
  .then((tabs) => {
    let currentUrl = tabs[0].url;
    let currentTabId = tabs[0].id;

    // Run only for pages with rules defined
    let runForCurrentUrl = false;
    for (let rule of rules) {
      if (currentUrl.includes(rule.domain)) {
        runForCurrentUrl = true;
        break;
      }
    }
    consoleDebug("blockedUrls = " + JSON.stringify(blockedUrls));
    if (urlBlocked(currentUrl)) runForCurrentUrl = false;
    if (!runForCurrentUrl) return;

    browser.cookies.getAll({})
    .then((ca) => {
      let cookiesArray = ca;
      let cookiesToSet = getNewCookies(currentUrl, cookiesArray, rules);
      setCookies(currentUrl, currentTabId, cookiesToSet);
    })
    .catch((err) => {
      console.warn("Could not retrieve cookies, cookie override not possible. " + err);
    });
  })
  .catch((err) => {
    console.warn("Could not determine URL of the current active tab, cookie override not possible. " + err);
  });
}

/**
 * Retrieve rules from browser storage of extension settings and apply them
 */
function cookieOverride() {
  browser.storage.sync.get("cookieOverrideRulesData")
  .then((result) => {
    let rules=[];
    for (let rule of result["cookieOverrideRulesData"]) {
      rules.push(JSON.parse(rule));
    }
    consoleDebug(rules);
    applyRules(rules);
  })
  .catch((err) => {
    console.warn("Could not retrieve extension settings, cookie override not possible. " + err);
  });
}

// call the main function cookieOverride when the tab is updated or activated
browser.tabs.onUpdated.addListener(cookieOverride);
browser.tabs.onActivated.addListener(cookieOverride);
