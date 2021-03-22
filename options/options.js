// Hard-coded rules for initial testing
// var rules = [
//   {domain:"ecosia.org", name:"ECFG", multiValueSeparator:":", subnames:["mc"], values:["en-gb"]},
//   {domain:"youtube.com", name:"PREF", multiValueSeparator:"&", subnames:["hl", "gl"], values:["en-GB", "PL"]},
//   {domain:"github.com", name:"tz", multiValueSeparator:"", subnames:[], values:["America/Montreal"]}
// ];

function debug(message) {
  document.querySelector("body").appendChild(document.createTextNode(" " + message + " "));
  document.querySelector("body").appendChild(document.createElement("br"));
}

function emptyRule() {
  return {domain:"", name:"", multiValueSeparator:"", subnames:[], values:[]};
}

function copyRule(rule) {
  copy = emptyRule();
  copy.domain = rule.domain;
  copy.name = rule.name;
  copy.multiValueSeparator = rule.multiValueSeparator;
  for (let i=0; i<rule.subnames.length; i++) {
    copy.subnames.push(rule.subnames[i]);
    copy.values.push(rule.values[i]);
  }
  return copy;
}

function splitRules(rules) {
  // debug("splitRules called");
  sRules = [];
  for (let rule of rules) {
    if (rule.subnames.length <= 1) {
      sRules.push(rule);
      continue;
    }
    for (let i=0; i<rule.subnames.length; i++) {
      subrule = {
        domain: rule.domain,
        name: rule.name,
        multiValueSeparator: rule.multiValueSeparator,
        subnames: [rule.subnames[i]],
        values: [rule.values[i]]
      };
      sRules.push(subrule);
    }
  }
  return sRules;
}

function mergeRules(rules) {
  // debug("mergeRules called");
  mergedRules = [];
  for (let rule1 of rules) {
    let merged = false;
    for (let rule2 of mergedRules) {
      if (rule2.domain != rule1.domain) continue;
      if (rule2.name != rule1.name) continue;
      if (rule2.multiValueSeparator != rule1.multiValueSeparator) continue;
      for (let subname of rule1.subnames) rule2.subnames.push(subname);
      for (let value of rule1.values) rule2.values.push(value);
      merged = true;
    }
    if (!merged) {
      mergedRules.push(copyRule(rule1));
    }
  }
  return mergedRules;
}

function ruleToRows(rule) {
  function addCell(row, content, className) {
    cell = document.createElement("td");
    cell.setAttribute("class", className);
    cell.appendChild(content);
    row.appendChild(cell);
  }

  // debug("ruleToRows rule=" + JSON.stringify(rule));
  row = document.createElement("tr");

  removeButton = document.createElement("input");
  removeButton.setAttribute("type", "button");
  removeButton.setAttribute("value", unescape("%u2212"));
  removeButton.setAttribute("class", "remove-button");
  removeButton.addEventListener("click", removeRuleWrapper);
  addCell(row, removeButton, "col-button");

  addCell(row, document.createTextNode(rule.domain), "col-domain");
  addCell(row, document.createTextNode(rule.name), "col-name");

  mvCheckbox = document.createElement("input");
  mvCheckbox.setAttribute("type", "checkbox");
  mvCheckbox.toggleAttribute("checked", rule.multiValueSeparator);
  mvCheckbox.toggleAttribute("disabled", true);
  addCell(row, mvCheckbox, "col-multivalue");

  rows = [row];
  if (rule.multiValueSeparator) {
    addCell(row, document.createTextNode(rule.multiValueSeparator), "col-separator");
    for (let i=0; i<rule.subnames.length; i++) {
      if (i >= rows.length) rows.push(row.cloneNode(true));
    }
    for (let i=0; i<rule.subnames.length; i++) {
      addCell(rows[i], document.createTextNode(rule.subnames[i]), "col-subname");
      addCell(rows[i], document.createTextNode(rule.values[i]), "col-value");
    }
  } else {
    addCell(row, document.createTextNode(""), "col-separator");
    addCell(row, document.createTextNode(""), "col-subname");
    addCell(row, document.createTextNode(rule.values[0]), "col-value");
  }

  // debug("ruleToRows rows.length=" + rows.length);
  for (let r of rows) {
    // debug("ruleToRows row.innerText=" + row.innerText);
  }
  return rows;
}

function getRules(callback) {
  // debug("getRules called");

  function onSuccess(result) {
    // document.querySelector("body").appendChild(document.createTextNode("success"));
    // document.querySelector("body").appendChild(document.createTextNode(" rulesJSON = "+JSON.stringify(result)));

    mergedRules = [];
    for (let rule of result["rulesJSON"]) {
      // document.querySelector("body").appendChild(document.createTextNode(" rule = "+JSON.stringify(rule)));
      mergedRules.push(JSON.parse(rule));
    }
    // debug("getRules mergedRules="+JSON.stringify(mergedRules));
    sRules = splitRules(mergedRules);
    // document.querySelector("body").appendChild(document.createTextNode(" check1 "));
    // debug("getRules rules="+JSON.stringify(sRules));
    callback(sRules);
  }

  function onError(error) {
    debug("error");
    debug(error);
  }

  browser.storage.sync.get("rulesJSON").then(onSuccess, onError);
}

function saveRules(rules) {
  mergedRules = mergeRules(rules);
  rulesJSON = [];
  for (let rule of mergedRules) {
    rulesJSON.push(JSON.stringify(rule));
  }
  return browser.storage.sync.set({rulesJSON});
}

function updateTable(rules) {
  // debug("updateTable called");
  // debug("updateTable rules="+JSON.stringify(rules));

  table = document.querySelector("#rules-table")

  // Clear the table
  table.querySelectorAll("tr").forEach(
    function(currentValue, currentIndex, listObj) {
      if (currentValue.id == "rules-table-header") return;
      if (currentValue.id == "rules-table-add") return;
      currentValue.remove();
    }
  );

  // Populate the table
  addRow = document.querySelector('#rules-table-add');
  for (let rule of rules) {
    rows = ruleToRows(rule);
    for (let row of rows) {
      // debug("@@@ updateTable inserting row " + row.innerText);
      addRow.parentNode.insertBefore(row, addRow);
    }
  }
}

function updateTableWrapper() {
  // debug(" ");
  getRules(updateTable);
}

function addRule(rules) {
  // debug("addRule called");

  addRow = document.querySelector('#rules-table-add');
  rule = emptyRule();

  function getInput(parent, className) {
    return parent.querySelector('.'+className).querySelector('input');
  }

  rule.domain = getInput(addRow, 'col-domain').value;
  rule.name = getInput(addRow, 'col-name').value;
  if (getInput(addRow, 'col-multivalue').checked) {
    rule.multiValueSeparator = getInput(addRow, 'col-separator').value;
    rule.subnames = [getInput(addRow, 'col-subname').value];
  }
  rule.values = [getInput(addRow, 'col-value').value];

  // debug("rule="+JSON.stringify(rule));

  rules.push(rule);
  saveRules(rules).then(() => {updateTable(rules)})
  .catch( (err) => { debug(err);});
}

function addRuleWrapper() {
  getRules(addRule);
}

function removeRule(rules) {
  // debug("removeRule called");

  function getText(parent, className) {
    return parent.querySelector('.'+className).innerText;
  }

  function removeRule(rules, ruleToRemove) {
    index=-1;
    for (let i=0; i<rules.length; i++) {
      if (ruleToRemove.domain != rules[i].domain) continue;
      if (ruleToRemove.name != rules[i].name) continue;
      if (ruleToRemove.multiValueSeparator != rules[i].multiValueSeparator) continue;
      if (ruleToRemove.subnames.length != rules[i].subnames.length) continue;
      if (ruleToRemove.subnames.join(";") != rules[i].subnames.join(";")) continue;
      if (ruleToRemove.values.length != rules[i].values.length) continue;
      if (ruleToRemove.values.join(";") != rules[i].values.join(";")) continue;
      index = i;
      break;
    }
    // debug("@@@ Rule to remove index = " + index);
    if (index>=0) rules.splice(index, 1);
  }

  document.querySelectorAll('.clicked-remove-button').forEach(
    function(currentValue, currentIndex, listObj) {
      rowToRemove = currentValue.parentNode.parentNode;
      // debug("@@@ Removing row " + rowToRemove.innerText);
      rule = emptyRule();
      rule.domain = getText(rowToRemove, "col-domain");
      rule.name = getText(rowToRemove, "col-name");
      rule.multiValueSeparator = getText(rowToRemove, "col-separator");
      subname = getText(rowToRemove, "col-subname");
      if (subname) rule.subnames = [subname];
      rule.values = [getText(rowToRemove, "col-value")];
      // debug("Rule to remove = " + JSON.stringify(rule));
      removeRule(rules, rule);
    }
  );

  saveRules(rules).then(() => {updateTable(rules)})
  .catch( (err) => { debug(err);});
}

function removeRuleWrapper(evt) {
  clickedButton = evt.target;
  clickedButton.setAttribute("class", clickedButton.getAttribute + " clicked-remove-button");
  getRules(removeRule);
}

function removeAll() {
  rules = [];
  saveRules(rules).then(() => {updateTable(rules)});
}

document.addEventListener("DOMContentLoaded", updateTableWrapper);
document.querySelector("#add-rule-button").addEventListener("click", addRuleWrapper);
document.querySelector("#remove-all-button").addEventListener("click", removeAll);
document.querySelector("#refresh-button").addEventListener("click", updateTableWrapper);
