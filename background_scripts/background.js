// Hard-coded rules for initial testing
// var rules = [
//   {domain:"ecosia.org", name:"ECFG", multiValueSeparator:":", subnames:["mc"], values:["en-gb"]},
//   {domain:"youtube.com", name:"PREF", multiValueSeparator:"&", subnames:["hl", "gl"], values:["en-GB", "PL"]}
// ]

function cookiePrintName(cookie) {
  return cookie.name + " (" + cookie.domain + ")";
}

function getActiveTab() {
  return browser.tabs.query({active: true, currentWindow: true});
}

function getNewCookies(currentUrl, cookieArray, rules) {
  let cookiesToSet = [];
  for (let ck of cookieArray) {
    // Consider only cookies for the domain in current URL
    if (!currentUrl.includes(ck.domain.substring(1))) continue;

    for (let rule of rules) {
      // Match rules to cookies by name and domain
      if (!ck.domain.includes(rule.domain)) continue;
      if (!ck.name.includes(rule.name)) continue;

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
        // console.log("Cookie " + ck.name + " already has the desired value " + ck.value);
        continue;
      }
      console.log("Change " + cookiePrintName(ck) + " value from " + ck.value + " to " + newValue);
      ck.value = newValue;
      cookiesToSet.push(ck);
    }
  }

  return cookiesToSet;
}

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
        console.log("Cookie " + cookiePrintName(setCookie) + " updated successfully");
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

function cookieOverride() {
  browser.storage.sync.get("cookieOverrideRulesData")
  .then((result) => {
    console.log(result);
    let rules=[];
    for (let rule of result["cookieOverrideRulesData"]) {
      rules.push(JSON.parse(rule));
    }
    console.log(rules);
    applyRules(rules);
  })
  .catch((err) => {
    console.warn("Could not retrieve extension settings, cookie override not possible. " + err);
  });
}

// update when the tab is updated
browser.tabs.onUpdated.addListener(cookieOverride);
// update when the tab is activated
browser.tabs.onActivated.addListener(cookieOverride);
