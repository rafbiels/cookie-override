// Hard-coded rules for initial testing
// var rules = [
//   {domain:"ecosia.org", name:"ECFG", multiValueSeparator:":", subnames:["mc"], values:["en-gb"]},
//   {domain:"youtube.com", name:"PREF", multiValueSeparator:"&", subnames:["hl", "gl"], values:["en-GB", "PL"]},
//   {domain:"github.com", name:"tz", multiValueSeparator:"", subnames:[], values:["America/Montreal"]}
// ];

const cookieOverrideDebugModeEnabled = true;

/**
 * Common elements between Rule and RuleForStorage
 */
class RuleBase {
  constructor() {
    this.domain = "";
    this.name = "";
    this.multiValueSeparator = "";
  }

  sameAs(otherRule) {
    if (otherRule.domain != this.domain) return false;
    if (otherRule.name != this.name) return false;
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

  sameBaseAs(otherRule) {
    return super.sameAs(otherRule);
  }

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

  sameBaseAs(otherRule) {
    return super.sameAs(otherRule);
  }

  sameAs(otherRule) {
    if (!super.sameAs(otherRule)) return false;
    if (otherRule.subnames.length != this.subnames.length) return false;
    if (otherRule.values.length != this.values.length) return false;
    for (let subname of this.subnames) {
      if (!(subname in otherRule.subnames)) return false;
    }
    for (let value of this.values) {
      if (!(value in otherRule.values)) return false;
    }
    return true;
  }

  serialise() {
    return JSON.stringify(this);
  }

  static deserialise(str) {
    let rule = new RuleForStorage();
    let data = JSON.parse(str);
    for (let fieldName of ["domain", "name", "multiValueSeparator", "subnames", "values"]) {
      rule[fieldName] = data[fieldName];
    }
    return rule;
  }

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

  static fromRule(rule) {
    let ruleFS = new RuleForStorage();
    ruleFS.domain = rule.domain;
    ruleFS.name = rule.name;
    ruleFS.multiValueSeparator = rule.multiValueSeparator;
    ruleFS.subnames = [rule.subname];
    ruleFS.values = [rule.value];
    return ruleFS;
  }

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
        throw new Error("Conflicting values for the same subname");
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
      if (rule2FS.sameBaseAs(rule1FS)) {
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
 */
function getRules(callback) {
  debug("getRules called");

  function onSuccess(result) {
    // debug("success");
    debug("cookieOverrideRulesData = "+JSON.stringify(result));

    let rulesFS = [];
    if ("cookieOverrideRulesData" in result) {
      for (let ruleStr of result["cookieOverrideRulesData"]) {
        debug("ruleStr="+ruleStr);
        rulesFS.push(RuleForStorage.deserialise(ruleStr));
      }
    }
    // debug("getRules mergedRules="+JSON.stringify(mergedRules));
    let rules = convertFromStorage(rulesFS);
    // debug(" check1 ");
    debug("getRules rules="+JSON.stringify(rules));
    callback(rules);
  }

  function onError(error) {
    debug("error");
    debug(error);
  }

  browser.storage.sync.get("cookieOverrideRulesData").then(onSuccess, onError);
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
    function(currentValue, currentIndex, listObj) {
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
  debug(" ");
  getRules(updateTable);
}

/**
 * Read the rule addition form, append to existing rules and save them
 * to browser storage.
 * @param {Rule[]} rules current rules before the addition
 */
function addRule(rules) {
  debug("addRule called");

  let addRow = document.querySelector('#rules-table-add');
  let rule = new Rule();

  function getInput(parent, className) {
    return parent.querySelector('.'+className).querySelector('input');
  }

  rule.domain = getInput(addRow, 'col-domain').value;
  rule.name = getInput(addRow, 'col-name').value;
  if (getInput(addRow, 'col-multivalue').checked) {
    rule.multiValueSeparator = getInput(addRow, 'col-separator').value;
    rule.subname = getInput(addRow, 'col-subname').value;
  }
  rule.value = getInput(addRow, 'col-value').value;

  debug("rule="+JSON.stringify(rule));

  rules.push(rule);
  saveRules(rules).then(() => {updateTable(rules)})
  .catch( (err) => { debug(err);});
}

/**
 * Load rules from browser storage and call addRule
 */
function addRuleWrapper() {
  getRules(addRule);
}

/**
 * Remove the rule represented by the table row where the remove button was clicked
 * @param {Rule[]} rules current rules before the removal
 */
function removeRule(rules) {
  debug("removeRule called");

  function getText(parent, className) {
    return parent.querySelector('.'+className).innerText;
  }

  function removeRule(rules, ruleToRemove) {
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
    function(currentValue, currentIndex, listObj) {
      let rowToRemove = currentValue.parentNode.parentNode;
      debug("@@@ Removing row " + rowToRemove.innerText);
      let rule = new Rule();
      rule.domain = getText(rowToRemove, "col-domain");
      rule.name = getText(rowToRemove, "col-name");
      rule.multiValueSeparator = getText(rowToRemove, "col-separator");
      rule.subname = getText(rowToRemove, "col-subname");
      rule.value = getText(rowToRemove, "col-value");
      debug("@@@ Rule to remove = " + JSON.stringify(rule));
      removeRule(rules, rule);
    }
  );

  saveRules(rules).then(() => {updateTable(rules)})
  .catch( (err) => { debug(err);});
}

/**
 * Event handler for clicked remove button.
 * Loads rules from browser storage and calls removeRule.
 * @param {Event} evt 
 */
function removeRuleWrapper(evt) {
  let clickedButton = evt.target;
  clickedButton.setAttribute("class", clickedButton.getAttribute + " clicked-remove-button");
  getRules(removeRule);
}

/**
 * Overwrites browser storage with empty array
 */
function removeAll() {
  let rules = [];
  saveRules(rules).then(() => {updateTable(rules)});
}

document.addEventListener("DOMContentLoaded", updateTableWrapper);
document.querySelector("#add-rule-button").addEventListener("click", addRuleWrapper);
document.querySelector("#remove-all-button").addEventListener("click", removeAll);
document.querySelector("#refresh-button").addEventListener("click", updateTableWrapper);
