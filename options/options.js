/** Debug info flag, enable for development, disable for deployment */
const cookieOverrideDebugModeEnabled = false;

/**
 * Common elements between Rule and RuleForStorage
 */
class RuleBase {
  constructor() {
    this.domain = "";
    this.name = "";
    this.multiValueSeparator = "";
  }

  /**
   * @param {RuleBase} otherRule
   * @returns {boolean} true if the rules have same domain and name
   */
  sameDomainAndName(otherRule) {
    if (otherRule.domain != this.domain) return false;
    if (otherRule.name != this.name) return false;
    return true;
  }

  /**
   * @param {RuleBase} otherRule
   * @returns {boolean} true if the rules have same domain, name and separator
   */
  sameAs(otherRule) {
    if (!this.sameDomainAndName(otherRule)) return false;
    if (otherRule.multiValueSeparator != this.multiValueSeparator) return false;
    return true;
  }
}

/**
 * Describes a rule as represented by a single row of the options panel table.
 * It can hold a single subname and value. There can be many instances for the
 * same domain and name.
 */
class Rule extends RuleBase {
  constructor() {
    super();
    this.subname = "";
    this.value = "";
  }

  /**
   * @param {RuleBase} otherRule
   * @returns {boolean} true if the rules have same domain, name and separator
   */
  sameBaseAs(otherRule) {
    return super.sameAs(otherRule);
  }

  /**
   * @param {Rule} otherRule
   * @returns {boolean} true if the rules have same domain, name, separator, subname and value
   */
  sameAs(otherRule) {
    if (!super.sameAs(otherRule)) return false;
    if (otherRule.subname != this.subname) return false;
    if (otherRule.value != this.value) return false;
    return true;
  }
}

/**
 * Describes a rule as saved to browser storage and as used by the background
 * script. There should be only one rule per domain-name pair and it can store
 * multiple subname-value pairs.
 */
class RuleForStorage extends RuleBase {
  constructor() {
    super();
    this.subnames = [];
    this.values = [];
  }

  /**
   * @param {RuleBase} otherRule
   * @returns {boolean} true if the rules have same domain, name and separator
   */
  sameBaseAs(otherRule) {
    return super.sameAs(otherRule);
  }

  /**
   * @param {RuleForStorage} otherRule
   * @returns {boolean} true if the rules have same domain, name, separator, subnames and values
   */
  sameAs(otherRule) {
    debug("sameAs called for " + JSON.stringify(this) + " and " + JSON.stringify(otherRule));
    if (!super.sameAs(otherRule)) return false;
    if (otherRule.subnames.length != this.subnames.length) return false;
    if (otherRule.values.length != this.values.length) return false;
    for (let subname of this.subnames) {
      if (otherRule.subnames.indexOf(subname)==-1) return false;
    }
    for (let value of this.values) {
      if (otherRule.values.indexOf(value)==-1) return false;
    }
    return true;
  }

  /**
   * @returns {string} this object represented as a single string
   */
  serialise() {
    return JSON.stringify(this);
  }

  /**
   * Create RuleForStorage from string representation produced by serialise()
   * @param {string} str
   * @returns {RuleForStorage}
   */
  static deserialise(str) {
    let rule = new RuleForStorage();
    let data = JSON.parse(str);
    for (let fieldName of ["domain", "name", "multiValueSeparator", "subnames", "values"]) {
      rule[fieldName] = data[fieldName];
    }
    return rule;
  }

  /**
   * Convert this RuleForStorage into a Rule array
   * @returns {Rule[]}
   */
  toRules() {
    let rules = [];
    for (let i=0; i<this.values.length; ++i) {
      let rule = new Rule();
      rule.domain = this.domain;
      rule.name = this.name;
      rule.multiValueSeparator = this.multiValueSeparator;
      rule.subname = this.subnames[i];
      rule.value = this.values[i];
      rules.push(rule);
    }
    return rules;
  }

  /**
   * Create a RuleForStorage from Rule
   * @param {Rule} rule
   * @returns {RuleForStorage}
   */
  static fromRule(rule) {
    let ruleFS = new RuleForStorage();
    ruleFS.domain = rule.domain;
    ruleFS.name = rule.name;
    ruleFS.multiValueSeparator = rule.multiValueSeparator;
    ruleFS.subnames = [rule.subname];
    ruleFS.values = [rule.value];
    return ruleFS;
  }

  /**
   * Merge subnames and values of other rule into this, if the rules are
   * mergeable (have the same base)
   * @param {RuleForStorage} otherRule
   */
  mergeWith(otherRule) {
    debug("mergeWith called");
    debug("mergeWith before merge this = " + JSON.stringify(this));
    debug("mergeWith before merge otherRule = " + JSON.stringify(otherRule));
    if (!this.sameBaseAs(otherRule)) {
      throw new Error("Cannot merge rules with different domain/name/separator");
    }
    for (let indexThere=0; indexThere<otherRule.subnames.length; ++indexThere) {
      let indexHere = this.subnames.indexOf(otherRule.subnames[indexThere]);
      if (indexHere<0) {
        debug("mergeWith no conflict, merging");
        this.subnames.push(otherRule.subnames[indexThere]);
        this.values.push(otherRule.values[indexThere]);
      }
      else if (this.values[indexHere] == otherRule.values[indexThere]) {
        debug("subname-value pair already present, skipping");
        continue; // subname-value pair already here
      }
      else {
        debug("Conflicting values for the same subname " + otherRule.subnames[indexThere]);
        throw new Error("Conflicting values for the same rule");
      }
    }
    debug("mergeWith after merge this = " + JSON.stringify(this));
  }
}

/**
 * Print message at the end of options panel window.
 * @param {string} message
 */
function debug(message) {
  if (!cookieOverrideDebugModeEnabled) return;
  document.querySelector("body").appendChild(document.createTextNode(" " + message + " "));
  document.querySelector("body").appendChild(document.createElement("br"));
}

/**
 * Clear and hide the error box
 */
function clearError() {
  debug("clearError called");
  let errorBox = document.querySelector("#error-box");
  if (!errorBox.style.display || errorBox.style.display == "none") return;
  errorBox.childNodes.forEach((node) => {node.remove();});
  errorBox.style.opacity = 0;
  errorBox.style.display = 'none';
}

/**
 * Put the message into the error box and show it
 * @param {string} message
 */
function reportError(message) {
  debug("reportError called");
  let errorBox = document.querySelector("#error-box");
  errorBox.style.transitionDuration = ".05s";
  clearError();
  errorBox.appendChild(document.createTextNode(message));
  errorBox.style.display = 'block';
  window.setTimeout(function(){
    errorBox.style.transitionDuration = ".2s";
    errorBox.style.display = 'block';
    errorBox.style.opacity = 1;
  }, 50);
}

/**
 * Convert RuleFromStorage array to Rule array
 * @param {RuleForStorage[]} rulesFS
 * @returns {Rule[]}
 */
function convertFromStorage(rulesFS) {
  debug("convertFromStorage called");
  let allRules = [];
  for (let ruleFS of rulesFS) {
    let rules = ruleFS.toRules();
    for (let rule of rules) {
      allRules.push(rule);
    }
  }
  return allRules;
}

/**
 * Convert Rule array to RuleFromStorage array
 * @param {Rule[]} rules
 * @returns {RuleForStorage[]}
 */
function convertForStorage(rules) {
  debug("convertForStorage called");
  let mergedRules = [];
  for (let rule1 of rules) {
    let merged = false;
    let rule1FS = RuleForStorage.fromRule(rule1);
    for (let rule2FS of mergedRules) {
      if (rule2FS.sameDomainAndName(rule1FS)) {
        if (rule2FS.sameAs(rule1FS)) {
          throw new Error("Duplicate rule");
        }
        if (rule2FS.multiValueSeparator != rule1FS.multiValueSeparator) {
          throw new Error("Cannot define rules for the same domain and name " +
                          "with different separators");
        }
        rule2FS.mergeWith(rule1FS);
        merged = true;
      }
    }
    if (!merged) {
      mergedRules.push(rule1FS);
    }
  }
  debug("convertForStorage mergedRules = " + JSON.stringify(mergedRules));
  return mergedRules;
}

/**
 * Generate DOM table row representing a Rule
 * @param {Rule} rule
 * @returns {Element}
 */
function ruleToRow(rule) {
  function addCell(row, content, className) {
    let cell = document.createElement("td");
    cell.setAttribute("class", className);
    cell.appendChild(content);
    row.appendChild(cell);
  }

  debug("ruleToRow rule=" + JSON.stringify(rule));
  let row = document.createElement("tr");

  let removeButton = document.createElement("input");
  removeButton.setAttribute("type", "button");
  removeButton.setAttribute("value", unescape("%u2212"));
  removeButton.setAttribute("class", "remove-button");
  removeButton.addEventListener("click", removeRuleWrapper);
  addCell(row, removeButton, "col-button");

  addCell(row, document.createTextNode(rule.domain), "col-domain");
  addCell(row, document.createTextNode(rule.name), "col-name");

  let mvCheckbox = document.createElement("input");
  mvCheckbox.setAttribute("type", "checkbox");
  mvCheckbox.toggleAttribute("checked", rule.multiValueSeparator);
  mvCheckbox.toggleAttribute("disabled", true);
  addCell(row, mvCheckbox, "col-multivalue");

  addCell(row, document.createTextNode(rule.multiValueSeparator), "col-separator");
  addCell(row, document.createTextNode(rule.subname), "col-subname");
  addCell(row, document.createTextNode(rule.value), "col-value");

  debug("ruleToRow row.innerText=" + row.innerText);
  return row;
}

/**
 * Retrieve the rules from browser storage and execute the callback.
 * The callback should take Rule array as argument.
 * @param {function} callback
 * @returns {Promise}
 */
function getRules(callback) {
  debug("getRules called");

  function onSuccess(result) {
    debug("cookieOverrideRulesData = "+JSON.stringify(result));

    let rulesFS = [];
    if ("cookieOverrideRulesData" in result) {
      for (let ruleStr of result["cookieOverrideRulesData"]) {
        debug("ruleStr="+ruleStr);
        rulesFS.push(RuleForStorage.deserialise(ruleStr));
      }
    }
    let rules = convertFromStorage(rulesFS);
    debug("getRules rules="+JSON.stringify(rules));
    try {
      callback(rules);
    }
    catch(error) {
      return Promise.reject(error.message);
    }
  }

  return browser.storage.sync.get("cookieOverrideRulesData")
  .then(onSuccess)
  .catch(reportError);
}

/**
 * Convert and save Rule array into the browser storage.
 * @param {Rule[]} rules
 * @returns {Promise}
 */
function saveRules(rules) {
  debug("saveRules called");
  try {
    let rulesForStorage = convertForStorage(rules);
    let cookieOverrideRulesData = [];
    for (let ruleFS of rulesForStorage) {
      let ruleStr = ruleFS.serialise();
      debug("saveRules ruleStr = " + ruleStr);
      cookieOverrideRulesData.push(ruleStr);
    }
    return browser.storage.sync.set({cookieOverrideRulesData});
  }
  catch (error) {
    debug("saveRules encountered and error: \"" + error.message + "\"");
    return Promise.reject(error.message);
  }
}

/**
 * Clear the rules table and repopulate using the passed Rule array.
 * @param {Rule[]} rules
 */
function updateTable(rules) {
  debug("updateTable called");
  debug("updateTable rules="+JSON.stringify(rules));

  let table = document.querySelector("#rules-table")

  // Clear the table
  table.querySelectorAll("tr").forEach(
    function(currentValue) {
      if (currentValue.id == "rules-table-header") return;
      if (currentValue.id == "rules-table-add") return;
      currentValue.remove();
    }
  );

  // Populate the table
  let addRow = document.querySelector('#rules-table-add');
  for (let rule of rules) {
    let row = ruleToRow(rule);
    debug("### updateTable inserting row " + row.innerText);
    addRow.parentNode.insertBefore(row, addRow);
  }
}

/**
 * Load rules from browser storage and call updateTable
 */
function updateTableWrapper() {
  getRules(updateTable).catch(reportError);
}

/**
 * Read the rule addition form, append to existing rules and save them
 * to browser storage.
 * @param {Rule[]} rules current rules before the addition
 * @returns {Promise}
 */
function addRule(rules) {
  debug("addRule called");

  let addRow = document.querySelector('#rules-table-add');
  let rule = new Rule();

  function getInput(parent, className) {
    return parent.querySelector('.'+className).querySelector('input');
  }

  rule.domain = getInput(addRow, 'col-domain').value;
  if (!rule.domain) throw new Error("Cannot add rule with empty domain");

  rule.name = getInput(addRow, 'col-name').value;
  if (!rule.name) throw new Error("Cannot add rule with empty name");

  if (getInput(addRow, 'col-multivalue').checked) {
    rule.multiValueSeparator = getInput(addRow, 'col-separator').value;
    if (!rule.multiValueSeparator) throw new Error("Cannot add multivalue rule with empty separator");
    rule.subname = getInput(addRow, 'col-subname').value;
    if (!rule.subname) throw new Error("Cannot add multivalue rule with empty subvalue name");
  }
  rule.value = getInput(addRow, 'col-value').value;

  debug("rule="+JSON.stringify(rule));

  rules.push(rule);
  return saveRules(rules).then(() => {updateTableWrapper()})
  .catch(reportError);
}

/**
 * Load rules from browser storage and call addRule
 */
function addRuleWrapper() {
  clearError();
  getRules(addRule).catch(reportError);
}

/**
 * Remove the rule represented by the table row where the remove button was clicked
 * @param {Rule[]} rules current rules before the removal
 * @returns {Promise}
 */
function removeRule(rules) {
  debug("removeRule called");

  function getText(parent, className) {
    return parent.querySelector('.'+className).innerText;
  }

  function removeRuleFromArray(rules, ruleToRemove) {
    let index = -1;
    for (let i=0; i<rules.length; ++i) {
      if (rules[i].sameAs(ruleToRemove)) {
        index = i;
        break;
      }
    }
    debug("@@@ Rule to remove index = " + index);
    if (index>=0) rules.splice(index, 1);
  }

  document.querySelectorAll('.clicked-remove-button').forEach(
    function(currentValue) {
      let rowToRemove = currentValue.parentNode.parentNode;
      debug("@@@ Removing row " + rowToRemove.innerText);
      let rule = new Rule();
      rule.domain = getText(rowToRemove, "col-domain");
      rule.name = getText(rowToRemove, "col-name");
      rule.multiValueSeparator = getText(rowToRemove, "col-separator");
      rule.subname = getText(rowToRemove, "col-subname");
      rule.value = getText(rowToRemove, "col-value");
      debug("@@@ Rule to remove = " + JSON.stringify(rule));
      removeRuleFromArray(rules, rule);
    }
  );

  return saveRules(rules).then(() => {updateTableWrapper()})
  .catch(reportError);
}

/**
 * Event handler for clicked remove button.
 * Loads rules from browser storage and calls removeRule.
 * @param {Event} evt
 */
function removeRuleWrapper(evt) {
  clearError();
  let clickedButton = evt.target;
  clickedButton.setAttribute("class", clickedButton.getAttribute + " clicked-remove-button");
  getRules(removeRule).catch(reportError);
}

function checkboxHandler(evt) {
  let checkbox = evt.target;
  let row = checkbox.parentNode.parentNode;
  let separatorInput = row.querySelector(".col-separator input[type=text]");
  let subnameInput = row.querySelector(".col-subname input[type=text]");
  if (checkbox.checked) {
    debug("checkbox checked");
    separatorInput.toggleAttribute("disabled", false);
    subnameInput.toggleAttribute("disabled", false);
  }
  else {
    debug("checkbox unchecked");
    separatorInput.value = "";
    separatorInput.toggleAttribute("disabled", true);
    subnameInput.value = "";
    subnameInput.toggleAttribute("disabled", true);
  }
}

document.addEventListener("DOMContentLoaded", updateTableWrapper);
document.querySelector("#add-rule-button").addEventListener("click", addRuleWrapper);
document.querySelector(".col-multivalue input[type=checkbox]").addEventListener("change", checkboxHandler);
