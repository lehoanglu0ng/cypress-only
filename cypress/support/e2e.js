// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

let isSoftAssertion = false;
let errors = [];

chai.softExpect = function (...args) {
  isSoftAssertion = true;
  return chai.expect(...args);
};
chai.softAssert = function (...args) {
  isSoftAssertion = true;
  return chai.assert(...args);
};

const origAssert = chai.Assertion.prototype.assert;
chai.Assertion.prototype.assert = function (...args) {
  if (isSoftAssertion) {
    try {
      origAssert.call(this, ...args);
    } catch (error) {
      cy.screenshot(error.message);
      errors.push(error);
    }
    isSoftAssertion = false;
  } else {
    origAssert.call(this, ...args);
  }
};

// monkey-patch `Cypress.log` so that the last `cy.then()` isn't logged to command log
const origLog = Cypress.log;
Cypress.log = function (data) {
  if (data && data.error && /soft/i.test(data.error.message)) {
    data.error.message = prettyErrors(data.error.message);
    throw data.error;
  }
  return origLog.call(Cypress, ...arguments);
};

// monkey-patch `it` callback so we insert `cy.then()` as a last command
// to each test case where we'll assert if there are any soft assertion errors
const itCallback = (title, func) => {
  func();
  cy.then(() => {
    if (errors.length) {
      const _ = Cypress._;
      let msg = '';
      _.each(errors, error => {
        msg += `Soft${error}\n`;
      });
      msg = msg.substring(0, msg.lastIndexOf('\n'));
      throw new Error(msg);
    }
  });
};

const origIt = window.it;
window.it = (title, func) => {
  origIt(title, func && (() => itCallback(title, func)));
};
window.it.only = (title, func) => {
  let cases = Cypress.env('CypressOnly');
  cases += ';';
  cases += title;
  Cypress.env('CypressOnly', cases);
  origIt(title, func && (() => itCallback(title, func)));
};
window.it.skip = (title, func) => {
  origIt.skip(title, func);
};

beforeEach(() => {
  errors = [];
});
afterEach(() => {
  errors = [];
  isSoftAssertion = false;
});

before(() => {
  filterTestCases()
})

const filterTestCases = () => {
  const testFilter = Cypress.env('CypressOnly')?.split(';');
  let tests = Cypress.mocha.getRunner().suite.suites?.[0].tests;
  tests.forEach((test, index) => {
    if (testFilter?.length > 1 && !testFilter?.some(t => t.includes(test.title)))
      Cypress.mocha.getRunner().suite.suites[0].tests[index].pending = true;
  });
};